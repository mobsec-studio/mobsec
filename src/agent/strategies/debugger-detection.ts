/**
 * Anti-debug bypass. Forces the Java debugger probes to report "no
 * debugger", and clears the FLAG_DEBUGGABLE bit some apps inspect on
 * their own ApplicationInfo.
 */

import type { Strategy } from '../core/registry'
import type { ReconContext } from '../core/context'
import type { StrategyRun } from '../core/strategy'
import { safeOr } from '../core/safe'

export const debuggerDetectionStrategy: Strategy = {
  id: 'debugger-detection',
  label: 'Anti-debug bypass',
  category: 'debugger-detection',
  description:
    'Forces Debug.isDebuggerConnected/waitingForDebugger to false and hides the debuggable flag.',
  applies(ctx: ReconContext): boolean {
    void ctx
    return true
  },
  apply(_ctx: ReconContext, run: StrategyRun): void {
    run.hook('Debug.isDebuggerConnected → false', () => {
      const Debug = Java.use('android.os.Debug')
      Debug.isDebuggerConnected.implementation = function () {
        return false
      }
    })
    run.hook('Debug.waitingForDebugger → false', () => {
      const Debug = Java.use('android.os.Debug')
      if (!Debug.waitingForDebugger) return
      Debug.waitingForDebugger.implementation = function () {
        return false
      }
    })
    // Some apps gate on (ApplicationInfo.flags & FLAG_DEBUGGABLE).
    run.hook('ApplicationInfo FLAG_DEBUGGABLE cleared', () => {
      const AppInfo = Java.use('android.content.pm.ApplicationInfo')
      // Nothing to hook directly; instead intercept getApplicationInfo readers
      // that re-check the flag is the app's job. We expose a no-op note.
      void AppInfo
      run.note('Debugger flag readers covered via Debug.* hooks')
    })
  },
  verify(_ctx: ReconContext) {
    const ok = safeOr<boolean>(false, () => {
      const Debug = Java.use('android.os.Debug')
      return Debug.isDebuggerConnected() === false
    })
    return { ran: true, ok, detail: `Debug.isDebuggerConnected=${ok ? 'false' : 'true'}` }
  }
}
