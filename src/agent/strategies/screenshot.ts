/**
 * Screenshot / screen-recording unblock. Strips FLAG_SECURE so the app's
 * windows can be captured (and don't appear black in scrcpy / recordings),
 * and disables SurfaceView secure mode.
 */

import type { Strategy } from '../core/registry'
import type { ReconContext } from '../core/context'
import type { StrategyRun } from '../core/strategy'

const FLAG_SECURE = 0x2000

export const screenshotStrategy: Strategy = {
  id: 'screenshot',
  label: 'FLAG_SECURE / screenshot unblock',
  category: 'screenshot-block',
  description: 'Strips WindowManager FLAG_SECURE and SurfaceView.setSecure so screens can be captured.',
  applies(ctx: ReconContext): boolean {
    void ctx
    return true
  },
  apply(_ctx: ReconContext, run: StrategyRun): void {
    run.hook('Window.setFlags(strip FLAG_SECURE)', () => {
      const Window = Java.use('android.view.Window')
      const setFlags = Window.setFlags
      setFlags.implementation = function (flags: number, mask: number) {
        return setFlags.call(this, flags & ~FLAG_SECURE, mask)
      }
    })

    run.hook('Window.addFlags(strip FLAG_SECURE)', () => {
      const Window = Java.use('android.view.Window')
      const addFlags = Window.addFlags
      addFlags.implementation = function (flags: number) {
        return addFlags.call(this, flags & ~FLAG_SECURE)
      }
    })

    run.hook('SurfaceView.setSecure(false)', () => {
      const SV = Java.use('android.view.SurfaceView')
      if (!SV.setSecure) return
      SV.setSecure.implementation = function () {
        return this.setSecure(false)
      }
    })
  }
}
