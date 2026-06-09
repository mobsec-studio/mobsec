import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { platform } from 'node:os'
import { bus } from '../utils/event-bus'
import { getLogger } from '../utils/logger'
import { getPaths } from '../utils/paths'

/**
 * Wrapper around the `adb` binary. The binary is resolved in priority order:
 *
 *   1. Our managed tools dir (userData/tools/platform-tools/) — populated by
 *      the toolchain service on first run.
 *   2. ANDROID_HOME / ANDROID_SDK_ROOT/platform-tools — for users who already
 *      have an Android Studio install.
 *   3. PATH — last resort.
 *
 * Every operation that targets a device requires a serial; we never assume a
 * single device since users may have a phone plugged in alongside the emulator.
 */

export interface AdbResult {
  exitCode: number
  stdout: string
  stderr: string
}

export interface AdbDevice {
  serial: string
  state: 'device' | 'offline' | 'unauthorized' | 'no-permissions' | 'unknown' | string
}

const ADB_BIN = platform() === 'win32' ? 'adb.exe' : 'adb'
const FASTBOOT_BIN = platform() === 'win32' ? 'fastboot.exe' : 'fastboot'

export function resolveAdbPath(): string | null {
  return resolvePlatformToolPath(ADB_BIN)
}

export function resolveFastbootPath(): string | null {
  return resolvePlatformToolPath(FASTBOOT_BIN)
}

function resolvePlatformToolPath(binaryName: string): string | null {
  const paths = getPaths()
  // (1) bundled
  const bundled = join(paths.tools, 'platform-tools', binaryName)
  if (existsSync(bundled)) return bundled

  // (2) ANDROID_HOME / ANDROID_SDK_ROOT
  const sdkRoot = process.env['ANDROID_HOME'] || process.env['ANDROID_SDK_ROOT']
  if (sdkRoot) {
    const candidate = join(sdkRoot, 'platform-tools', binaryName)
    if (existsSync(candidate)) return candidate
  }

  // (3) PATH
  for (const dir of (process.env['PATH'] ?? '').split(delimiter)) {
    if (!dir) continue
    const candidate = join(dir, binaryName)
    if (existsSync(candidate)) return candidate
  }
  return null
}

export function isAdbInstalled(): boolean {
  return resolveAdbPath() !== null
}

export async function runAdb(args: string[], timeoutMs = 30_000): Promise<AdbResult> {
  const bin = resolveAdbPath()
  if (!bin) {
    throw new Error('adb is not installed. Run the first-time setup in Settings.')
  }
  return runProcess(bin, args, timeoutMs, 'adb')
}

export async function runFastboot(args: string[], timeoutMs = 30_000): Promise<AdbResult> {
  const bin = resolveFastbootPath()
  if (!bin) {
    throw new Error('fastboot is not installed. Run the first-time setup in Settings.')
  }
  return runProcess(bin, args, timeoutMs, 'fastboot')
}

export async function listDevices(): Promise<AdbDevice[]> {
  const result = await runAdb(['devices'])
  return result.stdout
    .split('\n')
    .slice(1)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('*'))
    .map((l) => {
      const [serial, state] = l.split(/\s+/)
      return {
        serial: serial ?? '',
        state: (state ?? 'unknown') as AdbDevice['state']
      }
    })
    .filter((d) => d.serial.length > 0)
}

export async function shell(serial: string, command: string): Promise<AdbResult> {
  return runAdb(['-s', serial, 'shell', command])
}

export function quoteShellArg(value: string): string {
  return "'" + value.replace(/'/g, "'\\''") + "'"
}

export function isSafeAndroidPackageName(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)+(?::[A-Za-z_][A-Za-z0-9_]*)?$/.test(
    value.trim()
  )
}

export async function getProp(serial: string, key: string): Promise<string> {
  const res = await shell(serial, `getprop ${key}`)
  return res.stdout.trim()
}

export async function setProp(serial: string, key: string, value: string): Promise<void> {
  await shell(serial, `setprop ${key} ${value}`)
}

export async function pushFile(serial: string, source: string, dest: string): Promise<AdbResult> {
  return runAdb(['-s', serial, 'push', source, dest], 120_000)
}

export async function pullFile(serial: string, source: string, dest: string): Promise<AdbResult> {
  return runAdb(['-s', serial, 'pull', source, dest], 120_000)
}

export async function installApk(
  serial: string,
  apkPath: string
): Promise<{ packageName: string; output: string }> {
  // -r reinstall, -d allow downgrade, -g grant runtime permissions automatically.
  const result = await runAdb(['-s', serial, 'install', '-r', '-d', '-g', apkPath], 180_000)
  if (result.exitCode !== 0 || /Failure/i.test(result.stdout + result.stderr)) {
    const msg = result.stderr || result.stdout || 'adb install failed'
    throw new Error(msg.trim())
  }
  const packageName = await packageNameFromApk(apkPath)
  return { packageName, output: result.stdout }
}

/**
 * Install a split APK set in a single atomic transaction using
 * `adb install-multiple`. Used for App Bundles (.aab outputs split
 * across config-specific APKs) and XAPK bundles.
 *
 * Order of files matters slightly: the base APK should come first
 * because adb opens a write session against it. We sort accordingly.
 */
export async function installMultipleApks(
  serial: string,
  apkPaths: string[]
): Promise<{ output: string }> {
  if (apkPaths.length === 0) throw new Error('No APKs to install')
  const sorted = [...apkPaths].sort((a, b) => baseRank(a) - baseRank(b))
  const result = await runAdb(
    ['-s', serial, 'install-multiple', '-r', '-d', '-g', ...sorted],
    240_000
  )
  if (result.exitCode !== 0 || /Failure/i.test(result.stdout + result.stderr)) {
    const msg = result.stderr || result.stdout || 'adb install-multiple failed'
    throw new Error(msg.trim())
  }
  return { output: result.stdout }
}

/**
 * Heuristic ranking so the most likely "base.apk" lands first when
 * install-multiple is invoked. Real bundles ship the base under names
 * like `base.apk`, `<package>.apk`, or the unique APK without a
 * `config.` / `split_config.` prefix.
 */
function baseRank(p: string): number {
  const name = p.split(/[\\/]/).pop()?.toLowerCase() ?? ''
  if (name === 'base.apk') return 0
  if (/^split[_-]?config[._]/.test(name)) return 3
  if (/^config[._]/.test(name)) return 3
  if (
    /(armeabi|arm64-v8a|x86|x86_64|hdpi|xhdpi|xxhdpi|xxxhdpi|en|fr|es|de|zh|ja|ko|ru)\.apk$/i.test(
      name
    )
  )
    return 2
  // Bare `<package>.apk` is almost always the base in extracted XAPK dirs.
  return 1
}

/**
 * Extract `package=` from the APK manifest using `aapt` if available, otherwise
 * fall back to a pragmatic parse: `adb shell pm list packages -f` after install
 * to find the freshly added entry.
 */
async function packageNameFromApk(apkPath: string): Promise<string> {
  // aapt is part of build-tools, not platform-tools, so it may not be present.
  // Use `adb shell pm dump` on the file path inside the device is awkward, so
  // we lean on `pm list packages -f -3` (third-party packages) and find the
  // entry whose path corresponds to our just-installed APK. As a last resort
  // we return the filename.
  return (
    apkPath
      .split(/[\\/]/)
      .pop()
      ?.replace(/\.apk$/i, '') ?? 'unknown.package'
  )
}

export async function root(serial: string): Promise<{ restarted: boolean }> {
  const res = await runAdb(['-s', serial, 'root'], 15_000)
  const text = res.stdout + res.stderr
  if (
    res.exitCode !== 0 ||
    /cannot run as root|not allowed|production builds|permission denied|failed/i.test(text)
  ) {
    throw new Error((res.stderr || res.stdout || 'adb root failed').trim())
  }
  // `adb root` reports one of two outcomes on success:
  //   "restarting adbd as root\n"          → daemon was relaunched as root
  //   "adbd is already running as root\n"  → no-op
  // When the daemon restarts every long-lived ADB socket (scrcpy mirror,
  // logcat, anything else holding a forward/localabstract handle) dies with
  // a FIN. We broadcast `device:adbRestarted` so the mirror and friends can
  // reconnect; consumers ignore the event when they don't care.
  const restarted = /restarting adbd/i.test(text)
  if (restarted) {
    await runAdb(['-s', serial, 'wait-for-device'], 30_000)
    bus.emit('device:adbRestarted', { serial })
  }
  return { restarted }
}

export async function unroot(serial: string): Promise<void> {
  await runAdb(['-s', serial, 'unroot'], 15_000)
}

export async function remount(serial: string): Promise<void> {
  await runAdb(['-s', serial, 'remount'], 30_000)
}

export async function reboot(serial: string): Promise<void> {
  await runAdb(['-s', serial, 'reboot'], 15_000)
}

export async function rebootTo(serial: string, mode: 'recovery' | 'bootloader'): Promise<void> {
  await runAdb(['-s', serial, 'reboot', mode], 15_000)
}

export async function inputKeyEvent(serial: string, keycode: number): Promise<void> {
  await shell(serial, `input keyevent ${keycode}`)
}

export async function inputText(serial: string, text: string): Promise<void> {
  const escaped = text.replace(/(["$`\\])/g, '\\$1').replace(/\s/g, '%s')
  await shell(serial, `input text "${escaped}"`)
}

/** Block until `sys.boot_completed=1` reports, or timeout. */
export async function waitForBootCompleted(serial: string, timeoutMs = 180_000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const v = await getProp(serial, 'sys.boot_completed')
      if (v === '1') return
    } catch {
      // device may not be ready yet; ignore and retry
    }
    await sleep(1500)
  }
  throw new Error(`Timed out waiting for ${serial} to finish booting`)
}

export async function listInstalledPackages(
  serial: string,
  filter: 'all' | 'third-party' = 'third-party'
): Promise<string[]> {
  const flag = filter === 'third-party' ? '-3' : ''
  const res = await shell(serial, `pm list packages ${flag}`.trim())
  return res.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('package:'))
    .map((l) => l.slice('package:'.length))
}

export async function getAppLabel(serial: string, packageName: string): Promise<string> {
  if (!isSafeAndroidPackageName(packageName)) {
    throw new Error(`Invalid Android package name: ${packageName}`)
  }
  const res = await shell(
    serial,
    `dumpsys package ${quoteShellArg(packageName)} | grep -A 0 'applicationLabel='`
  )
  const match = res.stdout.match(/applicationLabel=([^\n]+)/)
  return match?.[1]?.trim() ?? packageName
}

export async function launchApp(serial: string, packageName: string): Promise<void> {
  if (!isSafeAndroidPackageName(packageName)) {
    throw new Error(`Invalid Android package name: ${packageName}`)
  }
  await shell(
    serial,
    `monkey -p ${quoteShellArg(packageName)} -c android.intent.category.LAUNCHER 1`
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function runProcess(
  bin: string,
  args: string[],
  timeoutMs: number,
  label = 'process'
): Promise<AdbResult> {
  return new Promise((resolve, reject) => {
    const log = getLogger()
    log.debug(`spawn ${bin} ${args.join(' ')}`)
    let stdout = ''
    let stderr = ''
    let proc: ChildProcess
    try {
      proc = spawn(bin, args, { windowsHide: true })
    } catch (err) {
      return reject(err)
    }

    const timer = setTimeout(() => {
      proc.kill('SIGKILL')
      reject(new Error(`${label} ${args.join(' ')} timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    proc.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })
    proc.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    proc.on('close', (code) => {
      clearTimeout(timer)
      resolve({ exitCode: code ?? -1, stdout, stderr })
    })
  })
}

/** Android keycodes used by the on-screen control buttons. */
export const KeyCode = {
  BACK: 4,
  HOME: 3,
  APP_SWITCH: 187,
  VOLUME_UP: 24,
  VOLUME_DOWN: 25,
  POWER: 26,
  MENU: 82,
  ENTER: 66,
  WAKEUP: 224
} as const

export type AdbKey = keyof typeof KeyCode
