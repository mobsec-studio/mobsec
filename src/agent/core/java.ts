/**
 * Java/ART bridge helpers shared across the agent.
 *
 * `whenJavaReady` mirrors the bootstrap guard every built-in script uses:
 * on a Frida *spawn* the agent loads before ART finishes initializing, so
 * `Java` is undefined for a few hundred ms. We poll (up to ~30 s) before
 * giving up, so a non-Java process degrades gracefully instead of hanging.
 */

import { safeOr } from './safe'
import { emitLog } from './protocol'

const POLL_INTERVAL_MS = 50
const HARD_LIMIT = 240 // ~12 s overall
const NO_JAVA_LIMIT = 100 // ~5 s — if the Java global never appears, it's native-only
const HEARTBEAT_EVERY = 50 // ~2.5 s

/** Why `whenJavaReady` gave up — drives a precise host-facing message. */
export type JavaGiveUpReason = 'no-java-global' | 'vm-not-found'

/**
 * Invoke `cb` inside `Java.perform` as soon as the VM is available.
 *
 * Diagnostic + fast-failing: it heartbeats on the [system] channel while
 * waiting, fails fast (~5 s) when the `Java` global never even appears
 * (a native-only process), and otherwise gives up after ~12 s — far less
 * of a hang than the old 30 s. The give-up reason lets the caller explain
 * *why* precisely instead of a generic "Java never became available".
 */
export function whenJavaReady(
  cb: () => void,
  onGiveUp?: (reason: JavaGiveUpReason) => void
): void {
  let attempts = 0
  let sawGlobal = false
  const tick = (): void => {
    attempts += 1
    const hasGlobal = typeof Java !== 'undefined'
    if (hasGlobal) sawGlobal = true
    if (hasGlobal && Java.available) {
      Java.perform(cb)
      return
    }
    if (attempts % HEARTBEAT_EVERY === 0) {
      const secs = Math.round((attempts * POLL_INTERVAL_MS) / 1000)
      emitLog(
        'system',
        'info',
        hasGlobal
          ? `waiting for ART… ${secs}s (Java present, VM not located yet)`
          : `waiting for ART… ${secs}s (no Java runtime visible yet)`
      )
    }
    // The Java global never showed up → almost certainly native-only.
    if (!sawGlobal && attempts >= NO_JAVA_LIMIT) {
      if (onGiveUp) onGiveUp('no-java-global')
      return
    }
    if (attempts > HARD_LIMIT) {
      if (onGiveUp) onGiveUp(sawGlobal ? 'vm-not-found' : 'no-java-global')
      return
    }
    setTimeout(tick, POLL_INTERVAL_MS)
  }
  tick()
}

/** True if the Java VM is up right now (no waiting). */
export function javaAvailable(): boolean {
  return typeof Java !== 'undefined' && Java.available
}

/** `Java.use` that returns null instead of throwing when the class is absent. */
export function tryUse(name: string): Java.Wrapper | null {
  try {
    return Java.use(name)
  } catch (_e) {
    return null
  }
}

/** Read an Android system property via `android.os.SystemProperties.get`. */
export function getSystemProperty(name: string): string | null {
  return safeOr<string | null>(null, () => {
    const SystemProperties = Java.use('android.os.SystemProperties')
    const value = SystemProperties.get(name) as string
    return value && value.length > 0 ? value : null
  })
}

/**
 * Best-effort package id of the running app, read from the live
 * ActivityThread. The host overrides this when it knows the identifier
 * (spawn/launch paths), but raw attach to a pid benefits from it.
 */
export function currentPackageName(): string | null {
  return safeOr<string | null>(null, () => {
    const ActivityThread = Java.use('android.app.ActivityThread')
    const app = ActivityThread.currentApplication()
    if (app == null) return null
    const ctx = app.getApplicationContext()
    const name = ctx.getPackageName() as string
    return name && name.length > 0 ? name : null
  })
}
