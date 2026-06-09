/**
 * A revertable set of hooks owned by a tracer/monitor. `track()` records a
 * Java method overload so `revert()` can null out its implementation;
 * `listen()` records a native InvocationListener so `revert()` can detach
 * it. This is what makes the live monitors cleanly start/stop-able.
 */

export class HookSet {
  private overloads: Java.Wrapper[] = []
  private listeners: InvocationListener[] = []
  count = 0

  /** Record an overload (returns it) so it can be un-hooked later. */
  track(overload: Java.Wrapper): Java.Wrapper {
    this.overloads.push(overload)
    this.count += 1
    return overload
  }

  /** Record a native InvocationListener for later detach. */
  listen(listener: InvocationListener): void {
    this.listeners.push(listener)
    this.count += 1
  }

  /** Reset every Java implementation to original and detach native hooks. */
  revert(): void {
    for (const ov of this.overloads) {
      try {
        ov.implementation = null
      } catch (_e) {
        /* overload already gone — fine */
      }
    }
    for (const l of this.listeners) {
      try {
        l.detach()
      } catch (_e) {
        /* listener already detached — fine */
      }
    }
    this.overloads = []
    this.listeners = []
    this.count = 0
  }
}
