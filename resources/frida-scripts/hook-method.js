// @name Hook Java Method (parameterized)
// @description Hooks a single Java method by class + name and logs every call: arguments, return value, and (optionally) the full call stack. Fill in the class and method in the run dialog — no code editing needed.
// @param TARGET_CLASS string "Fully-qualified class" com.example.MyClass
// @param TARGET_METHOD string "Method name" doLogin
// @param LOG_STACK boolean "Log call stack on each hit" false

'use strict'

// The run dialog injects `const TARGET_CLASS = "…"` etc. above this
// line. When the script is opened raw (no params filled), these
// fall back to the @param defaults via the editor's preamble.

function whenJavaReady(cb) {
    whenJavaReady._attempts = (whenJavaReady._attempts || 0) + 1
    if (typeof Java !== 'undefined' && Java.available) {
        Java.perform(cb)
        return
    }
    if (whenJavaReady._attempts === 1) {
        send('[hook-method] alive in pid ' + Process.id + ' — waiting for ART…')
    }
    if (whenJavaReady._attempts > 600) {
        send('[hook-method] gave up: no Java VM in this process.')
        return
    }
    setTimeout(() => whenJavaReady(cb), 50)
}

whenJavaReady(() => {
    try {
        const clazz = Java.use(TARGET_CLASS)
        const method = clazz[TARGET_METHOD]
        if (!method) {
            send('[hook-method] ' + TARGET_CLASS + ' has no method named ' + TARGET_METHOD)
            return
        }
        const overloads = method.overloads
        overloads.forEach((overload, idx) => {
            overload.implementation = function (...args) {
                const argStr = args
                    .map((a) => {
                        try {
                            return a === null ? 'null' : String(a)
                        } catch (_e) {
                            return '<unprintable>'
                        }
                    })
                    .join(', ')
                send(
                    '[hook] ' + TARGET_CLASS + '.' + TARGET_METHOD +
                    (overloads.length > 1 ? ' #' + idx : '') + '(' + argStr + ')'
                )
                if (LOG_STACK) {
                    const stack = Java.use('android.util.Log').getStackTraceString(
                        Java.use('java.lang.Exception').$new()
                    )
                    send('[hook]   stack:\n' + stack)
                }
                const ret = overload.apply(this, args)
                send('[hook]   → ' + (ret === null ? 'null' : String(ret)))
                return ret
            }
        })
        send('Hooked ' + TARGET_CLASS + '.' + TARGET_METHOD + ' (' + overloads.length + ' overload(s))')
    } catch (e) {
        send('[hook-method] error: ' + e)
    }
})
