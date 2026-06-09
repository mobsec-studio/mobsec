// @name Trace Class Methods (parameterized)
// @description Logs every method call on a single class — invaluable for reverse-engineering an unfamiliar component (a custom crypto wrapper, an auth manager, a license checker). Fill in the class in the run dialog.
// @param TARGET_CLASS string "Fully-qualified class" com.example.MyClass
// @param LOG_ARGS boolean "Log arguments" true

'use strict'

function whenJavaReady(cb) {
    whenJavaReady._attempts = (whenJavaReady._attempts || 0) + 1
    if (typeof Java !== 'undefined' && Java.available) {
        Java.perform(cb)
        return
    }
    if (whenJavaReady._attempts === 1) {
        send('[trace-class] alive in pid ' + Process.id + ' — waiting for ART…')
    }
    if (whenJavaReady._attempts > 600) {
        send('[trace-class] gave up: no Java VM in this process.')
        return
    }
    setTimeout(() => whenJavaReady(cb), 50)
}

whenJavaReady(() => {
    try {
        const clazz = Java.use(TARGET_CLASS)
        const declared = clazz.class.getDeclaredMethods()
        const names = new Set()
        for (let i = 0; i < declared.length; i++) {
            names.add(declared[i].getName())
        }

        let hooked = 0
        names.forEach((name) => {
            // Skip synthetic / bridge accessors that just spam the log.
            if (name.indexOf('$') !== -1) return
            try {
                const method = clazz[name]
                if (!method || !method.overloads) return
                method.overloads.forEach((overload) => {
                    overload.implementation = function (...args) {
                        if (LOG_ARGS && args.length > 0) {
                            const argStr = args
                                .map((a) => {
                                    try {
                                        return a === null ? 'null' : String(a)
                                    } catch (_e) {
                                        return '<?>'
                                    }
                                })
                                .join(', ')
                            send('[trace] ' + name + '(' + argStr + ')')
                        } else {
                            send('[trace] ' + name + '()')
                        }
                        return overload.apply(this, args)
                    }
                    hooked++
                })
            } catch (_e) {
                /* some methods can't be hooked (abstract, native w/o body) */
            }
        })
        send('Tracing ' + TARGET_CLASS + ' — ' + hooked + ' method overload(s) hooked')
    } catch (e) {
        send('[trace-class] error: ' + e)
    }
})
