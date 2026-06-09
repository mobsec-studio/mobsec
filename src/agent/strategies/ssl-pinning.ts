/**
 * Universal SSL/TLS pinning bypass.
 *
 * Layered so a hardened app with several mechanisms is fully covered, and
 * deliberately weighted toward *platform* choke-points (Conscrypt
 * TrustManagerImpl, SSLContext.init) that app obfuscation cannot rename —
 * that's the obfuscation-resilient layer. Pair with a system-trusted CA
 * for the cleanest results.
 *
 * Adapted/extended from the MobSec ssl-pinning-bypass built-in and
 * techniques in Frida CodeShare.
 */

import type { Strategy } from '../core/registry'
import type { ReconContext } from '../core/context'
import type { StrategyRun } from '../core/strategy'

let trustAll: Java.Wrapper | null = null

function trustAllManager(): Java.Wrapper {
  if (trustAll) return trustAll
  const X509TrustManager = Java.use('javax.net.ssl.X509TrustManager')
  trustAll = Java.registerClass({
    name: 'studio.mobsec.TrustAll',
    implements: [X509TrustManager],
    methods: {
      checkClientTrusted(): void {},
      checkServerTrusted(): void {},
      getAcceptedIssuers() {
        return []
      }
    }
  })
  return trustAll
}

export const sslPinningStrategy: Strategy = {
  id: 'ssl-pinning',
  label: 'SSL/TLS pinning bypass',
  category: 'ssl-pinning',
  description:
    'Neutralises certificate pinning across OkHttp 3/4, Conscrypt/TrustManagerImpl, WebView, custom X509TrustManagers, TrustKit and Network Security Config.',
  applies(ctx: ReconContext): boolean {
    // Always relevant — proxying HTTPS needs this, and the platform hooks
    // are harmless when no pinning is configured.
    void ctx
    return true
  },
  apply(ctx: ReconContext, run: StrategyRun): void {
    // 1. SSLContext.init — force every context to use a trust-all manager.
    run.hook('SSLContext.init(trust-all)', () => {
      const SSLContext = Java.use('javax.net.ssl.SSLContext')
      const init = SSLContext.init.overload(
        '[Ljavax.net.ssl.KeyManager;',
        '[Ljavax.net.ssl.TrustManager;',
        'java.security.SecureRandom'
      )
      init.implementation = function (km: unknown, _tm: unknown, sr: unknown) {
        init.call(this, km, [trustAllManager().$new()], sr)
      }
      run.note('SSLContext.init now installs a trust-all X509TrustManager')
    })

    // 2. AOSP Conscrypt TrustManagerImpl — the platform validation
    //    choke-point. Obfuscation-resilient: app code can't rename it.
    run.hook('Conscrypt TrustManagerImpl.checkTrustedRecursive', () => {
      const TMI = Java.use('com.android.org.conscrypt.TrustManagerImpl')
      const ArrayList = Java.use('java.util.ArrayList')
      TMI.checkTrustedRecursive.implementation = function () {
        return ArrayList.$new()
      }
      run.note('TrustManagerImpl.checkTrustedRecursive bypassed (system trust path)')
    })
    run.hook('Conscrypt TrustManagerImpl.verifyChain', () => {
      const TMI = Java.use('com.android.org.conscrypt.TrustManagerImpl')
      if (!TMI.verifyChain) return
      TMI.verifyChain.implementation = function (
        untrustedChain: unknown,
        _a: unknown,
        _b: unknown,
        _c: unknown,
        _d: unknown,
        _e: unknown
      ) {
        return untrustedChain
      }
    })

    // 3. OkHttp 3/4 + legacy embedded OkHttp.
    for (const cls of ['okhttp3.CertificatePinner', 'com.android.okhttp.CertificatePinner']) {
      run.hook(`${cls}.check*`, () => {
        const CP = ctx.useClass(cls)
        if (!CP) return
        for (const name of ['check', 'check$okhttp']) {
          const method = CP[name]
          if (!method || !method.overloads) continue
          method.overloads.forEach((ov: Java.Wrapper) => {
            ov.implementation = function () {
              return
            }
          })
        }
        run.note(`${cls}.check neutralised`)
      })
    }

    // 4. WebViewClient.onReceivedSslError → proceed.
    run.hook('WebViewClient.onReceivedSslError', () => {
      const WVC = Java.use('android.webkit.WebViewClient')
      WVC.onReceivedSslError.implementation = function (
        _view: unknown,
        handler: Java.Wrapper,
        _error: unknown
      ) {
        handler.proceed()
      }
    })

    // 5. HostnameVerifier — allow all.
    run.hook('HttpsURLConnection.setDefaultHostnameVerifier', () => {
      const HUC = Java.use('javax.net.ssl.HttpsURLConnection')
      const AllowAll = Java.registerClass({
        name: 'studio.mobsec.AllowAllHostnames',
        implements: [Java.use('javax.net.ssl.HostnameVerifier')],
        methods: {
          verify() {
            return true
          }
        }
      })
      HUC.setDefaultHostnameVerifier.implementation = function () {
        return
      }
      HUC.setHostnameVerifier.implementation = function () {
        this.setHostnameVerifier(AllowAll.$new())
      }
    })

    // 6. X509TrustManagerExtensions (used by some pinning libs).
    run.hook('X509TrustManagerExtensions.checkServerTrusted', () => {
      const Ext = ctx.useClass('android.net.http.X509TrustManagerExtensions')
      if (!Ext) return
      Ext.checkServerTrusted.implementation = function (chain: Java.Wrapper) {
        return chain
      }
    })

    // 7. TrustKit.
    run.hook('TrustKit OkHostnameVerifier', () => {
      const OHV = ctx.useClass('com.datatheorem.android.trustkit.pinning.OkHostnameVerifier')
      if (!OHV) return
      OHV.verify.overloads.forEach((ov: Java.Wrapper) => {
        ov.implementation = function () {
          return true
        }
      })
      run.note('TrustKit OkHostnameVerifier.verify → true')
    })

    // 8. Network Security Config — permit cleartext + relax checks.
    run.hook('NetworkSecurityConfig.isCleartextTrafficPermitted', () => {
      const NSC = ctx.useClass('android.security.net.config.NetworkSecurityConfig')
      if (!NSC) return
      NSC.isCleartextTrafficPermitted.overloads.forEach((ov: Java.Wrapper) => {
        ov.implementation = function () {
          return true
        }
      })
    })
  }
}
