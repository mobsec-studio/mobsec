// @name HTTP Logger (pre-TLS, no proxy needed)
// @description Logs every HTTP request and response at the Java API layer — *before* OkHttp / HttpURLConnection / Volley hands the bytes to the TLS engine. Catches traffic from apps that pin certificates or bypass the system proxy. Captures method, URL, headers, request body, response code, and response body (capped).

'use strict'

const MAX_BODY = 4096 // chars; truncate larger blobs

function whenJavaReady(cb) {
    whenJavaReady._attempts = (whenJavaReady._attempts || 0) + 1
    if (typeof Java !== 'undefined' && Java.available) {
        send('[http-log] Java VM ready after ' + whenJavaReady._attempts + ' attempts — installing hooks…')
        Java.perform(cb)
        return
    }
    if (whenJavaReady._attempts === 1) {
        send('[http-log] alive in pid ' + Process.id + ' (' + Process.arch + ') — waiting for ART…')
    }
    if (whenJavaReady._attempts > 600) {
        send('[http-log] gave up after 30 s: Java never became available. Try the Launch and attach run mode (more compatible than Spawn for hardened or multi-process apps).')
        return
    }
    setTimeout(() => whenJavaReady(cb), 50)
}

function clip(s) {
    if (!s) return ''
    return s.length > MAX_BODY ? s.slice(0, MAX_BODY) + '… (+' + (s.length - MAX_BODY) + ' chars)' : s
}

whenJavaReady(() => {
    send('[http-log] activating')

    // ---- OkHttp 3 / 4 (the de facto standard) ----------------------
    // We hook RealCall, the implementation behind every Call.execute()
    // and Call.enqueue() — both sync and async paths flow through it.
    try {
        const RealCall = Java.use('okhttp3.internal.connection.RealCall')
        const original = RealCall.execute
        original.implementation = function () {
            const req = this.originalRequest()
            const body = req.body()
            let bodyText = ''
            try {
                if (body) {
                    const Buffer = Java.use('okio.Buffer')
                    const buf = Buffer.$new()
                    body.writeTo(buf)
                    bodyText = clip(buf.readUtf8())
                }
            } catch (_e) { /* binary body / unreadable — skip */ }

            const headers = {}
            try {
                const names = req.headers().names().toArray()
                for (let i = 0; i < names.length; i++) {
                    const n = names[i]
                    headers[n] = req.header(n)
                }
            } catch (_e) { /* skip */ }

            send({
                kind: 'okhttp.request',
                method: req.method(),
                url: req.url().toString(),
                headers,
                body: bodyText
            })

            const response = original.call(this)
            try {
                let respBody = ''
                try {
                    const respBodyObj = response.peekBody(Java.use('java.lang.Long').$new(MAX_BODY).longValue())
                    respBody = clip(respBodyObj.string())
                } catch (_e) { /* skip */ }
                send({
                    kind: 'okhttp.response',
                    method: req.method(),
                    url: req.url().toString(),
                    code: response.code(),
                    body: respBody
                })
            } catch (e) {
                send('[http-log] response read: ' + e)
            }
            return response
        }
    } catch (e) {
        send('[http-log] OkHttp not found (or different version): ' + e)
    }

    // ---- HttpURLConnection (java.net + Android's HttpURLConnectionImpl)
    // Most pre-OkHttp code and some lightweight apps still use this.
    // We intercept the connect() / getResponseCode() pair via the
    // shared parent class.
    try {
        const URL = Java.use('java.net.URL')
        URL.openConnection.overload().implementation = function () {
            const conn = URL.openConnection.overload().call(this)
            send({ kind: 'urlconn.open', url: this.toString() })
            return conn
        }
    } catch (e) {
        send('[http-log] URL.openConnection hook: ' + e)
    }

    try {
        const HttpURLConnection = Java.use('java.net.HttpURLConnection')
        const getInputStream = HttpURLConnection.getInputStream
        getInputStream.implementation = function () {
            try {
                send({
                    kind: 'urlconn.exec',
                    method: this.getRequestMethod(),
                    url: this.getURL().toString(),
                    code: this.getResponseCode()
                })
            } catch (_e) { /* getResponseCode can throw on errors — fine */ }
            return getInputStream.call(this)
        }
    } catch (e) {
        send('[http-log] HttpURLConnection hook: ' + e)
    }

    // ---- WebView.loadUrl (a third common surface for HTTP traffic)
    try {
        const WebView = Java.use('android.webkit.WebView')
        WebView.loadUrl.overload('java.lang.String').implementation = function (url) {
            send({ kind: 'webview.load', url: String(url) })
            return this.loadUrl(url)
        }
    } catch (e) {
        // No WebView in this process — fine.
    }

    send('HTTP logger active')
})
