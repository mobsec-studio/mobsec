/**
 * Emulator-detection bypass. Rewrites the Build identity to a plausible
 * physical device and masks the QEMU/goldfish system properties and
 * telephony tells that emulator checks key off.
 */

import type { Strategy } from '../core/registry'
import type { ReconContext } from '../core/context'
import type { StrategyRun } from '../core/strategy'

/** Build fields → physical-device-looking values. */
const BUILD_FIELDS: Record<string, string> = {
  FINGERPRINT: 'google/redfin/redfin:13/TQ3A.230805.001/10316531:user/release-keys',
  MODEL: 'Pixel 5',
  MANUFACTURER: 'Google',
  BRAND: 'google',
  DEVICE: 'redfin',
  PRODUCT: 'redfin',
  HARDWARE: 'redfin',
  BOARD: 'redfin',
  HOST: 'abfarm',
  TAGS: 'release-keys'
}

const FAKED_PROPS: Record<string, string> = {
  'ro.kernel.qemu': '0',
  'ro.hardware': 'redfin',
  'ro.product.name': 'redfin',
  'ro.product.device': 'redfin',
  'ro.bootloader': 'unknown',
  'ro.secure': '1',
  'init.svc.qemud': '',
  'qemu.hw.mainkeys': ''
}

const EMULATOR_FILES = [
  '/dev/qemu_pipe',
  '/dev/socket/qemud',
  '/system/lib/libc_malloc_debug_qemu.so',
  '/sys/qemu_trace',
  '/system/bin/qemu-props',
  '/dev/socket/genyd',
  '/dev/socket/baseband_genyd'
]

export const emulatorDetectionStrategy: Strategy = {
  id: 'emulator-detection',
  label: 'Emulator detection bypass',
  category: 'emulator-detection',
  description:
    'Spoofs Build identity, QEMU system properties, emulator device files and telephony values to look like a physical phone.',
  applies(ctx: ReconContext): boolean {
    void ctx
    return true
  },
  apply(_ctx: ReconContext, run: StrategyRun): void {
    // 1. Build.* static fields.
    run.hook('Build.* identity spoof', () => {
      const Build = Java.use('android.os.Build')
      let set = 0
      for (const name of Object.keys(BUILD_FIELDS)) {
        try {
          const field = Build.class.getDeclaredField(name)
          field.setAccessible(true)
          field.set(null, BUILD_FIELDS[name])
          set += 1
        } catch (_e) {
          /* field not present on this API level */
        }
      }
      run.note(`Build identity spoofed (${set} fields → Pixel 5)`)
    })

    // 2. SystemProperties.get — mask QEMU tells.
    run.hook('SystemProperties.get(qemu)', () => {
      const SP = Java.use('android.os.SystemProperties')
      const get1 = SP.get.overload('java.lang.String')
      get1.implementation = function (key: string) {
        const faked = FAKED_PROPS[key]
        if (faked !== undefined) return faked
        return get1.call(this, key)
      }
      const get2 = SP.get.overload('java.lang.String', 'java.lang.String')
      get2.implementation = function (key: string, def: string) {
        const faked = FAKED_PROPS[key]
        if (faked !== undefined) return faked
        return get2.call(this, key, def)
      }
    })

    // 3. File.exists — hide emulator device nodes.
    run.hook('File.exists(emulator nodes)', () => {
      const File = Java.use('java.io.File')
      const exists = File.exists
      exists.implementation = function () {
        const path = String(this.getAbsolutePath())
        if (EMULATOR_FILES.indexOf(path) !== -1) return false
        return exists.call(this)
      }
    })

    // 4. TelephonyManager tells.
    run.hook('TelephonyManager spoof', () => {
      const TM = Java.use('android.telephony.TelephonyManager')
      if (TM.getNetworkOperatorName) {
        TM.getNetworkOperatorName.overloads.forEach((ov: Java.Wrapper) => {
          ov.implementation = function () {
            return 'Verizon'
          }
        })
      }
      if (TM.getDeviceId) {
        TM.getDeviceId.overloads.forEach((ov: Java.Wrapper) => {
          ov.implementation = function () {
            return '358240051111110'
          }
        })
      }
    })
  }
}
