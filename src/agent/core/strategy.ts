/**
 * Per-strategy execution accumulator. A strategy installs each hook
 * through `run.hook(label, fn)`: a success bumps the install count, a
 * failure is captured as a non-fatal error so one missing overload never
 * aborts the rest of the bypass. This is the unit of "log, fallback,
 * continue" inside the bypass arsenal.
 */

import { errMessage } from './safe'

export class StrategyRun {
  hooksInstalled = 0
  readonly notes: string[] = []
  readonly errors: string[] = []

  /**
   * Install one hook point. `fn` should perform a single logical patch
   * (one method overload, one native function). Returns whether it stuck.
   */
  hook(label: string, fn: () => void): boolean {
    try {
      fn()
      this.hooksInstalled += 1
      return true
    } catch (e) {
      this.errors.push(`${label}: ${errMessage(e)}`)
      return false
    }
  }

  /** Record a human-readable observation (deduped). */
  note(text: string): void {
    if (this.notes.indexOf(text) === -1) this.notes.push(text)
  }
}
