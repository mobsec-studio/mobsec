// @name Root Detection Bypass
// @description Hides common root indicators (`su` binary, Magisk paths, build tags, RootBeer, Runtime.exec) so root-aware apps proceed without complaint.

'use strict'

// File paths that root-aware code commonly stats. Returning false from
// File.exists for any of these makes the obvious checks fail.
const SUSPICIOUS_PATHS = [
    '/system/bin/su',
    '/system/xbin/su',
    '/sbin/su',
    '/system/app/Superuser.apk',
    '/system/app/SuperSU',
    '/system/etc/init.d/99SuperSUDaemon',
    '/system/xbin/daemonsu',
    '/system/xbin/busybox',
    '/system/bin/.ext',
    '/data/local/tmp/frida-server',
    '/data/local/tmp/re.frida.server',
    '/dev/com.koushikdutta.superuser.daemon',
    '/sbin/.magisk',
    '/sbin/.core/mirror',
    '/data/adb/magisk',
    '/data/adb/modules',
    '/cache/.disable_magisk',
    '/cache/magisk.log'
]

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
    console.log('[root-bypass] activating')

    // 1. File.exists()
    try {
        const File = Java.use('java.io.File')
        const exists = File.exists
        exists.implementation = function () {
            const path = this.getAbsolutePath()
            if (SUSPICIOUS_PATHS.some((p) => path.indexOf(p) !== -1)) {
                console.log('[root-bypass] File.exists hidden: ' + path)
                return false
            }
            return exists.call(this)
        }
    } catch (e) {
        console.warn('[root-bypass] File.exists: ' + e)
    }

    // 2. Build.TAGS test-keys → user-keys
    try {
        const Build = Java.use('android.os.Build')
        const tagsField = Build.class.getDeclaredField('TAGS')
        tagsField.setAccessible(true)
        tagsField.set(null, 'release-keys')
        console.log('[root-bypass] Build.TAGS → release-keys')
    } catch (e) {
        console.warn('[root-bypass] Build.TAGS: ' + e)
    }

    // 3. Runtime.exec("su") and friends — return a sub-process that fails.
    try {
        const Runtime = Java.use('java.lang.Runtime')
        const execStr = Runtime.exec.overload('java.lang.String')
        execStr.implementation = function (cmd) {
            if (cmd && (cmd === 'su' || cmd.indexOf('which su') !== -1)) {
                console.log('[root-bypass] Runtime.exec blocked: ' + cmd)
                throw Java.use('java.io.IOException').$new('Cannot run program "' + cmd + '"')
            }
            return execStr.call(this, cmd)
        }
        const execArr = Runtime.exec.overload('[Ljava.lang.String;')
        execArr.implementation = function (args) {
            const first = args && args.length > 0 ? args[0] : ''
            if (first === 'su' || first === 'which' || first === '/system/bin/su') {
                console.log('[root-bypass] Runtime.exec blocked: ' + args.join(' '))
                throw Java.use('java.io.IOException').$new('Cannot run program "' + first + '"')
            }
            return execArr.call(this, args)
        }
    } catch (e) {
        console.warn('[root-bypass] Runtime.exec: ' + e)
    }

    // 4. RootBeer — every public check method returns false.
    try {
        const RootBeer = Java.use('com.scottyab.rootbeer.RootBeer')
        const fns = [
            'isRooted',
            'isRootedWithoutBusyBoxCheck',
            'detectRootManagementApps',
            'detectPotentiallyDangerousApps',
            'checkForSuBinary',
            'checkForBusyBoxBinary',
            'checkForDangerousProps',
            'checkForRWPaths',
            'detectTestKeys',
            'checkSuExists',
            'checkForRootNative',
            'detectRootCloakingApps'
        ]
        for (const name of fns) {
            try {
                RootBeer[name].overloads.forEach((m) => {
                    m.implementation = function () {
                        console.log('[root-bypass] RootBeer.' + name + ' → false')
                        return false
                    }
                })
            } catch (_e) {
                /* RootBeer doesn't have this method on this version */
            }
        }
    } catch (_e) {
        /* App doesn't bundle RootBeer */
    }

    send('Root detection bypass active')
})
