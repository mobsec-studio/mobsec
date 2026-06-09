/**
 * The agent's universal "never crash the session" wrapper.
 *
 * Every detector, probe, and hook installation runs through `safe()`:
 * if it throws, we capture the message, optionally report it, and return
 * null so the caller can fall back. This is the backbone of the
 * "log, fallback, continue, self-heal" guarantee.
 */

export function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export function safe<T>(label: string, fn: () => T, onError?: (message: string) => void): T | null {
  try {
    return fn()
  } catch (e) {
    const message = `${label}: ${errMessage(e)}`
    if (onError) {
      try {
        onError(message)
      } catch (_inner) {
        /* an error reporter that itself throws must not escalate */
      }
    }
    return null
  }
}

/** Like `safe` but yields a caller-supplied fallback instead of null. */
export function safeOr<T>(fallback: T, fn: () => T): T {
  try {
    return fn()
  } catch (_e) {
    return fallback
  }
}
