import type { SdkSetupOptions, SdkSetupPhase, SdkSetupProgress } from '@shared/types'
import { DEFAULT_SDK_SETUP } from '@shared/types'
import { getRecommendedEmulatorAbi, isEmulatorAbiCompatible } from '@shared/sdk-compat'
import { bus } from '../utils/event-bus'
import { getLogger } from '../utils/logger'
import { createAvd, listAvds } from './avdmanager'
import {
  installSdkPackage,
  isSdkmanagerInstalled,
  runSdkmanager,
  writeLicenseAcceptanceFiles
} from './sdkmanager'
import { toolchainService } from './toolchain'

/**
 * One-stop orchestrator that takes a user from "no Android SDK at all" to "a
 * booted AVD ready for pentesting" with a single call. Each step pushes a
 * progress event onto the bus; the renderer subscribes via
 * `onSdkSetupProgress(...)`.
 *
 * Steps:
 *   1. Download cmdline-tools (if missing) via the toolchain service.
 *   2. Write license-acceptance hashes so sdkmanager doesn't prompt.
 *   3. Use sdkmanager to install platform-tools, emulator, the requested
 *      platform, and the chosen system image.
 *   4. Run avdmanager to create the AVD and tune its config.ini.
 */

interface StepWeight {
  phase: SdkSetupPhase
  /** Approximate share of the whole flow (sums to 1.0). Used to interpolate
   *  overallPercent from each step's stepPercent. */
  weight: number
  label: string
}

const STEPS: StepWeight[] = [
  { phase: 'downloading-cmdline-tools', weight: 0.05, label: 'Downloading command-line tools' },
  { phase: 'accepting-licenses', weight: 0.01, label: 'Accepting licenses' },
  { phase: 'installing-platform-tools', weight: 0.04, label: 'Installing platform-tools' },
  { phase: 'installing-emulator', weight: 0.15, label: 'Installing emulator' },
  { phase: 'installing-platform', weight: 0.05, label: 'Installing platform' },
  { phase: 'installing-system-image', weight: 0.65, label: 'Downloading system image' },
  { phase: 'creating-avd', weight: 0.025, label: 'Creating AVD' },
  { phase: 'configuring-avd', weight: 0.025, label: 'Tuning AVD config' }
]

class SdkSetupService {
  private current: SdkSetupProgress = {
    phase: 'idle',
    overallPercent: 0,
    stepPercent: 0,
    message: ''
  }
  private abort: AbortController | null = null

  getProgress(): SdkSetupProgress {
    return { ...this.current }
  }

  async runFullSetup(partial: Partial<SdkSetupOptions>): Promise<{ avdName: string }> {
    if (
      this.current.phase !== 'idle' &&
      this.current.phase !== 'done' &&
      this.current.phase !== 'error'
    ) {
      throw new Error('SDK setup already in progress')
    }
    const options: SdkSetupOptions = { ...DEFAULT_SDK_SETUP, ...partial }
    if (!isEmulatorAbiCompatible(options.abi, process.platform, process.arch)) {
      const recommendedAbi = getRecommendedEmulatorAbi(process.platform, process.arch)
      getLogger().warn('SDK setup requested an emulator ABI incompatible with this host', {
        requestedAbi: options.abi,
        recommendedAbi,
        platform: process.platform,
        arch: process.arch
      })
      options.abi = recommendedAbi
      if (!partial.avdName && recommendedAbi === 'arm64-v8a') {
        options.avdName = 'MobSec_Pixel5_API33_ARM64'
      }
    }
    this.abort = new AbortController()
    const signal = this.abort.signal

    const sysImage = `system-images;android-${options.apiLevel};${options.variant};${options.abi}`
    const platformPkg = `platforms;android-${options.apiLevel}`

    try {
      // 1. cmdline-tools
      this.startStep('downloading-cmdline-tools')
      if (!isSdkmanagerInstalled()) {
        await toolchainService.install('cmdline-tools')
      }
      this.completeStep('downloading-cmdline-tools')

      // 2. Licenses
      this.startStep('accepting-licenses')
      writeLicenseAcceptanceFiles()
      // Run --licenses as well in case our hash list missed something; the
      // stdin "y" loop in sdkmanager.ts handles the prompts. Failures here
      // don't matter — the static hash files cover the standard set.
      await runSdkmanager(['--licenses'], () => undefined, signal).catch((err) => {
        getLogger().warn('sdkmanager --licenses failed (non-fatal)', {
          error: err instanceof Error ? err.message : String(err)
        })
      })
      this.completeStep('accepting-licenses')

      if (signal.aborted) throw new Error('SDK setup cancelled')

      // 3. platform-tools
      this.startStep('installing-platform-tools')
      await installSdkPackage(
        'platform-tools',
        (percent, op) => this.updateStep('installing-platform-tools', percent, op),
        signal
      )
      this.completeStep('installing-platform-tools')

      if (signal.aborted) throw new Error('SDK setup cancelled')

      // 4. emulator
      this.startStep('installing-emulator')
      await installSdkPackage(
        'emulator',
        (percent, op) => this.updateStep('installing-emulator', percent, op),
        signal
      )
      this.completeStep('installing-emulator')

      if (signal.aborted) throw new Error('SDK setup cancelled')

      // 5. platform
      this.startStep('installing-platform')
      await installSdkPackage(
        platformPkg,
        (percent, op) => this.updateStep('installing-platform', percent, op),
        signal
      )
      this.completeStep('installing-platform')

      if (signal.aborted) throw new Error('SDK setup cancelled')

      // 6. system-image
      this.startStep('installing-system-image')
      await installSdkPackage(
        sysImage,
        (percent, op) => this.updateStep('installing-system-image', percent, op),
        signal
      )
      this.completeStep('installing-system-image')

      if (signal.aborted) throw new Error('SDK setup cancelled')

      // 7. AVD creation
      this.startStep('creating-avd')
      // If an AVD with that name already exists, the user probably re-ran
      // setup. avdmanager --force will overwrite cleanly.
      const existing = await listAvds().catch((): string[] => [])
      if (existing.includes(options.avdName)) {
        getLogger().info(`Replacing existing AVD ${options.avdName}`)
      }
      await createAvd({
        name: options.avdName,
        systemImage: sysImage,
        deviceProfile: options.deviceProfile,
        ramMb: options.ramMb,
        diskGb: options.diskGb
      })
      this.completeStep('creating-avd')
      this.completeStep('configuring-avd') // createAvd already tunes config.ini

      this.setProgress({
        phase: 'done',
        overallPercent: 100,
        stepPercent: 100,
        message: `AVD "${options.avdName}" ready`
      })

      return { avdName: options.avdName }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      getLogger().error('SDK setup failed', { error: message })
      this.setProgress({
        phase: 'error',
        overallPercent: this.current.overallPercent,
        stepPercent: this.current.stepPercent,
        message: this.current.message,
        errorMessage: message
      })
      throw err
    } finally {
      this.abort = null
    }
  }

  cancel(): void {
    this.abort?.abort(new Error('Cancelled by user'))
  }

  private setProgress(next: SdkSetupProgress): void {
    this.current = next
    bus.emit('sdkSetup:progress', next)
  }

  private startStep(phase: SdkSetupPhase): void {
    const step = STEPS.find((s) => s.phase === phase)
    if (!step) return
    this.setProgress({
      phase,
      overallPercent: this.currentBaseOverall(phase),
      stepPercent: 0,
      message: step.label
    })
  }

  private updateStep(phase: SdkSetupPhase, stepPercent: number, op: string): void {
    const step = STEPS.find((s) => s.phase === phase)
    if (!step) return
    const overall = this.currentBaseOverall(phase) + step.weight * stepPercent
    this.setProgress({
      phase,
      overallPercent: Math.min(99, overall),
      stepPercent,
      message: op
    })
  }

  private completeStep(phase: SdkSetupPhase): void {
    const step = STEPS.find((s) => s.phase === phase)
    if (!step) return
    const overall = this.currentBaseOverall(phase) + step.weight * 100
    this.setProgress({
      phase,
      overallPercent: Math.min(99, overall),
      stepPercent: 100,
      message: `${step.label} ✓`
    })
  }

  /** Sum of weights of all steps preceding `phase`, scaled to 0-100. */
  private currentBaseOverall(phase: SdkSetupPhase): number {
    let base = 0
    for (const s of STEPS) {
      if (s.phase === phase) break
      base += s.weight * 100
    }
    return base
  }
}

export const sdkSetupService = new SdkSetupService()
