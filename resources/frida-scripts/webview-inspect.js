// @name WebView Inspection
// @description Logs every WebView navigation: `loadUrl`, `loadData`, `loadDataWithBaseURL`, `evaluateJavascript`, and POST data sent through `postUrl`. Also forces WebView remote debugging on so chrome://inspect works.

'use strict'

// Wait for ART's Java bridge. On a Frida *spawn* the script loads before
// ART finishes initializing, so `Java` is undefined for a few hundred ms.
// Without this guard the very first `Java.perform` call throws
// "ReferenceError: 'Java' is not defined" before any hook installs.
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
    console.log('[webview-inspect] activating')

    try {
        const WebView = Java.use('android.webkit.WebView')

        // Force remote debugging so the host's Chrome can attach.
        try {
            WebView.setWebContentsDebuggingEnabled(true)
            console.log('[webview-inspect] WebView debugging enabled (chrome://inspect)')
        } catch (_e) {
            /* method requires API 19+; if missing we'll just see the warning */
        }

        WebView.loadUrl.overload('java.lang.String').implementation = function (url) {
            send({ kind: 'webview.loadUrl', url })
            return this.loadUrl(url)
        }
        WebView.loadUrl
            .overload('java.lang.String', 'java.util.Map')
            .implementation = function (url, headers) {
                send({ kind: 'webview.loadUrl', url, withHeaders: true })
                return this.loadUrl(url, headers)
            }
        WebView.loadData.overload(
            'java.lang.String',
            'java.lang.String',
            'java.lang.String'
        ).implementation = function (data, mime, encoding) {
            send({ kind: 'webview.loadData', mime, encoding, length: data.length })
            return this.loadData(data, mime, encoding)
        }
        WebView.loadDataWithBaseURL
            .overload(
                'java.lang.String',
                'java.lang.String',
                'java.lang.String',
                'java.lang.String',
                'java.lang.String'
            )
            .implementation = function (baseUrl, data, mime, encoding, historyUrl) {
                send({
                    kind: 'webview.loadDataWithBaseURL',
                    baseUrl,
                    mime,
                    encoding,
                    historyUrl,
                    length: data ? data.length : 0
                })
                return this.loadDataWithBaseURL(baseUrl, data, mime, encoding, historyUrl)
            }
        WebView.postUrl
            .overload('java.lang.String', '[B')
            .implementation = function (url, body) {
                const text = body ? Java.use('java.lang.String').$new(body) : ''
                send({ kind: 'webview.postUrl', url, body: text })
                return this.postUrl(url, body)
            }
        WebView.evaluateJavascript.implementation = function (script, callback) {
            send({
                kind: 'webview.evaluateJavascript',
                preview: script.length > 200 ? script.slice(0, 200) + '…' : script
            })
            return this.evaluateJavascript(script, callback)
        }
    } catch (e) {
        console.warn('[webview-inspect] WebView: ' + e)
    }

    // Bridge addJavascriptInterface — log the object class so we can see
    // what surface the page can call into.
    try {
        const WV = Java.use('android.webkit.WebView')
        WV.addJavascriptInterface.implementation = function (obj, name) {
            send({
                kind: 'webview.addJavascriptInterface',
                name,
                class: obj.getClass().getName()
            })
            return this.addJavascriptInterface(obj, name)
        }
    } catch (_e) {
        /* never invoked */
    }

    send('WebView inspection active')
})
