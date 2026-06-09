// @name SharedPreferences Logger
// @description Logs every SharedPreferences read and write. SharedPrefs is the lazy default place Android apps stash session tokens, feature flags, refresh keys, and (more often than they should) raw user credentials — surfacing every key/value as it happens skips the "where is this data?" guesswork.

'use strict'

function whenJavaReady(cb) {
    whenJavaReady._attempts = (whenJavaReady._attempts || 0) + 1
    if (typeof Java !== 'undefined' && Java.available) {
        send('[shared-prefs] Java VM ready after ' + whenJavaReady._attempts + ' attempts — installing hooks…')
        Java.perform(cb)
        return
    }
    if (whenJavaReady._attempts === 1) {
        send('[shared-prefs] alive in pid ' + Process.id + ' (' + Process.arch + ') — waiting for ART…')
    }
    if (whenJavaReady._attempts > 600) {
        send('[shared-prefs] gave up after 30 s: Java never became available. Try the Launch and attach run mode (more compatible than Spawn for hardened or multi-process apps).')
        return
    }
    setTimeout(() => whenJavaReady(cb), 50)
}

whenJavaReady(() => {
    send('[shared-prefs] activating')

    // Hook the concrete SharedPreferencesImpl (the singleton AOSP
    // implementation) — most apps use `Context.getSharedPreferences()`
    // which returns this class. Hooking the interface SharedPreferences
    // directly doesn't work because interfaces have no methods Frida
    // can replace.
    const readers = ['getString', 'getInt', 'getLong', 'getBoolean', 'getFloat', 'getStringSet']
    const writers = ['putString', 'putInt', 'putLong', 'putBoolean', 'putFloat', 'putStringSet', 'remove']

    try {
        const Impl = Java.use('android.app.SharedPreferencesImpl')
        for (const name of readers) {
            try {
                const method = Impl[name]
                if (!method) continue
                method.overloads.forEach((overload) => {
                    overload.implementation = function (key, defVal) {
                        const result = overload.apply(this, arguments)
                        // Trim long values so the console isn't spammed by
                        // multi-KB serialized blobs.
                        const v = result == null ? 'null' : String(result)
                        send({
                            kind: 'prefs.' + name,
                            key: String(key),
                            value: v.length > 200 ? v.slice(0, 200) + '… (+' + (v.length - 200) + ')' : v
                        })
                        return result
                    }
                })
            } catch (_e) {
                /* overload missing on this Android — fine */
            }
        }
    } catch (e) {
        send('[shared-prefs] SharedPreferencesImpl hook: ' + e)
    }

    try {
        const Editor = Java.use('android.app.SharedPreferencesImpl$EditorImpl')
        for (const name of writers) {
            try {
                const method = Editor[name]
                if (!method) continue
                method.overloads.forEach((overload) => {
                    overload.implementation = function (key, value) {
                        const v = value == null ? 'null' : String(value)
                        send({
                            kind: 'prefs.' + name,
                            key: String(key),
                            value: v.length > 200 ? v.slice(0, 200) + '… (+' + (v.length - 200) + ')' : v
                        })
                        return overload.apply(this, arguments)
                    }
                })
            } catch (_e) {
                /* overload missing — fine */
            }
        }
    } catch (e) {
        send('[shared-prefs] Editor hook: ' + e)
    }

    // EncryptedSharedPreferences (from androidx.security) wraps the
    // underlying file with AES-GCM. We hook the same interface but at a
    // different class path — apps that adopt it are exactly the ones
    // most worth observing.
    try {
        const Encrypted = Java.use('androidx.security.crypto.EncryptedSharedPreferences')
        for (const name of readers) {
            try {
                const method = Encrypted[name]
                if (!method) continue
                method.overloads.forEach((overload) => {
                    overload.implementation = function (key, defVal) {
                        const result = overload.apply(this, arguments)
                        const v = result == null ? 'null' : String(result)
                        send({
                            kind: 'encprefs.' + name,
                            key: String(key),
                            value: v.length > 200 ? v.slice(0, 200) + '…' : v
                        })
                        return result
                    }
                })
            } catch (_e) { /* missing — fine */ }
        }
    } catch (_e) {
        // androidx.security not bundled — fine
    }

    send('SharedPreferences logger active')
})
