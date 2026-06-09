/**
 * Universal method tracer. Hooks every declared method of a class and logs
 * each call's args + return on the [trace] channel. Tracked per-class so it
 * can be stopped cleanly.
 */

import type { ReconContext } from '../core/context'
import { channel } from '../core/log'
import { HookSet } from '../core/hookset'
import { clip } from '../core/bytes'
import { traceMethod, simpleName } from '../tracers/common'

const log = channel('trace')
const active = new Map<string, HookSet>()

export function traceClass(ctx: ReconContext, className: string): { ok: boolean; hooked: number } {
  const existing = active.get(className)
  if (existing) return { ok: true, hooked: existing.count }

  const wrapper = ctx.useClass(className)
  if (!wrapper) {
    log.warn(`cannot trace ${className} — class not loadable`)
    return { ok: false, hooked: 0 }
  }

  const hooks = new HookSet()
  const names = new Set<string>()
  try {
    const declared = wrapper.class.getDeclaredMethods() as Java.Wrapper
    for (let i = 0; i < declared.length; i++) names.add(String(declared[i].getName()))
  } catch (_e) {
    /* fall through with whatever we collected */
  }

  const label = simpleName(className)
  names.forEach((name) => {
    if (name.indexOf('$') !== -1) return // skip synthetic/bridge accessors
    try {
      const method = wrapper[name]
      if (!method || !method.overloads) return
      traceMethod(hooks, method, (_self, args, result) => {
        const a = args.map((x) => clip(String(x), 60)).join(', ')
        log.event('method', `${label}.${name}(${a})`, undefined, {
          class: className,
          method: name,
          args: a,
          return: clip(String(result), 120)
        })
      })
    } catch (_e) {
      /* some methods can't be hooked (abstract/native-without-body) */
    }
  })

  active.set(className, hooks)
  log.info(`tracing ${className} — ${hooks.count} overload(s) hooked`)
  return { ok: true, hooked: hooks.count }
}

export function untraceClass(className: string): void {
  const hooks = active.get(className)
  if (!hooks) return
  hooks.revert()
  active.delete(className)
  log.info(`stopped tracing ${className}`)
}

export function activeClassTraces(): string[] {
  return Array.from(active.keys())
}
