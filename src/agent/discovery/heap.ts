/**
 * Heap explorer. Walks live instances of a class via `Java.choose` and
 * snapshots each instance's fields — invaluable for pulling decrypted
 * state, session objects and config out of a running app.
 */

import type { HeapInstance, HeapField } from '@shared/frida-intel'
import type { ReconContext } from '../core/context'
import { clip } from '../core/bytes'
import { simpleName } from '../tracers/common'

function snapshot(instance: Java.Wrapper): HeapInstance {
  let summary = '<instance>'
  try {
    summary = clip(String(instance.toString()), 160)
  } catch (_e) {
    /* toString threw */
  }
  let handle = ''
  try {
    handle = '0x' + (Number(instance.hashCode()) >>> 0).toString(16)
  } catch (_e) {
    /* no hashCode */
  }

  const fields: HeapField[] = []
  try {
    const declared = instance.getClass().getDeclaredFields() as Java.Wrapper
    for (let i = 0; i < declared.length && fields.length < 40; i++) {
      const f = declared[i]
      try {
        f.setAccessible(true)
        const type = simpleName(String(f.getType().getName()))
        const name = String(f.getName())
        let value = '?'
        try {
          const v = f.get(instance)
          value = v == null ? 'null' : clip(String(v), 120)
        } catch (_e) {
          value = '<unreadable>'
        }
        fields.push({ name, type, value })
      } catch (_e) {
        /* skip this field */
      }
    }
  } catch (_e) {
    /* no fields */
  }
  return { handle, summary, fields }
}

export function chooseInstances(ctx: ReconContext, className: string, limit = 10): HeapInstance[] {
  if (!ctx.hasClass(className)) return []
  const out: HeapInstance[] = []
  try {
    Java.choose(className, {
      onMatch(instance: Java.Wrapper) {
        if (out.length < limit) out.push(snapshot(instance))
      },
      onComplete() {
        /* done */
      }
    })
  } catch (_e) {
    /* class not instantiable / choose failed */
  }
  return out
}
