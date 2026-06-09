import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import { createWriteStream, existsSync, readFileSync, type WriteStream } from 'node:fs'
import { delimiter, join } from 'node:path'
import { platform } from 'node:os'
import type { AndroidSdk, AvdInfo, EmulatorStatus } from '@shared/types'
import {
  incompatibleAbiMessage,
  isEmulatorAbiCompatible,
  normalizeEmulatorAbi
} from '@shared/sdk-compat'
import { bus } from '../utils/event-bus'
import { getLogger } from '../utils/logger'
import { getPaths } from '../utils/paths'
import {
  getAppLabel,
  inputKeyEvent,
  installApk as adbInstallApk,
  KeyCode,
  launchApp as adbLaunchApp,
  listDevices,
  listInstalledPackages,
  resolveAdbPath,
  shell,
  waitForBootCompleted,
  type AdbKey
} from './adb'
import { getAvdHome } from './avdmanager'

const EMULATOR_BIN = platform() === 'win32' ? 'emulator.exe' : 'emulator'
const AVDMANAGER_BIN = platform() === 'win32' ? 'avdmanager.bat' : 'avdmanager'
const MAX_EMULATOR_OUTPUT_CHARS = 8000

function emulatorGpuMode(): string {
  return process.platform === 'win32' ? 'swangle_indirect' : 'swiftshader_indirect'
}

interface AvdDiskProfile {
  path: string | null
  target: string | null
  abi: string | null
  systemImage: string | null
}

function parseIni(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
  }
  return out
}

function inferAbiFromSystemImage(systemImage: string | null | undefined): string | null {
  if (!systemImage) return null
  const normalized = systemImage.replace(/\\/g, '/').toLowerCase()
  if (normalized.includes('/arm64-v8a') || normalized.includes('arm64-v8a')) return 'arm64-v8a'
  if (normalized.includes('/x86_64') || normalized.includes('x86_64')) return 'x86_64'
  return null
}

function appendRollingOutput(current: string, chunk: Buffer): string {
  const next = current + chunk.toString('utf8')
  return next.length > MAX_EMULATOR_OUTPUT_CHARS
    ? next.slice(next.length - MAX_EMULATOR_OUTPUT_CHARS)
    : next
}

function extractEmulatorDiagnostic(output: string): string | null {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const fatal = lines.find((line) => /^(FATAL|ERROR|PANIC)\s*\|/i.test(line))
  if (fatal) return fatal.replace(/^(FATAL|ERROR|PANIC)\s*\|\s*/i, '')
  const qemu = lines.find((line) =>
    /(not supported|must match|failed|panic|fatal|error)/i.test(line)
  )
  return qemu ?? null
}

/**
 * Owns the Android emulator subprocess and exposes a small API the IPC layer
 * uses. The state machine drives `bus.emit('emulator:status', …)` whenever
 * something user-visible changes.
 */

class EmulatorService {
  private status: EmulatorStatus = {
    state: 'idle',
    avdName: null,
    serial: null
  }
  private process: ChildProcess | null = null
  private stdoutStream: WriteStream | null = null
  private stderrStream: WriteStream | null = null
  private selectedAvd: string | null = null

  getStatus(): EmulatorStatus {
    return { ...this.status }
  }

  detectSdk(): AndroidSdk {
    // Prefer our bundled tools (so a freshly-run "Quick Setup" wins over a
    // stale ANDROID_HOME). Fall back to env vars for users who already have
    // Android Studio installed.
    const candidates: { path: string; source: AndroidSdk['source'] }[] = [
      { path: getPaths().tools, source: 'bundled' }
    ]
    if (process.env['ANDROID_HOME']) {
      candidates.push({ path: process.env['ANDROID_HOME'], source: 'ANDROID_HOME' })
    }
    if (process.env['ANDROID_SDK_ROOT']) {
      candidates.push({
        path: process.env['ANDROID_SDK_ROOT'],
        source: 'ANDROID_SDK_ROOT'
      })
    }

    for (const { path, source } of candidates) {
      if (!existsSync(path)) continue
      const hasPlatformTools = existsSync(join(path, 'platform-tools'))
      const hasEmulator = existsSync(join(path, 'emulator', EMULATOR_BIN))
      const hasAvdManager = existsSync(join(path, 'cmdline-tools', 'latest', 'bin', AVDMANAGER_BIN))
      if (hasPlatformTools || hasEmulator) {
        return {
          root: path,
          source,
          hasPlatformTools,
          hasEmulator,
          hasAvdManager,
          systemImages: []
        }
      }
    }

    return {
      root: '',
      source: 'unknown',
      hasPlatformTools: false,
      hasEmulator: false,
      hasAvdManager: false,
      systemImages: []
    }
  }

  private resolveEmulatorBinary(): string | null {
    const sdk = this.detectSdk()
    if (sdk.hasEmulator) {
      return join(sdk.root, 'emulator', EMULATOR_BIN)
    }
    // PATH fallback
    for (const dir of (process.env['PATH'] ?? '').split(delimiter)) {
      if (!dir) continue
      const candidate = join(dir, EMULATOR_BIN)
      if (existsSync(candidate)) return candidate
    }
    return null
  }

  /**
   * Build the env object we pass to the emulator subprocess so it can find
   * system images and adb regardless of whether the user has Android Studio
   * configured. Always wins for the bundled SDK if it exists.
   */
  private buildSdkEnv(): NodeJS.ProcessEnv {
    const sdk = this.detectSdk()
    if (!sdk.root) return process.env
    return {
      ...process.env,
      ANDROID_HOME: sdk.root,
      ANDROID_SDK_ROOT: sdk.root,
      PATH: `${join(sdk.root, 'platform-tools')}${delimiter}${join(
        sdk.root,
        'emulator'
      )}${delimiter}${process.env['PATH'] ?? ''}`
    }
  }

  private readAvdDiskProfile(avdName: string): AvdDiskProfile {
    const avdHome = getAvdHome()
    const iniPath = join(avdHome, `${avdName}.ini`)
    let avdPath = join(avdHome, `${avdName}.avd`)
    let target: string | null = null

    if (existsSync(iniPath)) {
      try {
        const ini = parseIni(readFileSync(iniPath, 'utf8'))
        if (ini['path']) avdPath = ini['path']
        target = ini['target'] ?? null
      } catch (err) {
        getLogger().warn('Failed to read AVD ini file', {
          avdName,
          iniPath,
          error: err instanceof Error ? err.message : String(err)
        })
      }
    }

    const configPath = join(avdPath, 'config.ini')
    if (!existsSync(configPath)) {
      return { path: avdPath, target, abi: null, systemImage: null }
    }

    try {
      const config = parseIni(readFileSync(configPath, 'utf8'))
      const systemImage = config['image.sysdir.1'] ?? config['image.sysdir'] ?? null
      const rawAbi =
        config['abi.type'] ?? inferAbiFromSystemImage(systemImage) ?? config['hw.cpu.arch'] ?? null
      const abi = rawAbi ? String(normalizeEmulatorAbi(rawAbi)) : null
      return {
        path: avdPath,
        target: target ?? config['target'] ?? null,
        abi,
        systemImage
      }
    } catch (err) {
      getLogger().warn('Failed to read AVD config.ini', {
        avdName,
        configPath,
        error: err instanceof Error ? err.message : String(err)
      })
      return { path: avdPath, target, abi: null, systemImage: null }
    }
  }

  private getAvdCompatibilityError(avdName: string): string | null {
    const profile = this.readAvdDiskProfile(avdName)
    if (!profile.abi || isEmulatorAbiCompatible(profile.abi, process.platform, process.arch)) {
      return null
    }
    return `AVD "${avdName}" cannot run on this machine. ${incompatibleAbiMessage(
      profile.abi,
      process.platform,
      process.arch
    )}`
  }

  private formatEmulatorExitMessage(
    code: number | null,
    signal: NodeJS.Signals | null,
    output: string
  ): string {
    const diagnostic = extractEmulatorDiagnostic(output)
    const archMatch = output.match(/Avd's CPU Architecture '([^']+)'/i)
    if (archMatch?.[1]) {
      return `Emulator process exited unexpectedly (code ${code ?? signal ?? '?'}). ${incompatibleAbiMessage(
        archMatch[1],
        process.platform,
        process.arch
      )}`
    }
    return `Emulator process exited unexpectedly (code ${code ?? signal ?? '?'})${
      diagnostic ? `: ${diagnostic}` : ''
    }`
  }

  async listAvds(): Promise<AvdInfo[]> {
    const bin = this.resolveEmulatorBinary()
    if (!bin) return []
    return new Promise((resolve, reject) => {
      const out: string[] = []
      const errOut: string[] = []
      const proc = spawn(bin, ['-list-avds'], {
        windowsHide: true,
        env: this.buildSdkEnv()
      })
      proc.stdout?.on('data', (c: Buffer) => out.push(c.toString('utf8')))
      proc.stderr?.on('data', (c: Buffer) => errOut.push(c.toString('utf8')))
      proc.on('error', reject)
      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(errOut.join('').trim() || `emulator -list-avds exited ${code}`))
          return
        }
        const names = out
          .join('')
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 0 && !l.startsWith('INFO') && !l.startsWith('WARNING'))
        resolve(
          names.map((name) => {
            const profile = this.readAvdDiskProfile(name)
            return {
              name,
              device: null,
              target: profile.target,
              systemImage: profile.systemImage ?? profile.abi,
              path: profile.path
            }
          })
        )
      })
    })
  }

  getSelectedAvd(): string | null {
    return this.selectedAvd
  }

  selectAvd(name: string): void {
    this.selectedAvd = name
  }

  async start(): Promise<void> {
    if (
      this.status.state === 'running' ||
      this.status.state === 'starting' ||
      this.status.state === 'booting'
    ) {
      return
    }

    const adbPath = resolveAdbPath()
    if (!adbPath) {
      this.setStatus({
        state: 'missing-dependencies',
        avdName: this.selectedAvd,
        serial: null,
        errorMessage: 'adb not installed. Run first-time setup in Settings.'
      })
      throw new Error('adb not installed')
    }

    const emulatorBin = this.resolveEmulatorBinary()
    if (!emulatorBin) {
      this.setStatus({
        state: 'missing-dependencies',
        avdName: this.selectedAvd,
        serial: null,
        errorMessage:
          'Android emulator binary not found. Install via Android Studio or sdkmanager, then set ANDROID_HOME.'
      })
      throw new Error('emulator binary not found')
    }

    if (!this.selectedAvd) {
      const avds = await this.listAvds()
      if (avds.length === 0) {
        this.setStatus({
          state: 'missing-dependencies',
          avdName: null,
          serial: null,
          errorMessage:
            'No Android Virtual Devices found. Create one via Android Studio → Device Manager, then refresh.'
        })
        throw new Error('No AVDs available')
      }
      const first = avds[0]
      if (!first) throw new Error('No AVDs available')
      this.selectedAvd = first.name
    }

    const avdName = this.selectedAvd
    const compatibilityError = this.getAvdCompatibilityError(avdName)
    if (compatibilityError) {
      this.setStatus({
        state: 'error',
        avdName,
        serial: null,
        errorMessage: compatibilityError
      })
      throw new Error(compatibilityError)
    }

    this.setStatus({ state: 'starting', avdName, serial: null })
    bus.emit('emulator:bootProgress', {
      phase: 'booting',
      percent: 5,
      message: `Spawning emulator for ${avdName}…`
    })

    const log = getLogger()
    const logsDir = getPaths().logs
    this.stdoutStream = createWriteStream(join(logsDir, 'emulator.stdout.log'), { flags: 'a' })
    this.stderrStream = createWriteStream(join(logsDir, 'emulator.stderr.log'), { flags: 'a' })

    // Run the emulator headless so only the MobSec Studio window is visible;
    // scrcpy mirrors the internal display into our embedded canvas.
    //
    // `-gpu` stays software-rendered because `-no-window` has no native
    // surface for a host GPU. SwANGLE is the fast Windows path; SwiftShader
    // is the portable macOS/Linux backend.
    //
    // `-cores 4` lets the VM use up to 4 host CPU cores. The Android system
    // server, surface flinger, and MediaCodec encoder all benefit dramatically.
    //
    // `-no-snapshot-save` avoids dumping a multi-GB snapshot on each shutdown,
    // which speeds up `stop` calls significantly.
    const args = [
      '-avd',
      avdName,
      '-no-window',
      '-gpu',
      emulatorGpuMode(),
      '-cores',
      '4',
      '-no-snapshot-load',
      '-no-snapshot-save',
      '-no-boot-anim',
      '-no-audio',
      '-writable-system',
      '-netfast'
    ]
    log.info('Launching emulator', { bin: emulatorBin, avdName, args })

    let proc: ChildProcess
    try {
      proc = spawn(emulatorBin, args, {
        windowsHide: true,
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: this.buildSdkEnv()
      })
    } catch (err) {
      this.setStatus({
        state: 'error',
        avdName,
        serial: null,
        errorMessage: err instanceof Error ? err.message : String(err)
      })
      throw err
    }

    this.process = proc
    let recentOutput = ''
    let rejectEarlyExit: ((err: Error) => void) | null = null
    const earlyExit = new Promise<never>((_, reject) => {
      rejectEarlyExit = reject
    })
    proc.stdout?.on('data', (chunk: Buffer) => {
      recentOutput = appendRollingOutput(recentOutput, chunk)
      this.stdoutStream?.write(chunk)
    })
    proc.stderr?.on('data', (chunk: Buffer) => {
      recentOutput = appendRollingOutput(recentOutput, chunk)
      this.stderrStream?.write(chunk)
    })
    proc.on('exit', (code, signal) => {
      const exitMessage = this.formatEmulatorExitMessage(code, signal, recentOutput)
      log.info('Emulator process exited', { code, signal, diagnostic: exitMessage })
      this.process = null
      this.stdoutStream?.end()
      this.stderrStream?.end()
      this.stdoutStream = null
      this.stderrStream = null
      // If we weren't told to stop, surface as an error.
      if (this.status.state !== 'stopping' && this.status.state !== 'idle') {
        this.setStatus({
          state: 'error',
          avdName,
          serial: null,
          errorMessage: exitMessage
        })
        rejectEarlyExit?.(new Error(exitMessage))
        rejectEarlyExit = null
      } else {
        this.setStatus({ state: 'idle', avdName: null, serial: null })
      }
    })
    proc.on('error', (err) => {
      log.error('Emulator spawn error', { error: err.message })
      this.setStatus({
        state: 'error',
        avdName,
        serial: null,
        errorMessage: err.message
      })
      rejectEarlyExit?.(err)
      rejectEarlyExit = null
    })

    try {
      // Wait for adb to see the emulator
      bus.emit('emulator:bootProgress', {
        phase: 'booting',
        percent: 25,
        message: 'Waiting for adb to detect the device…'
      })
      const serial = await Promise.race([this.waitForEmulatorSerial(120_000), earlyExit])
      this.setStatus({ state: 'booting', avdName, serial })

      bus.emit('emulator:bootProgress', {
        phase: 'booting',
        percent: 60,
        message: 'Booting Android…'
      })
      await waitForBootCompleted(serial, 240_000)

      bus.emit('emulator:bootProgress', {
        phase: 'configuring',
        percent: 90,
        message: 'Finalizing setup…'
      })

      // Performance tweaks for the software-GPU emulator: disable system-wide
      // animations. Each animation tick forces SurfaceFlinger to recomposite,
      // which in software-rendered mode is the single biggest framerate sink.
      // We don't fail boot if these settings fail — they're best-effort.
      const animTweaks = [
        'settings put global window_animation_scale 0',
        'settings put global transition_animation_scale 0',
        'settings put global animator_duration_scale 0'
      ]
      for (const cmd of animTweaks) {
        await shell(serial, cmd).catch((err) => {
          log.warn('Failed to apply animation tweak', {
            cmd,
            error: err instanceof Error ? err.message : String(err)
          })
        })
      }
      // Phase 3 will: adb root + push frida + install CA.

      this.setStatus({ state: 'running', avdName, serial })
      bus.emit('emulator:bootProgress', {
        phase: 'ready',
        percent: 100,
        message: 'Emulator ready'
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.error('Emulator boot failed', { error: message })
      this.setStatus({
        state: 'error',
        avdName,
        serial: null,
        errorMessage: message
      })
      this.killProcess()
      throw err
    }
  }

  async stop(): Promise<void> {
    if (this.status.state === 'idle' || this.status.state === 'stopping') return

    const avdName = this.status.avdName
    const serial = this.status.serial
    this.setStatus({ state: 'stopping', avdName, serial })

    // Prefer graceful shutdown via `reboot -p` if we have a serial, but
    // cap the wait so a stuck device doesn't keep us in 'stopping' for
    // 30 seconds (adb's default command timeout).
    if (serial) {
      await Promise.race([shell(serial, 'reboot -p').catch(() => undefined), sleep(3000)])
    }
    this.killProcess()

    // The exit handler flips state back to idle; if it didn't run within a
    // generous window, force-set state ourselves. TS can't see the async
    // mutation, so read through a string view to compare.
    const start = Date.now()
    while (this.process && Date.now() - start < 5000) {
      await sleep(200)
    }
    const currentState: string = this.status.state
    if (currentState === 'stopping') {
      this.setStatus({ state: 'idle', avdName: null, serial: null })
    }
  }

  /**
   * Fast-path stop for app-quit: skip the graceful `reboot -p` and go
   * straight to taskkill-tree on the emulator process. Returns once the
   * tree is reaped (or after a short ceiling). The graceful path is
   * appropriate when the user clicks Stop in the UI, but on app exit we
   * want the qemu children dead *now* so the user doesn't have to kill
   * them by hand from Task Manager.
   */
  async forceStop(): Promise<void> {
    if (this.status.state === 'idle') return
    const avdName = this.status.avdName
    this.setStatus({ state: 'stopping', avdName, serial: this.status.serial })
    this.killProcess()
    const start = Date.now()
    while (this.process && Date.now() - start < 4000) {
      await sleep(150)
    }
    this.setStatus({ state: 'idle', avdName: null, serial: null })
  }

  async restart(): Promise<void> {
    await this.stop()
    await this.start()
  }

  async sendKey(keyName: string): Promise<void> {
    if (this.status.state !== 'running' || !this.status.serial) {
      throw new Error('Emulator is not running')
    }
    if (!(keyName in KeyCode)) {
      throw new Error(`Unknown key: ${keyName}`)
    }
    const keycode = KeyCode[keyName as AdbKey]
    await inputKeyEvent(this.status.serial, keycode)
  }

  async installApk(filePath: string): Promise<{ packageName: string }> {
    if (this.status.state !== 'running' || !this.status.serial) {
      throw new Error('Emulator is not running')
    }
    const result = await adbInstallApk(this.status.serial, filePath)
    return { packageName: result.packageName }
  }

  async listInstalledApps(): Promise<{ packageName: string; label: string }[]> {
    if (this.status.state !== 'running' || !this.status.serial) return []
    const serial = this.status.serial
    const packages = await listInstalledPackages(serial, 'third-party')
    // Resolving labels for every package is slow; for Phase 2 we return the
    // package name as the label and let the renderer show both columns.
    return Promise.all(
      packages.map(async (pkg) => {
        const label = await getAppLabel(serial, pkg).catch(() => pkg)
        return { packageName: pkg, label }
      })
    )
  }

  async launchApp(packageName: string): Promise<void> {
    if (this.status.state !== 'running' || !this.status.serial) {
      throw new Error('Emulator is not running')
    }
    await adbLaunchApp(this.status.serial, packageName)
  }

  private async waitForEmulatorSerial(timeoutMs: number): Promise<string> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      try {
        const devices = await listDevices()
        const emu = devices.find((d) => d.serial.startsWith('emulator-') && d.state === 'device')
        if (emu) return emu.serial
      } catch {
        // adb may not be ready yet
      }
      await sleep(1500)
    }
    throw new Error('Timed out waiting for emulator to appear in adb devices')
  }

  private killProcess(): void {
    if (!this.process) return
    try {
      if (process.platform === 'win32') {
        // emulator spawns child qemu processes; killing only the parent leaks.
        // taskkill /T kills the whole tree.
        spawn('taskkill', ['/PID', String(this.process.pid), '/T', '/F'], {
          windowsHide: true
        })
      } else if (this.process.pid) {
        try {
          process.kill(-this.process.pid, 'SIGTERM')
        } catch {
          this.process.kill('SIGTERM')
        }
      }
    } catch (err) {
      getLogger().warn('Failed to kill emulator process', {
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }

  private setStatus(next: EmulatorStatus): void {
    this.status = next
    bus.emit('emulator:status', next)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const emulatorService = new EmulatorService()
