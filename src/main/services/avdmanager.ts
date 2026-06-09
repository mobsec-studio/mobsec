import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { delimiter, join } from 'node:path'
import { getLogger } from '../utils/logger'
import { getPaths } from '../utils/paths'
import { safeSpawn } from '../utils/spawn'

/**
 * Wraps the `avdmanager` binary that ships inside cmdline-tools. Creates and
 * deletes Android Virtual Devices, plus tweaks `config.ini` for the right
 * RAM/disk/GPU defaults.
 *
 * Note: avdmanager writes AVDs to `~/.android/avd` by default. The `emulator`
 * binary picks them up from there. We don't override that location because
 * mixing custom paths with Android Studio's own tooling causes confusion.
 */

export function getAvdmanagerPath(): string | null {
  const tools = getPaths().tools
  const bin = platform() === 'win32' ? 'avdmanager.bat' : 'avdmanager'
  const candidate = join(tools, 'cmdline-tools', 'latest', 'bin', bin)
  return existsSync(candidate) ? candidate : null
}

export function getAvdHome(): string {
  return process.env['ANDROID_AVD_HOME'] ?? join(homedir(), '.android', 'avd')
}

interface CreateAvdOptions {
  name: string
  systemImage: string
  deviceProfile: string
  ramMb: number
  diskGb: number
}

export async function createAvd(opts: CreateAvdOptions): Promise<void> {
  const bin = getAvdmanagerPath()
  if (!bin) throw new Error('avdmanager not installed yet')

  const sdkRoot = getPaths().tools
  const log = getLogger()
  log.info('Creating AVD', opts)

  await new Promise<void>((resolve, reject) => {
    const proc = safeSpawn(
      bin,
      [
        'create',
        'avd',
        '--force',
        '--name',
        opts.name,
        '--package',
        opts.systemImage,
        '--device',
        opts.deviceProfile
      ],
      {
        env: {
          ...process.env,
          ANDROID_HOME: sdkRoot,
          ANDROID_SDK_ROOT: sdkRoot,
          PATH: `${join(sdkRoot, 'platform-tools')}${delimiter}${process.env['PATH'] ?? ''}`
        },
        windowsHide: true
      }
    )
    let stderr = ''
    proc.stderr?.on('data', (c: Buffer) => {
      stderr += c.toString('utf8')
    })
    proc.stdout?.on('data', (c: Buffer) => {
      log.debug(`[avdmanager] ${c.toString('utf8').trim()}`)
    })
    // The single interactive prompt is "Do you wish to create a custom hardware profile? [no]"
    proc.stdin?.write('no\n')
    proc.stdin?.end()
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`avdmanager exited ${code}: ${stderr.trim() || 'unknown error'}`))
    })
  })

  // After creation, tweak config.ini to give the AVD enough RAM/disk and a
  // sensible GPU mode. These keys are documented in the AVD config schema.
  tuneAvdConfig(opts)
}

export async function deleteAvd(name: string): Promise<void> {
  const bin = getAvdmanagerPath()
  if (!bin) throw new Error('avdmanager not installed yet')
  const sdkRoot = getPaths().tools
  await new Promise<void>((resolve, reject) => {
    const proc = safeSpawn(bin, ['delete', 'avd', '--name', name], {
      env: {
        ...process.env,
        ANDROID_HOME: sdkRoot,
        ANDROID_SDK_ROOT: sdkRoot
      },
      windowsHide: true
    })
    let stderr = ''
    proc.stderr?.on('data', (c: Buffer) => {
      stderr += c.toString('utf8')
    })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`avdmanager exited ${code}: ${stderr.trim() || 'unknown error'}`))
    })
  })
}

function tuneAvdConfig(opts: CreateAvdOptions): void {
  const configPath = join(getAvdHome(), `${opts.name}.avd`, 'config.ini')
  if (!existsSync(configPath)) {
    getLogger().warn(`AVD config.ini not found at ${configPath}; skipping tune step`)
    return
  }
  const lines = readFileSync(configPath, 'utf8').split(/\r?\n/)
  const overrides: Record<string, string> = {
    'hw.ramSize': String(opts.ramMb),
    'vm.heapSize': '512',
    'disk.dataPartition.size': `${opts.diskGb}G`,
    'hw.keyboard': 'yes',
    'hw.gpu.enabled': 'yes',
    'hw.gpu.mode': 'host',
    'showDeviceFrame': 'no',
    'PlayStore.enabled': 'no'
  }
  const seen = new Set<string>()
  const updated = lines.map((line) => {
    const eq = line.indexOf('=')
    if (eq <= 0) return line
    const key = line.slice(0, eq).trim()
    if (overrides[key] !== undefined) {
      seen.add(key)
      return `${key}=${overrides[key]}`
    }
    return line
  })
  for (const [k, v] of Object.entries(overrides)) {
    if (!seen.has(k)) updated.push(`${k}=${v}`)
  }
  writeFileSync(configPath, updated.join('\n').replace(/\n+$/, '') + '\n')
}

export async function listAvds(): Promise<string[]> {
  const bin = getAvdmanagerPath()
  if (!bin) return []
  return new Promise((resolve, reject) => {
    const proc = safeSpawn(bin, ['list', 'avd', '-c'], { windowsHide: true })
    let out = ''
    proc.stdout?.on('data', (c: Buffer) => {
      out += c.toString('utf8')
    })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`avdmanager exited ${code}`))
      const names = out
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith('Parsing'))
      resolve(names)
    })
  })
}
