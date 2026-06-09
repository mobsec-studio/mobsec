/**
 * Class / method explorer. Searches the loaded classes and reflects a
 * class's declared methods into readable signatures — the companion to the
 * universal method tracer.
 */

import type { ClassMethodInfo, ClassSearchResult, MethodInfo } from '@shared/frida-intel'
import type { ReconContext } from '../core/context'
import { simpleName } from '../tracers/common'

const ACC_STATIC = 0x0008

export function enumerateClasses(ctx: ReconContext, filter: string, limit = 200): ClassSearchResult {
  const all = ctx.loadedClasses()
  const needle = filter.trim().toLowerCase()
  const matched: string[] = []
  let total = 0
  for (const c of all) {
    if (needle && c.toLowerCase().indexOf(needle) === -1) continue
    total += 1
    if (matched.length < limit) matched.push(c)
  }
  matched.sort()
  return { classes: matched, total, truncated: total > matched.length }
}

function formatMethod(m: Java.Wrapper): string {
  try {
    const ret = simpleName(String(m.getReturnType().getName()))
    const name = String(m.getName())
    const params = m.getParameterTypes() as Java.Wrapper
    const ps: string[] = []
    for (let i = 0; i < params.length; i++) ps.push(simpleName(String(params[i].getName())))
    return `${ret} ${name}(${ps.join(', ')})`
  } catch (_e) {
    return `${String(m.getName())}(…)`
  }
}

export function listMethods(ctx: ReconContext, className: string): ClassMethodInfo {
  const wrapper = ctx.useClass(className)
  if (!wrapper) return { className, superclass: null, methods: [] }

  const methods: MethodInfo[] = []
  const seen = new Set<string>()
  try {
    const declared = wrapper.class.getDeclaredMethods() as Java.Wrapper
    for (let i = 0; i < declared.length; i++) {
      const m = declared[i]
      const signature = formatMethod(m)
      if (seen.has(signature)) continue
      seen.add(signature)
      const mods = Number(m.getModifiers())
      methods.push({ name: String(m.getName()), signature, static: (mods & ACC_STATIC) !== 0 })
    }
  } catch (_e) {
    /* class without reflectable methods — return what we have */
  }

  let superclass: string | null = null
  try {
    const sc = wrapper.class.getSuperclass()
    superclass = sc ? String(sc.getName()) : null
  } catch (_e) {
    /* no superclass info */
  }

  methods.sort((a, b) => a.name.localeCompare(b.name))
  return { className, superclass, methods }
}
