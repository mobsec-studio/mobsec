// @name Emulator Detection Bypass
// @description Masks `Build.*` emulator fingerprints (sdk_gphone, ranchu, goldfish), `ro.kernel.qemu`, sensor counts, and TelephonyManager identifiers so anti-emulator checks pass.

'use strict'

const FAKE_BUILD = {
    BRAND: 'google',
    DEVICE: 'redfin',
    FINGERPRINT: 'google/redfin/redfin:13/TQ3A.230901.001.B1/10750268:user/release-keys',
    HARDWARE: 'qcom',
    MANUFACTURER: 'Google',
    MODEL: 'Pixel 5',
    PRODUCT: 'redfin',
    BOARD: 'redfin',
    BOOTLOADER: 'M842A.310914.001',
    HOST: 'abfarm-redfin',
    USER: 'android-build',
    TAGS: 'release-keys',
    TYPE: 'user'
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
    console.log('[emu-bypass] activating')

    // Build.* fields
    try {
        const Build = Java.use('android.os.Build')
        for (const [name, value] of Object.entries(FAKE_BUILD)) {
            try {
                const field = Build.class.getDeclaredField(name)
                field.setAccessible(true)
                field.set(null, value)
                console.log('[emu-bypass] Build.' + name + ' → ' + value)
            } catch (_e) {
                /* field missing on this AOSP version */
            }
        }
    } catch (e) {
        console.warn('[emu-bypass] Build: ' + e)
    }

    // SystemProperties (ro.kernel.qemu, ro.boot.* etc.)
    try {
        const SystemProperties = Java.use('android.os.SystemProperties')
        const overrides = {
            'ro.kernel.qemu': '0',
            'ro.kernel.qemu.gles': '0',
            'ro.hardware': 'qcom',
            'ro.product.device': 'redfin',
            'ro.product.model': 'Pixel 5',
            'ro.product.brand': 'google',
            'ro.product.manufacturer': 'Google',
            'ro.build.fingerprint': FAKE_BUILD.FINGERPRINT,
            'ro.build.tags': 'release-keys',
            'ro.bootloader': FAKE_BUILD.BOOTLOADER,
            'ro.bootmode': 'unknown',
            'ro.boot.qemu': '0',
            'ro.boot.hardware': 'qcom',
            'init.svc.qemud': 'stopped',
            'init.svc.qemu-props': 'stopped',
            'qemu.hw.mainkeys': '0'
        }
        SystemProperties.get.overload('java.lang.String').implementation = function (key) {
            if (key in overrides) return overrides[key]
            return this.get.overload('java.lang.String').call(this, key)
        }
        SystemProperties.get.overload('java.lang.String', 'java.lang.String').implementation =
            function (key, def) {
                if (key in overrides) return overrides[key]
                return this.get.overload('java.lang.String', 'java.lang.String').call(this, key, def)
            }
    } catch (e) {
        console.warn('[emu-bypass] SystemProperties: ' + e)
    }

    // TelephonyManager — emulators report imei "000000…" and operator "Android".
    try {
        const Telephony = Java.use('android.telephony.TelephonyManager')
        const fake = {
            getDeviceId: '352099001761481',
            getImei: '352099001761481',
            getSimSerialNumber: '8990110000000000000',
            getSubscriberId: '310260000000000',
            getLine1Number: '+15555550000',
            getNetworkOperatorName: 'Verizon',
            getSimOperatorName: 'Verizon'
        }
        for (const [name, value] of Object.entries(fake)) {
            try {
                Telephony[name].overloads.forEach((m) => {
                    m.implementation = function () {
                        console.log('[emu-bypass] Telephony.' + name + ' → ' + value)
                        return value
                    }
                })
            } catch (_e) {
                /* method may be unavailable on this Android */
            }
        }
    } catch (_e) {
        /* No telephony service in this process */
    }

    send('Emulator detection bypass active')
})
