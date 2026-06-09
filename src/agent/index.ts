/**
 * MobSec Studio — Frida Intelligence Agent (entry point).
 *
 * Bundled by esbuild (scripts/build-agent.mjs) into a single IIFE that the
 * device-side Frida runtime loads. The host (src/main/services/frida.ts)
 * loads this agent, then calls `rpc.exports.profile()` to drive
 * reconnaissance and reads the returned App Intelligence Report.
 *
 * Phase 1 surface:
 *   rpc.exports.ping()    → 'pong'  (liveness)
 *   rpc.exports.profile() → AppIntelligenceReport
 *
 * Everything is wrapped so a single failing probe degrades to a warning in
 * the report rather than crashing the session.
 */

// MUST be first: installs the global `Java` bridge (Frida 17 no longer
// provides it). Importing for its side effect before anything else runs.
import './core/bridge'
import type {
  ActiveTrace,
  AppIntelligenceReport,
  ClassMethodInfo,
  ClassSearchResult,
  FrameworkInfo,
  HeapInstance,
  StrategyInfo,
  StrategyResult,
  TracerInfo
} from '@shared/frida-intel'
import { AGENT_VERSION, emitReady } from './core/protocol'
import { channel } from './core/log'
import { whenJavaReady, currentPackageName, type JavaGiveUpReason } from './core/java'
import { buildContext, type ReconContext } from './core/context'
import { ReportBuilder } from './core/report'
import {
  getDetectors,
  getStrategies,
  getTracer,
  getTracers,
  isTracerActive,
  setTracerActive
} from './core/registry'
import { safe } from './core/safe'
import { registerAllDetectors } from './detectors'
import { registerAllStrategies } from './strategies'
import { registerAllTracers } from './tracers'
import { applyStrategiesByIds, autoApplyApplicable } from './orchestrate'
import {
  activeClassTraces,
  activeNativeTraces,
  chooseInstances,
  enumerateClasses,
  listMethods,
  traceClass,
  traceNative,
  untraceClass,
  untraceNative
} from './discovery'
import {
  readDeviceInfo,
  readRuntimeInfo,
  surveyClasses,
  surveyDynamicDex,
  surveyJni,
  surveyNatives
} from './recon/survey'
import { computeRecommendations } from './recon/recommendations'

registerAllDetectors()
registerAllStrategies()
registerAllTracers()

const AGENT_API = [
  'ping',
  'profile',
  'listStrategies',
  'applyStrategies',
  'autoApply',
  'listTracers',
  'startTracer',
  'stopTracer',
  'enumerateClasses',
  'listMethods',
  'traceClass',
  'untraceClass',
  'chooseInstances',
  'traceNative',
  'untraceNative',
  'listActiveTraces',
  'rpcEval'
]

function tracerList(): TracerInfo[] {
  return getTracers().map((t) => ({
    id: t.id,
    label: t.label,
    description: t.description,
    channel: t.channel,
    active: isTracerActive(t.id)
  }))
}

interface ProfileOptions {
  injection?: AppIntelligenceReport['injection']
  identifier?: string | null
}

const UNKNOWN_FRAMEWORK: FrameworkInfo = {
  kind: 'unknown',
  label: 'Unknown',
  confidence: 0,
  version: null,
  evidence: []
}

function buildReport(opts: ProfileOptions, ctx: ReconContext = buildContext()): AppIntelligenceReport {
  const started = Date.now()
  const log = channel('recon')
  log.info('reconnaissance started')

  const out = new ReportBuilder()

  for (const detector of getDetectors()) {
    safe(
      `detector:${detector.id}`,
      () => {
        log.debug(`running detector "${detector.id}"`)
        detector.detect(ctx, out)
      },
      (message) => out.warn(message)
    )
  }

  const device = readDeviceInfo(ctx)
  const runtime = readRuntimeInfo(ctx)
  const nativeLibs = surveyNatives(ctx)
  const classes = surveyClasses(ctx)
  const jni = surveyJni(ctx, classes.appPackages)
  if (jni.warning) out.warn(jni.warning)
  const dynamicDex = surveyDynamicDex()

  const frameworks = out.frameworks.slice().sort((a, b) => b.confidence - a.confidence)
  const framework = frameworks.length > 0 ? (frameworks[0] as FrameworkInfo) : UNKNOWN_FRAMEWORK

  // Promote a class-survey obfuscation verdict into a security control.
  if (classes.obfuscated) {
    out.addSecurity({
      id: 'obfuscation',
      label: 'Name obfuscation (ProGuard/R8/DexGuard-style)',
      kind: 'obfuscation',
      variant: null,
      confidence: 0.7,
      evidence: ['Most loaded app classes have ultra-short obfuscated names']
    })
  }

  const report: AppIntelligenceReport = {
    schema: 1,
    generatedAt: new Date().toISOString(),
    pid: Process.id,
    identifier: opts.identifier ?? currentPackageName(),
    injection: opts.injection ?? 'unknown',
    device,
    runtime,
    framework,
    frameworks,
    networking: out.networking,
    crypto: out.crypto,
    storage: out.storage,
    security: out.security,
    nativeLibs,
    classes,
    jni: { nativeMethodCount: jni.nativeMethodCount, classes: jni.classes },
    dynamicDex,
    recommendations: [],
    warnings: out.warnings,
    durationMs: 0
  }
  report.recommendations = computeRecommendations(report)
  report.durationMs = Date.now() - started

  log.info(
    `reconnaissance complete in ${report.durationMs}ms — framework=${framework.label}, ` +
      `${out.security.length} control(s), ${out.networking.length} net lib(s), ` +
      `${nativeLibs.length} native lib(s), ${out.warnings.length} warning(s)`
  )
  return report
}

const GIVE_UP_MESSAGE: Record<JavaGiveUpReason, string> = {
  'no-java-global':
    "No Java runtime is visible in this process — it looks native-only (a non-ART helper/sandbox process), or the app exited before ART initialised. Select the app's main process, or use Launch & attach.",
  'vm-not-found':
    'The Java VM did not initialise within the wait window. The app may be exiting on Frida detection, or ART is starting unusually slowly — try Launch & attach, or Recon the app once it is already running.'
}

/** Run `fn` once ART is ready, resolving/rejecting a promise for rpc. */
function withJava<T>(fn: () => T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    whenJavaReady(
      () => {
        try {
          resolve(fn())
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)))
        }
      },
      (reason) => reject(new Error(GIVE_UP_MESSAGE[reason]))
    )
  })
}

rpc.exports = {
  ping(): string {
    return 'pong'
  },
  profile(options?: ProfileOptions): Promise<AppIntelligenceReport> {
    return withJava(() => buildReport(options ?? {}))
  },
  listStrategies(): Promise<StrategyInfo[]> {
    return withJava(() => {
      const ctx = buildContext()
      return getStrategies().map((s) => ({
        id: s.id,
        label: s.label,
        category: s.category,
        description: s.description,
        applicable: safe(`applies:${s.id}`, () => s.applies(ctx)) ?? false,
        autoApply: s.autoApply !== false
      }))
    })
  },
  applyStrategies(ids?: string[]): Promise<StrategyResult[]> {
    return withJava(() => applyStrategiesByIds(buildContext(), Array.isArray(ids) ? ids : []))
  },
  // Apply only the *safe* applicable strategies (Auto-Pwn selection). Kept
  // separate from profile() so the host can return the report even if
  // applying bypasses later destabilises the app.
  autoApply(): Promise<StrategyResult[]> {
    return withJava(() => autoApplyApplicable(buildContext()))
  },

  // --- Deep discovery & live tracing ---------------------------------
  listTracers(): Promise<TracerInfo[]> {
    return withJava(() => tracerList())
  },
  startTracer(id?: string): Promise<TracerInfo[]> {
    return withJava(() => {
      const tracer = id ? getTracer(id) : null
      if (tracer && !isTracerActive(tracer.id)) {
        const ctx = buildContext()
        safe(`tracer:${tracer.id}`, () => tracer.start(ctx))
        setTracerActive(tracer.id, true)
      }
      return tracerList()
    })
  },
  stopTracer(id?: string): Promise<TracerInfo[]> {
    return withJava(() => {
      const tracer = id ? getTracer(id) : null
      if (tracer && isTracerActive(tracer.id)) {
        safe(`tracer-stop:${tracer.id}`, () => tracer.stop())
        setTracerActive(tracer.id, false)
      }
      return tracerList()
    })
  },
  enumerateClasses(filter?: string, limit?: number): Promise<ClassSearchResult> {
    return withJava(() => enumerateClasses(buildContext(), filter ?? '', limit ?? 200))
  },
  listMethods(className?: string): Promise<ClassMethodInfo> {
    return withJava(() => listMethods(buildContext(), String(className ?? '')))
  },
  traceClass(className?: string): Promise<{ ok: boolean; hooked: number }> {
    return withJava(() => traceClass(buildContext(), String(className ?? '')))
  },
  untraceClass(className?: string): Promise<void> {
    return withJava(() => untraceClass(String(className ?? '')))
  },
  chooseInstances(className?: string, limit?: number): Promise<HeapInstance[]> {
    return withJava(() => chooseInstances(buildContext(), String(className ?? ''), limit ?? 10))
  },
  traceNative(moduleName?: string, symbol?: string): Promise<{ ok: boolean }> {
    return withJava(() => traceNative(String(moduleName ?? ''), String(symbol ?? '')))
  },
  untraceNative(moduleName?: string, symbol?: string): Promise<void> {
    return withJava(() => untraceNative(String(moduleName ?? ''), String(symbol ?? '')))
  },
  listActiveTraces(): Promise<ActiveTrace[]> {
    return withJava(() => {
      const out: ActiveTrace[] = []
      for (const t of getTracers()) {
        if (isTracerActive(t.id)) out.push({ id: t.id, kind: 'monitor', label: t.label })
      }
      for (const c of activeClassTraces()) out.push({ id: c, kind: 'class', label: c })
      for (const n of activeNativeTraces()) out.push({ id: n, kind: 'native', label: n })
      return out
    })
  },

  // --- Interactive REPL console -------------------------------------------
  async rpcEval(code: string): Promise<{ ok: boolean; value: string }> {
    try {
      // eval() runs in this script's JS context — has full access to Java,
      // Interceptor, Memory, Module, etc. Async expressions are awaited so
      // the host gets a resolved value (not a Promise object).
      // eslint-disable-next-line no-eval
      const raw: unknown = eval(code)
      const result = raw instanceof Promise ? await raw : raw
      return { ok: true, value: fridaStringify(result) }
    } catch (e) {
      return { ok: false, value: e instanceof Error ? e.message : String(e) }
    }
  }
}

emitReady(AGENT_API)
channel('system').info(`MobSec intelligence agent ${AGENT_VERSION} loaded (pid ${Process.id})`)

/** Serialize an arbitrary Frida-runtime value to a human-readable string.
 *  Handles Frida-specific types (NativePointer, etc.) that JSON.stringify
 *  would otherwise choke on or misrepresent. */
function fridaStringify(v: unknown): string {
  if (v === undefined) return 'undefined'
  if (v === null) return 'null'
  if (typeof v === 'boolean' || typeof v === 'number') return String(v)
  if (typeof v === 'string') return JSON.stringify(v)
  if (typeof v === 'function') return `[Function: ${(v as { name?: string }).name ?? 'anonymous'}]`
  try {
    return JSON.stringify(
      v,
      (_key, val: unknown) => {
        if (typeof val === 'function') return '[Function]'
        // NativePointer and similar Frida objects have meaningful toString()
        if (
          val !== null &&
          typeof val === 'object' &&
          !(Array.isArray(val)) &&
          Object.getPrototypeOf(val) !== Object.prototype
        ) {
          try {
            const s = String(val)
            if (s !== '[object Object]') return s
          } catch { /* keep original */ }
        }
        return val
      },
      2
    )
  } catch {
    return String(v)
  }
}
