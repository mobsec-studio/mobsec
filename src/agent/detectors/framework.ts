/**
 * Cross-platform framework detector.
 *
 * Detection is evidence-based: a native runtime library (libflutter.so,
 * libil2cpp.so…) plus, where possible, a marker class. Native-lib matches
 * are the strongest signal because the .so is present regardless of how
 * aggressively the Java/Dex layer is obfuscated. We may emit several
 * framework signals (a Cordova WebView embedded in an otherwise native
 * app is real); the orchestrator picks the highest-confidence one as the
 * primary verdict.
 */

import type { Detector } from '../core/registry'
import type { ReconContext } from '../core/context'
import type { ReportBuilder } from '../core/report'
import { safeOr } from '../core/safe'

function reactNativeVersion(ctx: ReconContext): string | null {
  return safeOr<string | null>(null, () => {
    const V = ctx.useClass('com.facebook.react.modules.systeminfo.ReactNativeVersion')
    if (!V) return null
    // VERSION is a static Map<String,Object> with major/minor/patch keys.
    const map = V.VERSION.value
    if (!map) return null
    const major = map.get('major')
    const minor = map.get('minor')
    const patch = map.get('patch')
    if (major == null) return null
    return `${major}.${minor ?? 0}.${patch ?? 0}`
  })
}

export const frameworkDetector: Detector = {
  id: 'framework',
  priority: 100,
  detect(ctx: ReconContext, out: ReportBuilder): void {
    let crossPlatform = false

    // --- Flutter -----------------------------------------------------
    const flutterLib = ctx.hasModule('libflutter.so')
    const flutterClass =
      ctx.hasClass('io.flutter.embedding.engine.FlutterJNI') ||
      ctx.hasClass('io.flutter.app.FlutterApplication')
    if (flutterLib || flutterClass) {
      crossPlatform = true
      const evidence: string[] = []
      if (flutterLib) evidence.push('libflutter.so loaded')
      if (flutterClass) evidence.push('io.flutter.* classes present')
      out.addFramework({
        kind: 'flutter',
        label: 'Flutter',
        confidence: flutterLib && flutterClass ? 0.98 : 0.92,
        version: null,
        evidence
      })
    }

    // --- React Native ------------------------------------------------
    const rnLib = ctx.hasModule('libreactnativejni') || ctx.hasModule('libhermes')
    const rnClass =
      ctx.hasClass('com.facebook.react.bridge.CatalystInstanceImpl') ||
      ctx.hasClass('com.facebook.react.ReactRootView')
    if (rnLib || rnClass) {
      crossPlatform = true
      const hermes = ctx.hasModule('libhermes')
      const evidence: string[] = []
      if (rnLib) evidence.push(hermes ? 'libhermes.so loaded' : 'libreactnativejni.so loaded')
      if (rnClass) evidence.push('com.facebook.react.* bridge present')
      out.addFramework({
        kind: 'react-native',
        label: hermes ? 'React Native (Hermes)' : 'React Native',
        confidence: rnLib && rnClass ? 0.98 : 0.92,
        version: reactNativeVersion(ctx),
        evidence
      })
    }

    // --- Unity (IL2CPP vs Mono) -------------------------------------
    const il2cpp = ctx.hasModule('libil2cpp.so')
    const unity = ctx.hasModule('libunity.so')
    const monoLib = ctx.hasModule('libmono') // libmonosgen / libmonobdwgc
    if (il2cpp) {
      crossPlatform = true
      out.addFramework({
        kind: 'unity-il2cpp',
        label: 'Unity (IL2CPP)',
        confidence: 0.97,
        version: null,
        evidence: ['libil2cpp.so loaded', unity ? 'libunity.so loaded' : '']
          .filter(Boolean)
      })
    } else if (unity && monoLib) {
      crossPlatform = true
      out.addFramework({
        kind: 'unity-mono',
        label: 'Unity (Mono)',
        confidence: 0.95,
        version: null,
        evidence: ['libunity.so loaded', 'libmono*.so loaded']
      })
    }

    // --- Xamarin / .NET MAUI ----------------------------------------
    const xamarinLib =
      ctx.hasModule('libmonodroid') || ctx.hasModule('libxamarin') || ctx.hasModule('libmono-android')
    const xamarinClass =
      ctx.hasClass('mono.android.app.Application') || ctx.hasClass('mono.MonoPackageManager')
    if ((xamarinLib || xamarinClass) && !il2cpp && !unity) {
      crossPlatform = true
      const evidence: string[] = []
      if (xamarinLib) evidence.push('libmonodroid/libxamarin loaded')
      if (xamarinClass) evidence.push('mono.android.* present')
      out.addFramework({
        kind: 'xamarin',
        label: 'Xamarin / .NET MAUI',
        confidence: 0.95,
        version: null,
        evidence
      })
    }

    // --- NativeScript ------------------------------------------------
    if (ctx.hasModule('libNativeScript') || ctx.hasClass('com.tns.NativeScriptApplication')) {
      crossPlatform = true
      out.addFramework({
        kind: 'nativescript',
        label: 'NativeScript',
        confidence: 0.95,
        version: null,
        evidence: ['NativeScript runtime present']
      })
    }

    // --- Qt ----------------------------------------------------------
    if (
      ctx.hasModule('libQt5Android') ||
      ctx.hasModule('libQt6Android') ||
      ctx.hasClass('org.qtproject.qt.android.QtActivity') ||
      ctx.hasClass('org.qtproject.qt5.android.QtActivity')
    ) {
      crossPlatform = true
      out.addFramework({
        kind: 'qt',
        label: 'Qt for Android',
        confidence: 0.94,
        version: null,
        evidence: ['Qt Android runtime present']
      })
    }

    // --- Capacitor / Cordova / Ionic (WebView shells) ---------------
    if (ctx.hasClass('com.getcapacitor.BridgeActivity') || ctx.hasClass('com.getcapacitor.Bridge')) {
      crossPlatform = true
      const ionic = ctx.hasClass('io.ionic.starter.MainActivity')
      out.addFramework({
        kind: ionic ? 'ionic' : 'capacitor',
        label: ionic ? 'Ionic (Capacitor)' : 'Capacitor',
        confidence: 0.95,
        version: null,
        evidence: ['com.getcapacitor.* present', ionic ? 'io.ionic.* present' : ''].filter(Boolean)
      })
    } else if (
      ctx.hasClass('org.apache.cordova.CordovaActivity') ||
      ctx.hasClass('org.apache.cordova.engine.SystemWebViewEngine')
    ) {
      crossPlatform = true
      out.addFramework({
        kind: 'cordova',
        label: 'Apache Cordova / PhoneGap',
        confidence: 0.94,
        version: null,
        evidence: ['org.apache.cordova.* present']
      })
    }

    // --- Fallback: plain native Android -----------------------------
    // Only when no cross-platform runtime fired. Confidence reflects that
    // this is the "nothing exotic detected" verdict, not a positive ID.
    if (!crossPlatform) {
      const kotlin = ctx.hasClass('kotlin.jvm.internal.Intrinsics')
      out.addFramework({
        kind: 'native-java',
        label: kotlin ? 'Native Android (Kotlin)' : 'Native Android (Java)',
        confidence: 0.6,
        version: null,
        evidence: [
          'No cross-platform runtime detected',
          kotlin ? 'Kotlin stdlib present' : 'Java/Android classes only'
        ]
      })
    }
  }
}
