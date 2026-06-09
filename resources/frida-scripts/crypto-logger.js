// @name Crypto Operations Logger
// @description Logs every Cipher init/update/doFinal, MessageDigest input, Mac signing, KeyGenerator output, and SecretKeySpec construction. Captures the keys + IVs apps use at runtime — exactly what you want when reverse-engineering encrypted local storage or custom payload formats.

'use strict'

function bytesToHex(bytes) {
    if (!bytes) return ''
    const out = []
    for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i] & 0xff
        out.push(b < 16 ? '0' + b.toString(16) : b.toString(16))
    }
    return out.join('')
}

function bytesPreview(bytes, max) {
    if (!bytes) return ''
    if (bytes.length <= max) return bytesToHex(bytes)
    return bytesToHex(bytes.slice(0, max)) + '…(' + bytes.length + ' bytes)'
}

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
    console.log('[crypto] activating')

    const PREVIEW_BYTES = 64

    // Cipher
    try {
        const Cipher = Java.use('javax.crypto.Cipher')

        Cipher.init.overload('int', 'java.security.Key').implementation = function (mode, key) {
            send({
                kind: 'cipher.init',
                algorithm: this.getAlgorithm(),
                mode,
                keyClass: key ? key.getAlgorithm() : null
            })
            return this.init(mode, key)
        }
        Cipher.init
            .overload('int', 'java.security.Key', 'java.security.spec.AlgorithmParameterSpec')
            .implementation = function (mode, key, spec) {
                send({
                    kind: 'cipher.init',
                    algorithm: this.getAlgorithm(),
                    mode,
                    keyClass: key ? key.getAlgorithm() : null,
                    spec: spec ? spec.getClass().getName() : null
                })
                return this.init(mode, key, spec)
            }

        Cipher.doFinal.overload('[B').implementation = function (input) {
            const result = this.doFinal(input)
            send({
                kind: 'cipher.doFinal',
                algorithm: this.getAlgorithm(),
                input: bytesPreview(input, PREVIEW_BYTES),
                output: bytesPreview(result, PREVIEW_BYTES)
            })
            return result
        }
        Cipher.doFinal.overload().implementation = function () {
            const result = this.doFinal()
            send({
                kind: 'cipher.doFinal',
                algorithm: this.getAlgorithm(),
                output: bytesPreview(result, PREVIEW_BYTES)
            })
            return result
        }
    } catch (e) {
        console.warn('[crypto] Cipher: ' + e)
    }

    // MessageDigest (MD5, SHA-256, …)
    try {
        const MessageDigest = Java.use('java.security.MessageDigest')
        MessageDigest.update.overload('[B').implementation = function (input) {
            send({
                kind: 'digest.update',
                algorithm: this.getAlgorithm(),
                input: bytesPreview(input, PREVIEW_BYTES)
            })
            return this.update(input)
        }
        MessageDigest.digest.overload('[B').implementation = function (input) {
            const result = this.digest(input)
            send({
                kind: 'digest.digest',
                algorithm: this.getAlgorithm(),
                input: bytesPreview(input, PREVIEW_BYTES),
                output: bytesToHex(result)
            })
            return result
        }
    } catch (e) {
        console.warn('[crypto] MessageDigest: ' + e)
    }

    // Mac (HMAC)
    try {
        const Mac = Java.use('javax.crypto.Mac')
        Mac.doFinal.overload('[B').implementation = function (input) {
            const result = this.doFinal(input)
            send({
                kind: 'mac.doFinal',
                algorithm: this.getAlgorithm(),
                input: bytesPreview(input, PREVIEW_BYTES),
                output: bytesToHex(result)
            })
            return result
        }
    } catch (e) {
        console.warn('[crypto] Mac: ' + e)
    }

    // SecretKeySpec — surfaces the raw bytes the app uses to build keys.
    try {
        const SecretKeySpec = Java.use('javax.crypto.spec.SecretKeySpec')
        SecretKeySpec.$init.overload('[B', 'java.lang.String').implementation = function (
            keyBytes,
            algorithm
        ) {
            send({
                kind: 'secretKeySpec',
                algorithm,
                key: bytesToHex(keyBytes),
                length: keyBytes.length
            })
            return this.$init(keyBytes, algorithm)
        }
    } catch (e) {
        console.warn('[crypto] SecretKeySpec: ' + e)
    }

    // IvParameterSpec — same idea for IVs.
    try {
        const IvParameterSpec = Java.use('javax.crypto.spec.IvParameterSpec')
        IvParameterSpec.$init.overload('[B').implementation = function (iv) {
            send({ kind: 'ivParameterSpec', iv: bytesToHex(iv) })
            return this.$init(iv)
        }
    } catch (_e) {
        /* not used */
    }

    send('Crypto logger active')
})
