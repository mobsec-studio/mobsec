/**
 * Shared helper for the live monitors: hook every overload of a Java
 * method, call the original, then hand (self, args, result) to a logging
 * callback. The callback is wrapped so a logging error never breaks the
 * traced call. Each hooked overload is tracked for clean revert on stop.
 */

import type { HookSet } from '../core/hookset'

/** `com.example.Foo` → `Foo`; leaves primitives/arrays readable. */
export function simpleName(fqcn: string): string {
  const idx = fqcn.lastIndexOf('.')
  return idx === -1 ? fqcn : fqcn.slice(idx + 1)
}

export function traceMethod(
  hooks: HookSet,
  method: Java.Wrapper | undefined | null,
  onCall: (self: Java.Wrapper, args: unknown[], result: unknown) => void
): void {
  if (!method || !method.overloads) return
  method.overloads.forEach((ov: Java.Wrapper) => {
    const tracked = hooks.track(ov)
    tracked.implementation = function (this: Java.Wrapper, ...args: unknown[]) {
      const result = tracked.apply(this, args)
      try {
        onCall(this, args, result)
      } catch (_e) {
        /* a logging error must never break the traced call */
      }
      return result
    }
  })
}

/** Top app-relevant frames of the current Java stack, for correlation. */
export function shortStack(maxFrames = 4): string {
  try {
    const Thread = Java.use('java.lang.Thread')
    const frames = Thread.currentThread().getStackTrace() as Java.Wrapper
    const out: string[] = []
    for (let i = 0; i < frames.length && out.length < maxFrames; i++) {
      const f = String(frames[i])
      if (
        f.indexOf('java.lang.Thread') !== -1 ||
        f.indexOf('dalvik.system') !== -1 ||
        f.indexOf('studio.mobsec') !== -1
      ) {
        continue
      }
      out.push(f)
    }
    return out.join(' ← ')
  } catch (_e) {
    return ''
  }
}
