// @name Anti-Anti-Frida (detection bypass)
// @description Defeats common anti-Frida techniques: hides the agent from `/proc/self/maps` reads, blocks `String.contains("frida")` snooping, neutralizes File.exists checks against known agent paths, and refuses outbound TCP to the standard Frida ports. Run this *before* your target script so detection routines see a clean process.

'use strict'

const SUSPICIOUS_NAMES = [
    'frida',
    'gum-js-loop',
    'gmain',
    'gdbus',
    'pool-frida',
    'linjector'
]

const SUSPICIOUS_PATHS = [
    '/data/local/tmp/frida-server',
    '/data/local/tmp/re.frida.server',
    '/data/local/tmp/.gadget',
    '/data/local/tmp/linjector',
    'libfrida-agent.so',
    'libfrida-gadget.so',
    'libfrida'
]

const SUSPICIOUS_PORTS = [27042, 27043]

// ----- Native side: scrub /proc/*/maps reads ----------------------------

// We can't easily filter what `read()` returns line-by-line because
// the kernel may split lines across multiple read() syscalls, but
// most anti-Frida code reads the whole file in one big buffer. We
// catch the buffer and blank out lines containing our agent paths.
try {
    const readPtr = Module.findExportByName(null, 'read')
    if (readPtr) {
        Interceptor.attach(readPtr, {
            onEnter(args) {
                this.buf = args[1]
                this.count = args[2].toInt32()
            },
            onLeave(retval) {
                const n = retval.toInt32()
                if (n <= 0 || !this.buf) return
                try {
                    const text = this.buf.readUtf8String(n)
                    if (!text) return
                    let needsRewrite = false
                    let scrubbed = text
                    for (const needle of SUSPICIOUS_PATHS) {
                        if (scrubbed.includes(needle)) {
                            needsRewrite = true
                            // Replace the entire matching line with the same
                            // number of spaces — keeps the buffer length stable
                            // so the caller's offset math doesn't drift.
                            scrubbed = scrubbed.replace(
                                new RegExp(`^[^\n]*${escapeRegExp(needle)}[^\n]*$`, 'gm'),
                                (m) => ' '.repeat(m.length)
                            )
                        }
                    }
                    if (needsRewrite) {
                        this.buf.writeUtf8String(scrubbed)
                    }
                } catch (_e) {
                    // ignore non-utf8 buffers (binary reads of unrelated files)
                }
            }
        })
    }
} catch (e) {
    console.warn('[anti-detect] read() hook: ' + e)
}

function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ----- Java side: the noisy detection patterns --------------------------

function whenJavaReady(cb) {
    whenJavaReady._attempts = (whenJavaReady._attempts || 0) + 1
    if (typeof Java !== 'undefined' && Java.available) {
        send('[anti-detect] Java VM ready after ' + whenJavaReady._attempts + ' attempts — installing hooks…')
        Java.perform(cb)
        return
    }
    if (whenJavaReady._attempts === 1) {
        send('[anti-detect] alive in pid ' + Process.id + ' (' + Process.arch + ') — waiting for ART…')
    }
    if (whenJavaReady._attempts > 600) {
        send('[anti-detect] gave up after 30 s: Java never became available. Try the Launch and attach run mode (more compatible than Spawn for hardened or multi-process apps).')
        return
    }
    setTimeout(() => whenJavaReady(cb), 50)
}

whenJavaReady(() => {
    // 1. String.contains: many anti-tamper SDKs read /proc and call
    //    `String.contains("frida")` to check. Lie.
    try {
        const StringCls = Java.use('java.lang.String')
        const contains = StringCls.contains
        contains.implementation = function (cs) {
            if (cs) {
                const needle = cs.toString().toLowerCase()
                for (const s of SUSPICIOUS_NAMES) {
                    if (needle.includes(s)) {
                        return false
                    }
                }
            }
            return contains.call(this, cs)
        }
    } catch (e) {
        send('[anti-detect] String.contains hook: ' + e)
    }

    // 2. File.exists for known agent paths
    try {
        const File = Java.use('java.io.File')
        const exists = File.exists
        exists.implementation = function () {
            const path = this.getAbsolutePath()
            for (const s of SUSPICIOUS_PATHS) {
                if (path.indexOf(s) !== -1) {
                    return false
                }
            }
            return exists.call(this)
        }
    } catch (e) {
        send('[anti-detect] File.exists hook: ' + e)
    }

    // 3. Refuse outbound TCP to the Frida ports — apps detect by trying
    //    to connect to 127.0.0.1:27042 and seeing whether the connection
    //    succeeds. Throw ConnectException so they conclude "no Frida".
    try {
        const Socket = Java.use('java.net.Socket')
        const init2 = Socket.$init.overload('java.lang.String', 'int')
        init2.implementation = function (host, port) {
            if (
                SUSPICIOUS_PORTS.includes(port) &&
                (host === '127.0.0.1' || host === 'localhost')
            ) {
                throw Java.use('java.net.ConnectException').$new('Connection refused')
            }
            return init2.call(this, host, port)
        }
    } catch (e) {
        send('[anti-detect] Socket hook: ' + e)
    }

    // 4. Some apps shell out and grep ps for "frida-server". Intercept
    //    Runtime.exec and pretend `ps` returned nothing interesting.
    try {
        const Runtime = Java.use('java.lang.Runtime')
        const execStr = Runtime.exec.overload('java.lang.String')
        execStr.implementation = function (cmd) {
            if (cmd && /frida|magisk|su|busybox/i.test(cmd)) {
                // Replace the command with `echo` so its output is empty.
                return execStr.call(this, 'echo')
            }
            return execStr.call(this, cmd)
        }
    } catch (e) {
        send('[anti-detect] Runtime.exec hook: ' + e)
    }

    send('Anti-anti-Frida active')
})
