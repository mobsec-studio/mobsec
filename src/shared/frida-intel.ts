/**
 * Shared contract for the Frida Intelligence Engine.
 *
 * This file is the single source of truth for three otherwise-separate
 * worlds:
 *   - the injected Frida **agent** (src/agent/**, bundled by esbuild)
 *   - the **main** process control layer (src/main/services/frida.ts)
 *   - the **renderer** Intelligence UI (src/renderer/**)
 *
 * It must stay dependency-free — no node, electron, react, or frida-gum
 * imports — because it's compiled under every tsconfig in the repo
 * (node, web, and agent). Keep it to plain interfaces, unions, and a
 * couple of literal constants.
 */

/* ------------------------------------------------------------------ *
 * Structured agent → host message protocol
 * ------------------------------------------------------------------ *
 * The agent talks to the host through Frida's `send()`. Plain string
 * payloads (the format every existing built-in/CodeShare script uses)
 * keep flowing straight to the console untouched. Structured payloads
 * are tagged with `__mobsec: 1` so the host can recognise and route
 * them by `kind` without ever mistaking a user script's JSON for ours.
 */

/** Envelope discriminator. Bump only if the wire format changes shape. */
export const MOBSEC_ENVELOPE = 1 as const

/**
 * Logical streams the agent can log on. The console colour-codes and
 * filters by these; every channel still degrades to a plain console
 * line so nothing is ever lost.
 */
export type AgentChannel =
  | 'system' // bootstrap / lifecycle / rpc plumbing
  | 'recon' // reconnaissance progress
  | 'strategy' // adaptive strategy-engine decisions
  | 'bypass' // bypass arsenal actions
  | 'trace' // method / native tracing
  | 'crypto' // crypto monitor
  | 'storage' // storage monitor
  | 'network' // network monitor
  | 'ipc' // intent / IPC monitor
  | 'jni' // jni / native-bridge activity

export type AgentLogLevel = 'debug' | 'info' | 'warn' | 'error'

interface AgentEnvelope {
  __mobsec: typeof MOBSEC_ENVELOPE
  kind: string
}

/** A channel-tagged log line. Routed into the Frida console. */
export interface AgentLogMessage extends AgentEnvelope {
  kind: 'log'
  channel: AgentChannel
  level: AgentLogLevel
  text: string
  /** epoch ms, agent-side. */
  ts: number
}

/**
 * Emitted once the agent's rpc surface is wired up. Lets the host log a
 * crisp "agent ready (api: ping, profile, …)" instead of guessing.
 */
export interface AgentReadyMessage extends AgentEnvelope {
  kind: 'ready'
  api: string[]
  /** Agent build identifier, handy when debugging stale bundles. */
  agentVersion: string
}

/**
 * A discrete security-relevant observation the agent wants to surface
 * outside the recon report (e.g. a live pinning check it neutralised).
 * Reserved for later phases; defined now so the host router is stable.
 */
export interface AgentFindingMessage extends AgentEnvelope {
  kind: 'finding'
  channel: AgentChannel
  title: string
  detail: string
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical'
  ts: number
}

/**
 * A structured instrumentation event — the live "something changed in the
 * app" feed (a cipher call, a prefs write, an HTTP request, an intent, a
 * traced method). Rendered in the Live Events panel, not the text console.
 */
export interface AgentEventMessage extends AgentEnvelope {
  kind: 'event'
  channel: AgentChannel
  /** Coarse event type, e.g. `cipher`, `prefs.write`, `http`, `intent`, `method`. */
  category: string
  /** One-line headline shown in the table row. */
  summary: string
  /** Optional longer detail revealed when the row is expanded. */
  detail?: string
  /** Structured key/values (algorithm, key, url, class…) for filtering + actions. */
  meta?: Record<string, string>
  severity: 'info' | 'warn' | 'error'
  ts: number
}

export type AgentMessage =
  | AgentLogMessage
  | AgentReadyMessage
  | AgentFindingMessage
  | AgentEventMessage

/**
 * Renderer-facing live event (what the host forwards from the agent). The
 * store assigns a local incremental `id` for stable React keys.
 */
export interface FridaEvent {
  sessionId: string
  channel: AgentChannel
  category: string
  summary: string
  detail?: string
  meta?: Record<string, string>
  severity: 'info' | 'warn' | 'error'
  ts: number
}

/** Narrowing guard the host uses before routing a `send()` payload. */
export function isAgentMessage(payload: unknown): payload is AgentMessage {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    (payload as { __mobsec?: unknown }).__mobsec === MOBSEC_ENVELOPE &&
    typeof (payload as { kind?: unknown }).kind === 'string'
  )
}

/* ------------------------------------------------------------------ *
 * App Intelligence Report
 * ------------------------------------------------------------------ */

/**
 * The cross-platform application framework the app is built on. Detection
 * is evidence-based (native libs + marker classes), so `unknown` is a
 * legitimate, non-failure outcome for a heavily stripped app.
 */
export type FrameworkKind =
  | 'native-java' // plain Android (Java/Kotlin), no cross-platform runtime
  | 'flutter'
  | 'react-native'
  | 'xamarin' // Xamarin / .NET MAUI (Mono runtime)
  | 'unity-il2cpp'
  | 'unity-mono'
  | 'cordova' // Apache Cordova / PhoneGap
  | 'ionic' // Ionic (sits on Cordova or Capacitor)
  | 'capacitor'
  | 'kotlin-multiplatform'
  | 'nativescript'
  | 'qt'
  | 'unknown'

export interface FrameworkInfo {
  kind: FrameworkKind
  /** Human label, e.g. "Flutter", "React Native (Hermes)". */
  label: string
  /** 0..1 confidence from the detector that fired. */
  confidence: number
  /** Best-effort version string when we can read one, else null. */
  version: string | null
  /** What we matched on — lib names, class names, asset paths. */
  evidence: string[]
}

/** A networking client/stack the app links against. */
export interface NetworkingLib {
  /** Stable id, e.g. `okhttp3`, `cronet`, `httpurlconnection`, `dio`. */
  id: string
  label: string
  version: string | null
  evidence: string[]
}

export type CryptoCategory =
  | 'cipher'
  | 'digest'
  | 'mac'
  | 'signature'
  | 'keystore'
  | 'keygen'
  | 'random'
  | 'provider'

/** A cryptographic capability detected as present in the runtime. */
export interface CryptoUsage {
  id: string
  label: string
  category: CryptoCategory
  /** Concrete algorithm strings observed/available, e.g. `AES/GCM/NoPadding`. */
  algorithms: string[]
  /** True for deprecated/weak primitives (MD5, SHA-1, DES, ECB, RC4…). */
  weak: boolean
  evidence: string[]
}

/** A persistence/storage mechanism the app has wired up. */
export interface StorageLayer {
  id: string
  label: string
  /** Whether this layer is encrypted at rest (EncryptedSharedPreferences, SQLCipher…). */
  encrypted: boolean
  evidence: string[]
}

export type SecurityControlKind =
  | 'ssl-pinning'
  | 'root-detection'
  | 'emulator-detection'
  | 'debugger-detection'
  | 'frida-detection'
  | 'hook-detection'
  | 'integrity'
  | 'signature-verification'
  | 'biometric'
  | 'screenshot-block'
  | 'tamper-detection'
  | 'obfuscation'

/** A defensive control the app implements, with the concrete variant. */
export interface SecurityControl {
  id: string
  label: string
  kind: SecurityControlKind
  /** Concrete implementation, e.g. `okhttp-certificatepinner`, `rootbeer`, `play-integrity`. */
  variant: string | null
  confidence: number
  evidence: string[]
}

export type NativeLibCategory =
  | 'framework'
  | 'crypto'
  | 'security'
  | 'networking'
  | 'app'
  | 'system'
  | 'unknown'

export interface NativeLib {
  /** File name, e.g. `libflutter.so`. */
  name: string
  /** Full on-device path of the loaded module. */
  path: string
  /** Mapped size in bytes when Frida reports it, else null. */
  size: number | null
  category: NativeLibCategory
}

/** A class that declares one or more `native` (JNI) methods. */
export interface JniClassInfo {
  className: string
  methods: string[]
}

/** What the engine would auto-do next — an Auto-Pwn preview. */
export interface ReconRecommendation {
  /** Strategy id this maps to in the strategy engine. */
  strategyId: string
  label: string
  reason: string
  priority: 'high' | 'medium' | 'low'
}

export interface ReconRuntimeInfo {
  /** `java.vm.version`, e.g. "2.1.0". */
  vmVersion: string | null
  /** `java.vm.name`, e.g. "Dalvik". */
  vmName: string | null
  /** ApplicationInfo.FLAG_DEBUGGABLE on the running app, when readable. */
  isDebuggable: boolean | null
  /** Process appears to run under emulation/translation (heuristic). */
  emulated: boolean | null
}

export interface ReconClassSurvey {
  /** Total loaded classes Frida enumerated, null if enumeration skipped. */
  total: number | null
  /** Distinct top-level app package prefixes (e.g. `com.example`). */
  appPackages: string[]
  /** A capped sample of interesting (non-framework) class names. */
  sampled: string[]
  /** Heuristic: app classes look name-obfuscated (a/b/c, single chars). */
  obfuscated: boolean
}

/**
 * The full reconnaissance payload. Returned by the agent's `profile()`
 * rpc export, resolved back to the renderer, and the basis for the
 * exportable App Intelligence Report.
 */
export interface AppIntelligenceReport {
  /** Schema version of this report shape. */
  schema: 1
  /** ISO timestamp the report was generated. */
  generatedAt: string
  /** Target process id. */
  pid: number
  /** Package id when known (spawn/launch path), else null (raw attach). */
  identifier: string | null
  /** How the agent was injected for this report. */
  injection: 'attach' | 'spawn' | 'launch-attach' | 'unknown'

  device: {
    androidVersion: string | null
    apiLevel: number | null
    abi: string | null
  }
  runtime: ReconRuntimeInfo

  /** Primary framework verdict (highest-confidence detector). */
  framework: FrameworkInfo
  /** Every framework signal we saw (a Cordova webview inside native, etc.). */
  frameworks: FrameworkInfo[]

  networking: NetworkingLib[]
  crypto: CryptoUsage[]
  storage: StorageLayer[]
  security: SecurityControl[]
  nativeLibs: NativeLib[]
  classes: ReconClassSurvey
  jni: {
    nativeMethodCount: number | null
    classes: JniClassInfo[]
  }
  dynamicDex: {
    loaded: boolean
    sources: string[]
  }

  /** Auto-Pwn preview: what the strategy engine would apply. */
  recommendations: ReconRecommendation[]
  /** Detectors that errored or were skipped — never fatal. */
  warnings: string[]
  /** Total wall-clock the agent spent profiling, ms. */
  durationMs: number
}

/** Host-side wrapper returned by the `reconnaissance()` control call. */
export interface ReconResult {
  sessionId: string
  report: AppIntelligenceReport
}

/* ------------------------------------------------------------------ *
 * Adaptive Strategy Engine / Bypass Arsenal / Auto-Pwn
 * ------------------------------------------------------------------ */

/**
 * Result of a strategy's optional in-process active check — e.g. after
 * neutralising root detection, call RootBeer.isRooted() and confirm it
 * now returns false. Cheap and side-effect-free by contract; never makes
 * network calls or anything that could hang.
 */
export interface StrategyVerification {
  ran: boolean
  ok: boolean
  detail: string
}

/** Outcome of applying one bypass/instrumentation strategy. */
export interface StrategyResult {
  id: string
  label: string
  category: SecurityControlKind
  /** True if the strategy installed at least one hook (or was already active). */
  applied: boolean
  /** True if a previous apply in this session already installed it. */
  alreadyActive: boolean
  /** Count of individual hook points installed. */
  hooksInstalled: number
  /** Human-readable notes on what was patched. */
  notes: string[]
  /** Non-fatal per-hook errors (a missing overload, an absent class…). */
  errors: string[]
  /** Active-verification outcome, or null when the strategy has no verifier. */
  verification: StrategyVerification | null
}

/** Metadata describing an available strategy (for the UI checklist). */
export interface StrategyInfo {
  id: string
  label: string
  category: SecurityControlKind
  description: string
  /** Whether this strategy is relevant for the current target. */
  applicable: boolean
  /**
   * Whether Auto-Pwn applies this automatically. False for risky/native
   * strategies (global libc hooks, BoringSSL patching) that can destabilise
   * an app — those are manual-only and shown with a warning in the UI.
   */
  autoApply: boolean
}

/** Host-side wrapper returned by `autoPwn()`. */
export interface AutoPwnResult {
  sessionId: string
  report: AppIntelligenceReport
  results: StrategyResult[]
}

/** Host-side wrapper returned by `applyStrategies()`. */
export interface ApplyStrategiesResult {
  sessionId: string
  results: StrategyResult[]
}

/* ------------------------------------------------------------------ *
 * Deep Discovery & Live Tracing (P4)
 * ------------------------------------------------------------------ */

/** A toggleable live monitor (crypto/storage/network/ipc). */
export interface TracerInfo {
  id: string
  label: string
  description: string
  channel: AgentChannel
  active: boolean
}

export interface MethodInfo {
  name: string
  /** Reflected signature, e.g. `byte[] doFinal(byte[])`. */
  signature: string
  static: boolean
}

export interface ClassMethodInfo {
  className: string
  superclass: string | null
  methods: MethodInfo[]
}

/** Result of a class-name search over the loaded classes. */
export interface ClassSearchResult {
  classes: string[]
  total: number
  truncated: boolean
}

export interface HeapField {
  name: string
  type: string
  value: string
}

/** A live instance snapshot from the heap explorer. */
export interface HeapInstance {
  /** Identity hash (hex) for reference. */
  handle: string
  summary: string
  fields: HeapField[]
}

/** An active class/native trace, for the "stop" list. */
export interface ActiveTrace {
  id: string
  kind: 'monitor' | 'class' | 'native'
  label: string
}

/**
 * A saved, replayable instrumentation recipe for an app: which bypass
 * strategies to apply and which live monitors to enable. Keyed by package
 * so the same setup can be re-applied across sessions in one click.
 */
export interface FridaPreset {
  id: string
  /** Package id this preset targets (or '*' for any app). */
  packageName: string
  name: string
  strategyIds: string[]
  monitorIds: string[]
  createdAt: string
  updatedAt: string
}
