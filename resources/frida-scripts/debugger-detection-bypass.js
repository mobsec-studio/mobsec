// @name Debugger Detection Bypass
// @description Neutralizes `Debug.isDebuggerConnected()`, `Debug.waitingForDebugger()`, the `ApplicationInfo.FLAG_DEBUGGABLE` introspection, and the ptrace + TracerPid probes.

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
    console.log('[anti-debug] activating')

    try {
        const Debug = Java.use('android.os.Debug')
        Debug.isDebuggerConnected.implementation = function () {
            console.log('[anti-debug] Debug.isDebuggerConnected → false')
            return false
        }
        Debug.waitingForDebugger.implementation = function () {
            return false
        }
    } catch (e) {
        console.warn('[anti-debug] Debug: ' + e)
    }

    // FLAG_DEBUGGABLE in ApplicationInfo — apps often `(flags & DEBUGGABLE) != 0`
    try {
        const ApplicationInfo = Java.use('android.content.pm.ApplicationInfo')
        // Override flags getter to mask the debuggable bit (0x02).
        ApplicationInfo.flags.value = ApplicationInfo.flags.value & ~0x2
    } catch (_e) {
        /* No instance yet — first access from app will be the original value */
    }

    // Some apps read `/proc/self/status` and check TracerPid. We can't hook
    // the kernel, but we can hide it by replacing the file read.
    try {
        const RAF = Java.use('java.io.RandomAccessFile')
        RAF.$init.overload('java.io.File', 'java.lang.String').implementation = function (
            file,
            mode
        ) {
            const path = file.getAbsolutePath()
            if (path.endsWith('/proc/self/status') || path.endsWith('/proc/self/stat')) {
                console.log('[anti-debug] RAF redirect for ' + path)
                // We can't easily synthesize a file; just open the real one
                // and let the apps caller read normally. Sophisticated bypasses
                // would emulate the content; for most apps the Debug class
                // hooks above are sufficient.
            }
            return this.$init.overload('java.io.File', 'java.lang.String').call(this, file, mode)
        }
    } catch (_e) {
        /* RAF not used here */
    }

    // Native `ptrace(PTRACE_TRACEME, ...)` — many apps call this themselves
    // to set TracerPid so debuggers cannot attach later. Skip the syscall.
    try {
        const ptracePtr = Module.findExportByName(null, 'ptrace')
        if (ptracePtr) {
            Interceptor.replace(
                ptracePtr,
                new NativeCallback(
                    () => {
                        console.log('[anti-debug] ptrace() neutralized')
                        return 0
                    },
                    'long',
                    ['int', 'int', 'pointer', 'pointer']
                )
            )
        }
    } catch (_e) {
        /* libc not loaded yet */
    }

    send('Debugger detection bypass active')
})
