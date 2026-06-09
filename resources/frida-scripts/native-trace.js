// @name Native Export Tracer (parameterized)
// @description Attaches an Interceptor to a native (.so) exported symbol and logs entry args + return value + timing. Leave the module blank to search every loaded library. Great for JNI bridges, custom crypto in C/C++, and packed native logic.
// @param MODULE string "Module (.so) name — blank = search all" libnative-lib.so
// @param SYMBOL string "Exported symbol" Java_com_example_MainActivity_stringFromJNI
// @param ARG_COUNT number "Args to dump (as pointers/ints)" 4
// @param HEX_DUMP boolean "Hex-dump arg0 (first 64 bytes)" false

'use strict'

;(function () {
    function resolve() {
        const mod = MODULE && MODULE.trim() ? MODULE.trim() : null
        // 1. Try a named export first.
        let addr = Module.findExportByName(mod, SYMBOL)
        if (addr) return addr
        // 2. Fall back to scanning module symbols (catches non-exported
        //    or mangled names the export table misses).
        if (mod) {
            try {
                const syms = Process.findModuleByName(mod)?.enumerateSymbols() ?? []
                for (const s of syms) {
                    if (s.name === SYMBOL && !s.address.isNull()) return s.address
                }
            } catch (_e) { /* module not loaded yet */ }
        }
        return null
    }

    const target = resolve()
    if (!target) {
        send('[native-trace] could not resolve ' + SYMBOL + (MODULE ? ' in ' + MODULE : '') +
            '. The module may not be loaded yet — try spawning the app, or run after the screen that uses it.')
        return
    }

    const count = Math.max(0, Math.min(8, ARG_COUNT | 0))
    Interceptor.attach(target, {
        onEnter(args) {
            this.start = Date.now()
            const dumped = []
            for (let i = 0; i < count; i++) {
                dumped.push('a' + i + '=' + args[i])
            }
            send('[native] → ' + SYMBOL + '(' + dumped.join(', ') + ')')
            if (HEX_DUMP && count > 0) {
                try {
                    send('[native]   arg0:\n' + hexdump(args[0], { length: 64, ansi: false }))
                } catch (_e) {
                    /* arg0 not a readable pointer */
                }
            }
        },
        onLeave(retval) {
            const ms = Date.now() - this.start
            send('[native] ← ' + SYMBOL + ' = ' + retval + '  (' + ms + ' ms)')
        }
    })
    send('Tracing native ' + SYMBOL + ' @ ' + target + (MODULE ? ' in ' + MODULE : ''))
})()
