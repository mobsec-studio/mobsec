/**
 * Runtime surveys that aren't tied to a single detector: device/runtime
 * facts, native-library categorisation, the loaded-class survey, a bounded
 * JNI scan, and dynamic-DEX detection. All are best-effort and bounded —
 * a survey that can't complete returns partial data plus a warning, never
 * an exception.
 */

import type {
  JniClassInfo,
  NativeLib,
  NativeLibCategory,
  ReconClassSurvey,
  ReconRuntimeInfo
} from '@shared/frida-intel'
import type { ReconContext } from '../core/context'
import { safe, safeOr } from '../core/safe'

const ACC_NATIVE = 0x0100 // java.lang.reflect.Modifier.NATIVE bit

const FRAMEWORK_PREFIXES = [
  'android.',
  'androidx.',
  'java.',
  'javax.',
  'kotlin.',
  'kotlinx.',
  'dalvik.',
  'libcore.',
  'sun.',
  'org.json.',
  'org.w3c.',
  'org.xml',
  'j$.',
  'com.android.',
  'com.google.android.',
  'com.google.common.',
  'org.chromium.'
]

function isFrameworkClass(name: string): boolean {
  for (const p of FRAMEWORK_PREFIXES) {
    if (name.indexOf(p) === 0) return true
  }
  return false
}

function topPackage(className: string): string {
  const parts = className.split('.')
  if (parts.length <= 1) return className
  if (parts.length === 2) return parts[0] ?? className
  return `${parts[0]}.${parts[1]}`
}

export function readDeviceInfo(ctx: ReconContext): {
  androidVersion: string | null
  apiLevel: number | null
  abi: string | null
} {
  return safeOr<{ androidVersion: string | null; apiLevel: number | null; abi: string | null }>(
    { androidVersion: null, apiLevel: null, abi: null },
    () => {
      const Build = ctx.useClass('android.os.Build')
      const VERSION = ctx.useClass('android.os.Build$VERSION')
      const androidVersion = VERSION ? (String(VERSION.RELEASE.value) || null) : null
      const apiLevel = VERSION ? Number(VERSION.SDK_INT.value) : null
      let abi: string | null = null
      if (Build) {
        const abis = safeOr<string | null>(null, () => {
          const arr = Build.SUPPORTED_ABIS.value as string[]
          return arr && arr.length > 0 ? arr[0] ?? null : null
        })
        abi = abis ?? safeOr<string | null>(null, () => String(Build.CPU_ABI.value) || null)
      }
      return {
        androidVersion,
        apiLevel: apiLevel != null && !Number.isNaN(apiLevel) ? apiLevel : null,
        abi
      }
    }
  )
}

export function readRuntimeInfo(ctx: ReconContext): ReconRuntimeInfo {
  const System = ctx.useClass('java.lang.System')
  const prop = (key: string): string | null =>
    safeOr<string | null>(null, () => {
      if (!System) return null
      const v = System.getProperty(key) as string
      return v && v.length > 0 ? v : null
    })

  const isDebuggable = safeOr<boolean | null>(null, () => {
    const ActivityThread = ctx.useClass('android.app.ActivityThread')
    if (!ActivityThread) return null
    const app = ActivityThread.currentApplication()
    if (app == null) return null
    const info = app.getApplicationContext().getApplicationInfo()
    const flags = Number(info.flags.value)
    return (flags & 0x2) !== 0 // ApplicationInfo.FLAG_DEBUGGABLE
  })

  const emulated = safeOr<boolean | null>(null, () => {
    const qemu = ctx.systemProperty('ro.kernel.qemu')
    const hardware = (ctx.systemProperty('ro.hardware') ?? '').toLowerCase()
    const product = (ctx.systemProperty('ro.product.name') ?? '').toLowerCase()
    if (qemu === '1') return true
    if (hardware.indexOf('goldfish') !== -1 || hardware.indexOf('ranchu') !== -1) return true
    if (hardware.indexOf('vbox') !== -1 || hardware.indexOf('ttvm') !== -1) return true
    if (product.indexOf('sdk') !== -1 || product.indexOf('emulator') !== -1) return true
    return false
  })

  return {
    vmVersion: prop('java.vm.version'),
    vmName: prop('java.vm.name'),
    isDebuggable,
    emulated
  }
}

function categorizeLib(name: string, path: string): NativeLibCategory {
  const n = name.toLowerCase()
  if (
    /(libflutter|libreactnativejni|libhermes|libjsc|libil2cpp|libunity|libmono|libmonodroid|libxamarin|libnativescript|libqt5android|libqt6android|libnode)/.test(
      n
    )
  ) {
    return 'framework'
  }
  if (
    /(libjiagu|libdexhelper|libsecshell|libsecmain|libsecexe|libtup|libtprt|libtosprotection|libnesec|libnqshield|libsgmain|libsgsecuritybody|libmobisec|libexecmain|libdexprotector|libcovault|libapssec|libchaosvmp)/.test(
      n
    )
  ) {
    return 'security'
  }
  if (/(libcrypto|libssl|libconscrypt|libsqlcipher|libtink|libsignal)/.test(n)) return 'crypto'
  if (/(libcronet|libgrpc)/.test(n)) return 'networking'

  const p = path.toLowerCase()
  if (
    p.indexOf('/system/') === 0 ||
    p.indexOf('/apex/') === 0 ||
    p.indexOf('/vendor/') === 0 ||
    p.indexOf('/odm/') === 0 ||
    p.indexOf('/product/') === 0 ||
    n === 'linker' ||
    n === 'linker64'
  ) {
    return 'system'
  }
  if (p.indexOf('/data/app') !== -1 || p.indexOf('/data/data') !== -1 || p.indexOf('/data/user') !== -1) {
    return 'app'
  }
  return 'unknown'
}

/** Categorised native libs, dropping plain system libs to stay readable. */
export function surveyNatives(ctx: ReconContext): NativeLib[] {
  const out: NativeLib[] = []
  for (const m of ctx.modules) {
    const category = categorizeLib(m.name, m.path)
    if (category === 'system') continue
    out.push({ name: m.name, path: m.path, size: m.size, category })
    if (out.length >= 250) break
  }
  return out
}

export function surveyClasses(ctx: ReconContext): ReconClassSurvey {
  const loaded = ctx.loadedClasses()
  if (loaded.length === 0) {
    return { total: null, appPackages: [], sampled: [], obfuscated: false }
  }

  const appClasses: string[] = []
  for (const c of loaded) {
    if (!isFrameworkClass(c)) appClasses.push(c)
  }

  // Tally top-level app packages.
  const counts = new Map<string, number>()
  for (const c of appClasses) {
    const pkg = topPackage(c)
    counts.set(pkg, (counts.get(pkg) ?? 0) + 1)
  }
  const appPackages = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map((e) => e[0])

  // Obfuscation heuristic: many app classes with ultra-short simple names.
  let shortNamed = 0
  for (const c of appClasses) {
    const simple = c.substring(c.lastIndexOf('.') + 1)
    const base = simple.split('$').pop() ?? simple
    if (base.length <= 2) shortNamed += 1
  }
  const obfuscated = appClasses.length >= 25 && shortNamed / appClasses.length > 0.3

  return {
    total: loaded.length,
    appPackages,
    sampled: appClasses.slice(0, 40),
    obfuscated
  }
}

/**
 * Bounded JNI scan: reflect over loaded *app* classes looking for native
 * methods. Capped by class count and a wall-clock budget so a huge app
 * never stalls recon. The NATIVE modifier is tested with a bitmask to
 * avoid a cross-VM call per method.
 */
export function surveyJni(
  ctx: ReconContext,
  appPackages: string[]
): { nativeMethodCount: number | null; classes: JniClassInfo[]; warning: string | null } {
  const loaded = ctx.loadedClasses()
  if (loaded.length === 0) return { nativeMethodCount: null, classes: [], warning: null }

  const prefixes = appPackages.map((p) => p + '.')
  const isApp = (name: string): boolean => {
    if (isFrameworkClass(name)) return false
    if (prefixes.length === 0) return true
    for (const p of prefixes) if (name.indexOf(p) === 0) return true
    return false
  }

  const MAX_CLASSES = 80
  const TIME_BUDGET_MS = 700
  const started = Date.now()

  let nativeMethodCount = 0
  const classes: JniClassInfo[] = []
  let scanned = 0
  let truncated = false

  for (const className of loaded) {
    if (!isApp(className)) continue
    if (scanned >= MAX_CLASSES || Date.now() - started > TIME_BUDGET_MS) {
      truncated = true
      break
    }
    scanned += 1

    safe(`jni:${className}`, () => {
      const wrapper = ctx.useClass(className)
      if (!wrapper) return
      const methods = wrapper.class.getDeclaredMethods() as Java.Wrapper[]
      const nativeNames: string[] = []
      for (let i = 0; i < methods.length; i++) {
        const m = methods[i]
        if (!m) continue
        const mods = Number(m.getModifiers())
        if ((mods & ACC_NATIVE) !== 0) {
          nativeMethodCount += 1
          if (nativeNames.length < 8) nativeNames.push(String(m.getName()))
        }
      }
      if (nativeNames.length > 0 && classes.length < 40) {
        classes.push({ className, methods: nativeNames })
      }
    })
  }

  return {
    nativeMethodCount,
    classes,
    warning: truncated
      ? `JNI scan truncated after ${scanned} classes (cap/${TIME_BUDGET_MS}ms budget); counts are a lower bound.`
      : null
  }
}

/** Detect dynamic code loading via the live class loaders. */
export function surveyDynamicDex(): { loaded: boolean; sources: string[] } {
  return safeOr<{ loaded: boolean; sources: string[] }>({ loaded: false, sources: [] }, () => {
    const loaders = Java.enumerateClassLoadersSync()
    const sources: string[] = []
    let dynamic = false
    for (let i = 0; i < loaders.length; i++) {
      const loader = loaders[i]
      if (!loader) continue
      const cls = safeOr<string>('', () => String(loader.getClass().getName()))
      if (cls.indexOf('InMemoryDexClassLoader') !== -1 || cls.indexOf('DexClassLoader') !== -1) {
        dynamic = true
        const desc = safeOr<string>(cls, () => String(loader.toString()))
        const trimmed = desc.length > 200 ? desc.slice(0, 200) + '…' : desc
        if (sources.indexOf(trimmed) === -1 && sources.length < 8) sources.push(trimmed)
      }
    }
    return { loaded: dynamic, sources }
  })
}
