// @name SSL Pinning Bypass (universal)
// @description Neutralizes certificate pinning across OkHttp 3/4, Conscrypt, WebView, X509TrustManager, and the AOSP TrustManagerImpl. Works on modern Android (7+) when paired with a CA installed in the system trust store.
//
// Run via:  attach to the target app, load this script.
// Pair with:  the MobSec system-trust CA install (Proxy tab → mitmproxy CA).
//
// Adapted from techniques in Frida CodeShare, Pichu's universal bypass, and
// jiep's android-bypass-sslpinning collection.

'use strict'

// Wait for ART's Java bridge. On a Frida *spawn* the script loads before
// ART finishes initializing, so `Java` is undefined for a few hundred ms.
// Without this guard the very first `Java.perform` call throws
// "ReferenceError: 'Java' is not defined" before any hook installs.
//
// The bootstrap `send()` calls give the user something to look at in
// the console while we wait — a silent hang is much harder to debug
// than "we're polling, here's the count, here's the give-up."
function whenJavaReady(cb) {
    whenJavaReady._attempts = (whenJavaReady._attempts || 0) + 1
    if (typeof Java !== 'undefined' && Java.available) {
        send('[bootstrap] Java VM ready after ' + whenJavaReady._attempts + ' attempts — installing hooks…')
        Java.perform(cb)
        return
    }
    if (whenJavaReady._attempts === 1) {
        send('[bootstrap] script alive in pid ' + Process.id + ' (' + Process.arch + ') — waiting for ART…')
    }
    if (whenJavaReady._attempts > 600) {
        send('[bootstrap] gave up after 30 s: Java never became available. Try the Launch and attach run mode (more compatible than Spawn for hardened or multi-process apps). The app may not be using ART, or it died before the runtime initialized (anti-Frida apps often System.exit() right after the agent attaches).')
        return
    }
    setTimeout(() => whenJavaReady(cb), 50)
}

whenJavaReady(() => {
    console.log('[ssl-pinning] activating')

    // --- 1. X509TrustManager: implement an unconditional trust manager and
    //        force every initialised SSLContext to use it.
    try {
        const X509TrustManager = Java.use('javax.net.ssl.X509TrustManager')
        const SSLContext = Java.use('javax.net.ssl.SSLContext')
        const TrustManager = Java.registerClass({
            name: 'studio.mobsec.TrustAll',
            implements: [X509TrustManager],
            methods: {
                checkClientTrusted(_chain, _authType) {},
                checkServerTrusted(_chain, _authType) {},
                getAcceptedIssuers() {
                    return []
                }
            }
        })
        const initOverload = SSLContext.init.overload(
            '[Ljavax.net.ssl.KeyManager;',
            '[Ljavax.net.ssl.TrustManager;',
            'java.security.SecureRandom'
        )
        initOverload.implementation = function (kms, _tms, sr) {
            console.log('[ssl-pinning] forcing trust-all in SSLContext.init')
            initOverload.call(this, kms, [TrustManager.$new()], sr)
        }
    } catch (e) {
        console.warn('[ssl-pinning] X509TrustManager hook skipped: ' + e)
    }

    // --- 2. OkHttp 3 / 4: replace CertificatePinner.check with a no-op.
    for (const cls of [
        'okhttp3.CertificatePinner',
        'com.android.okhttp.CertificatePinner'
    ]) {
        try {
            const CertificatePinner = Java.use(cls)
            CertificatePinner.check.overload('java.lang.String', 'java.util.List').implementation =
                function (hostname) {
                    console.log('[ssl-pinning] OkHttp ' + cls + '.check bypassed for ' + hostname)
                }
        } catch (_e) {
            /* class not present in this app */
        }
    }

    // --- 3. WebViewClient.onReceivedSslError: tell the WebView the cert is fine.
    try {
        const WebViewClient = Java.use('android.webkit.WebViewClient')
        WebViewClient.onReceivedSslError.implementation = function (view, handler, _error) {
            console.log('[ssl-pinning] WebView SslError proceeded')
            handler.proceed()
        }
    } catch (_e) {
        /* no webview */
    }

    // --- 4. AOSP TrustManagerImpl (system trust store check). Replacing the
    //        return value of `checkTrustedRecursive` with the input chain
    //        makes the validator believe the chain is trusted.
    try {
        const TrustManagerImpl = Java.use('com.android.org.conscrypt.TrustManagerImpl')
        TrustManagerImpl.checkTrustedRecursive.implementation = function (
            certs,
            ocspData,
            tlsSctData,
            host,
            clientAuth,
            untrustedChain,
            trustAnchorChain,
            used
        ) {
            console.log('[ssl-pinning] TrustManagerImpl.checkTrustedRecursive bypassed for ' + host)
            return Java.use('java.util.ArrayList').$new()
        }
    } catch (_e) {
        /* TrustManagerImpl missing on this Android */
    }

    // --- 5. Network Security Config (Android 7+) — disable cleartext + pin checks.
    try {
        const NetworkSecurityConfig = Java.use('android.security.net.config.NetworkSecurityConfig')
        NetworkSecurityConfig.isCleartextTrafficPermitted.overload().implementation = () => true
        if (NetworkSecurityConfig.isCleartextTrafficPermitted.overload('java.lang.String')) {
            NetworkSecurityConfig.isCleartextTrafficPermitted.overload(
                'java.lang.String'
            ).implementation = () => true
        }
    } catch (_e) {
        /* NSC absent on this build */
    }

    send('SSL pinning bypass active')
})
