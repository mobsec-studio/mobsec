import { type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { platform } from 'node:os'
import { getLogger } from '../utils/logger'
import { getPaths } from '../utils/paths'
import { safeSpawn } from '../utils/spawn'

/**
 * Thin wrapper around the Android SDK Manager (`sdkmanager`) shipped inside
 * the command-line-tools package. We always invoke it with `--sdk_root` set
 * to our managed tools directory so installs land in a predictable location.
 *
 * License acceptance is short-circuited by writing the well-known hash files
 * into `<sdk_root>/licenses/`. These hashes correspond to the user's
 * acceptance of each license bundle; they're stable across Google's tooling
 * releases. If a future SDK introduces a new license id we'll get a friendly
 * error from sdkmanager and add the hash here.
 */

// SHA1 hashes representing accepted licenses. These are not secrets — every
// CI script that uses sdkmanager writes the same values.
const LICENSE_HASHES: Record<string, string[]> = {
  'android-sdk-license': ['24333f8a63b6825ea9c5514f83c2829b004d1fee'],
  'android-sdk-preview-license': ['84831b9409646a918e30573bab4c9c91346d8abd'],
  'intel-android-extra-license': ['d975f751698a77b662f1254ddbeed3901e976f5a'],
  'mips-android-sysimage-license': ['e9acab5b5fbb560a72cfaecce8946896ff6aab9d'],
  'android-googletv-license': ['601085b94cd77f0b54ff86406957099ebe79c4d6'],
  'android-sdk-arm-dbt-license': ['859f317696f67ef3d7f30a50a5560e7834b43903']
}

export interface SdkmanagerProgressHandler {
  (percent: number, operation: string): void
}

export function getSdkmanagerPath(): string | null {
  const tools = getPaths().tools
  const bin = platform() === 'win32' ? 'sdkmanager.bat' : 'sdkmanager'
  const candidate = join(tools, 'cmdline-tools', 'latest', 'bin', bin)
  return existsSync(candidate) ? candidate : null
}

export function getSdkRoot(): string {
  return getPaths().tools
}

export function isSdkmanagerInstalled(): boolean {
  return getSdkmanagerPath() !== null
}

/**
 * Pre-write all known license-acceptance files. This avoids the interactive
 * `sdkmanager --licenses` prompt entirely on first install.
 */
export function writeLicenseAcceptanceFiles(): void {
  const licensesDir = join(getSdkRoot(), 'licenses')
  mkdirSync(licensesDir, { recursive: true })
  for (const [name, hashes] of Object.entries(LICENSE_HASHES)) {
    const target = join(licensesDir, name)
    // Each hash on its own line; `\n` separator works on all platforms.
    writeFileSync(target, hashes.join('\n') + '\n')
  }
}

/**
 * Run `sdkmanager <args>` with progress callbacks. sdkmanager prints lines
 * like `[=========    ] 25% Downloading…` with carriage-return updates, so we
 * normalize chunks on both \r and \n.
 */
export function runSdkmanager(
  args: string[],
  onProgress: SdkmanagerProgressHandler,
  abort?: AbortSignal
): Promise<void> {
  const bin = getSdkmanagerPath()
  if (!bin) throw new Error('sdkmanager not installed yet')

  const sdkRoot = getSdkRoot()
  const log = getLogger()

  return new Promise((resolve, reject) => {
    let proc: ChildProcess
    try {
      const env = {
        ...process.env,
        ANDROID_HOME: sdkRoot,
        ANDROID_SDK_ROOT: sdkRoot,
        // Some tools call out to other JDK/JRE bits via PATH. Inject our
        // platform-tools dir so adb is reachable too.
        PATH: `${join(sdkRoot, 'platform-tools')}${delimiter}${process.env['PATH'] ?? ''}`
      }
      proc = safeSpawn(bin, [`--sdk_root=${sdkRoot}`, ...args], {
        env,
        windowsHide: true
      })
    } catch (err) {
      reject(err)
      return
    }

    if (abort) {
      abort.addEventListener(
        'abort',
        () => {
          try {
            if (process.platform === 'win32' && proc.pid) {
              safeSpawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], {
                windowsHide: true
              })
            } else {
              proc.kill('SIGTERM')
            }
          } catch {
            // ignore
          }
          reject(new Error('sdkmanager cancelled'))
        },
        { once: true }
      )
    }

    let buffered = ''
    const handleChunk = (chunk: Buffer): void => {
      buffered += chunk.toString('utf8')
      // Split on either CR or LF so we catch progress updates.
      const parts = buffered.split(/[\r\n]+/)
      buffered = parts.pop() ?? ''
      for (const line of parts) {
        if (!line.trim()) continue
        log.debug(`[sdkmanager] ${line}`)
        const m = line.match(/\[.*?\]\s*(\d+)%\s*(.+)$/)
        if (m) {
          const percent = Number(m[1])
          const op = m[2]!.trim()
          onProgress(percent, op)
        }
      }
    }
    proc.stdout?.on('data', handleChunk)
    proc.stderr?.on('data', handleChunk)

    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`sdkmanager exited ${code}`))
    })

    // sdkmanager prompts "Accept? (y/N):" for each license bundle. Feed it
    // continuous "y" newlines in case the license files weren't pre-written.
    if (args.includes('--licenses')) {
      const yes = 'y\n'.repeat(64)
      proc.stdin?.write(yes)
      proc.stdin?.end()
    } else {
      proc.stdin?.end()
    }
  })
}

/**
 * Convenience for installing a single sdkmanager package.
 *
 * Examples of packages:
 *   - "platform-tools"
 *   - "emulator"
 *   - "platforms;android-33"
 *   - "system-images;android-33;google_apis;x86_64"
 */
export async function installSdkPackage(
  pkg: string,
  onProgress: SdkmanagerProgressHandler,
  abort?: AbortSignal
): Promise<void> {
  await runSdkmanager([pkg], onProgress, abort)
}
