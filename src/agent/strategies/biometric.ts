/**
 * Biometric-gate softening for testing. Makes biometrics appear available
 * and enrolled, and reports keyguard as secure, so flows that gate on
 * availability proceed. Fully forcing a success callback is app-specific
 * (the callback is the app's own subclass and may require a CryptoObject),
 * so we deliberately avoid synthesising results that could crash the app —
 * that's left to a targeted manual hook.
 */

import type { Strategy } from '../core/registry'
import type { ReconContext } from '../core/context'
import type { StrategyRun } from '../core/strategy'

export const biometricStrategy: Strategy = {
  id: 'biometric',
  label: 'Biometric gate softening',
  category: 'biometric',
  description:
    'Reports biometrics as available, enrolled and hardware-backed (BiometricManager/FingerprintManager/KeyguardManager) so availability gates pass.',
  applies(ctx: ReconContext): boolean {
    return (
      ctx.hasClass('androidx.biometric.BiometricManager') ||
      ctx.hasClass('androidx.biometric.BiometricPrompt') ||
      ctx.hasClass('android.hardware.fingerprint.FingerprintManager')
    )
  },
  apply(ctx: ReconContext, run: StrategyRun): void {
    run.hook('BiometricManager.canAuthenticate → SUCCESS', () => {
      const BM = ctx.useClass('androidx.biometric.BiometricManager')
      if (!BM || !BM.canAuthenticate) return
      BM.canAuthenticate.overloads.forEach((ov: Java.Wrapper) => {
        ov.implementation = function () {
          return 0 // BiometricManager.BIOMETRIC_SUCCESS
        }
      })
      run.note('BiometricManager.canAuthenticate → BIOMETRIC_SUCCESS')
    })

    run.hook('FingerprintManager availability', () => {
      const FM = ctx.useClass('android.hardware.fingerprint.FingerprintManager')
      if (!FM) return
      if (FM.hasEnrolledFingerprints) {
        FM.hasEnrolledFingerprints.implementation = function () {
          return true
        }
      }
      if (FM.isHardwareDetected) {
        FM.isHardwareDetected.implementation = function () {
          return true
        }
      }
    })

    run.hook('KeyguardManager secure', () => {
      const KM = ctx.useClass('android.app.KeyguardManager')
      if (!KM) return
      if (KM.isKeyguardSecure) {
        KM.isKeyguardSecure.implementation = function () {
          return true
        }
      }
      if (KM.isDeviceSecure) {
        KM.isDeviceSecure.overloads.forEach((ov: Java.Wrapper) => {
          ov.implementation = function () {
            return true
          }
        })
      }
    })

    run.note('Force-success of a specific BiometricPrompt callback is app-specific — hook it manually if needed')
  }
}
