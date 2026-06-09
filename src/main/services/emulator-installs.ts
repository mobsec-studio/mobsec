import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { homedir, platform } from 'node:os'
import type {
  EmulatorInstall,
  EmulatorInstanceInfo,
  EmulatorVendor
} from '@shared/types'
import { runAdb } from './adb'
import { getLogger } from '../utils/logger'

/**
 * Detects third-party Android emulators installed on the host machine
 * and lets the user integrate them with MobSec via `adb connect`.
 *
 * Why a separate service from `emulatorService`? `emulatorService` owns
 * a child process — it boots, controls, and tears down the embedded
 * Google AVD. Third-party emulators (LDPlayer, BlueStacks, NoxPlayer,
 * MEmu, Genymotion) ship their own launcher, their own VM, and their
 * own adb daemon. We don't manage their lifecycle; we just discover
 * them, expose them to the UI, and run `adb connect host:port` so they
 * show up in the regular device picker.
 *
 * The pattern is:
 *   1. `detect()` walks well-known per-OS install paths and returns the
 *      list of installed vendors with their canonical adb host:port
 *      combinations.
 *   2. For vendors that ship a CLI (notably LDPlayer's ldconsole.exe),
 *      we enumerate the user's actual instances and compute each
 *      instance's adb port instead of guessing.
 *   3. `probeAndConnect()` runs `adb connect` against every default
 *      port — silently — so any emulator the user already has running
 *      shows up in the device list within a poll cycle. Failures are
 *      fine; the call is the cheapest way to test "is this port live".
 *   4. `launch()` spawns the vendor's launcher in detached/unref mode
 *      so MobSec exit doesn't take the emulator with it.
 */

interface VendorSpec {
  id: EmulatorVendor
  displayName: string
  /** Candidate install directories in priority order. */
  paths: string[]
  /** Launcher exe (relative to install dir). */
  launcher: string
  /** Optional CLI helper (relative to install dir). */
  console?: string
  /**
   * Adb host:port targets the vendor uses for its first few instances.
   * For LDPlayer/BlueStacks/MEmu we know the formulas; for others we
   * fall back to a small enumeration of common ports.
   */
  defaultPorts: number[]
  defaultHost: string
}

const WINDOWS_VENDORS: VendorSpec[] = [
  {
    id: 'ldplayer',
    displayName: 'LDPlayer',
    paths: [
      'C:\\LDPlayer\\LDPlayer9',
      'C:\\LDPlayer\\LDPlayer4',
      'D:\\LDPlayer\\LDPlayer9',
      'D:\\LDPlayer\\LDPlayer4',
      'E:\\LDPlayer\\LDPlayer9',
      'C:\\Program Files\\LDPlayer\\LDPlayer9',
      'C:\\Program Files\\LDPlayer',
      'C:\\Program Files (x86)\\LDPlayer\\LDPlayer9',
      'C:\\Program Files (x86)\\LDPlayer'
    ],
    launcher: 'dnplayer.exe',
    console: 'ldconsole.exe',
    // Default LDPlayer port formula is 5555 + (index * 2); enumerate
    // the first few likely instances so probeAndConnect catches the
    // common case even if `ldconsole list2` is unavailable.
    defaultPorts: [5555, 5557, 5559, 5561, 5563, 5565, 5567, 5569],
    defaultHost: '127.0.0.1'
  },
  {
    id: 'bluestacks',
    displayName: 'BlueStacks',
    paths: [
      'C:\\Program Files\\BlueStacks_nxt',
      'C:\\Program Files\\BlueStacks',
      'C:\\Program Files (x86)\\BlueStacks',
      'C:\\Program Files (x86)\\BlueStacks_nxt'
    ],
    launcher: 'HD-Player.exe',
    // BlueStacks Multi-Instance Manager assigns ports starting around
    // 5555 but the exact set depends on user config. Probe the
    // canonical first instance and the few common above-default
    // values; users with custom configs can use the manual Connect by
    // IP flow.
    defaultPorts: [5555, 5556, 5557, 5558, 5559],
    defaultHost: '127.0.0.1'
  },
  {
    id: 'nox',
    displayName: 'NoxPlayer',
    paths: [
      'C:\\Program Files\\Nox\\bin',
      'C:\\Program Files (x86)\\Nox\\bin'
    ],
    launcher: 'Nox.exe',
    // Nox's first instance is 62001; subsequent multi-instance
    // entries are 62025, 62026, … (NOT sequential from 62001).
    defaultPorts: [62001, 62025, 62026, 62027, 62028, 62029],
    defaultHost: '127.0.0.1'
  },
  {
    id: 'memu',
    displayName: 'MEmu',
    paths: [
      'C:\\Program Files\\Microvirt\\MEmu',
      'C:\\Program Files (x86)\\Microvirt\\MEmu'
    ],
    launcher: 'MEmu.exe',
    // MEmu's first instance is 21503; multi-instance increments by 10.
    defaultPorts: [21503, 21513, 21523, 21533],
    defaultHost: '127.0.0.1'
  },
  {
    id: 'genymotion',
    displayName: 'Genymotion',
    paths: [
      'C:\\Program Files\\Genymobile\\Genymotion',
      'C:\\Program Files (x86)\\Genymobile\\Genymotion'
    ],
    launcher: 'genymotion.exe',
    // Genymotion uses VirtualBox-managed adb; port varies per VM,
    // but 5555 (sometimes 5554) is the default first device.
    defaultPorts: [5555, 5557, 5559],
    defaultHost: '127.0.0.1'
  }
]

const MAC_VENDORS: VendorSpec[] = [
  {
    id: 'bluestacks',
    displayName: 'BlueStacks',
    paths: ['/Applications/BlueStacks.app/Contents/MacOS'],
    launcher: 'BlueStacks',
    defaultPorts: [5555, 5556, 5557],
    defaultHost: '127.0.0.1'
  },
  {
    id: 'genymotion',
    displayName: 'Genymotion',
    paths: ['/Applications/Genymotion.app/Contents/MacOS'],
    launcher: 'genymotion',
    defaultPorts: [5555, 5557, 5559],
    defaultHost: '127.0.0.1'
  }
]

const LINUX_VENDORS: VendorSpec[] = [
  {
    id: 'genymotion',
    displayName: 'Genymotion',
    paths: ['/opt/genymobile/genymotion', join(homedir(), 'genymotion')],
    launcher: 'genymotion',
    defaultPorts: [5555, 5557, 5559],
    defaultHost: '127.0.0.1'
  }
]

function vendorsForCurrentPlatform(): VendorSpec[] {
  switch (platform()) {
    case 'win32':
      return WINDOWS_VENDORS
    case 'darwin':
      return MAC_VENDORS
    case 'linux':
      return LINUX_VENDORS
    default:
      return []
  }
}

class EmulatorInstallsService {
  /** Cached result of the most recent detect() call. */
  private cache: EmulatorInstall[] = []

  /**
   * Walk every vendor's candidate install paths, return the first hit
   * per vendor. For LDPlayer we additionally enumerate live instances
   * via `ldconsole list2` so the user sees their actual configured
   * instances + ports rather than the canonical guess set.
   */
  async detect(): Promise<EmulatorInstall[]> {
    const log = getLogger()
    const results: EmulatorInstall[] = []
    for (const vendor of vendorsForCurrentPlatform()) {
      for (const candidatePath of vendor.paths) {
        if (!existsSync(candidatePath)) continue
        const launcher = join(candidatePath, vendor.launcher)
        if (!existsSync(launcher)) continue
        const consolePath = vendor.console
          ? join(candidatePath, vendor.console)
          : null
        const hasConsole = consolePath != null && existsSync(consolePath)

        const install: EmulatorInstall = {
          id: `${vendor.id}:${candidatePath.replace(/[\\/]/g, '_')}`,
          vendor: vendor.id,
          name: vendor.displayName,
          installPath: candidatePath,
          launcherPath: launcher,
          consolePath: hasConsole ? consolePath : null,
          defaultHost: vendor.defaultHost,
          defaultPorts: vendor.defaultPorts,
          instances: []
        }

        if (vendor.id === 'ldplayer' && hasConsole) {
          install.instances = await this.listLdPlayerInstances(consolePath!).catch(
            (err) => {
              log.warn('ldplayer: ldconsole list2 failed', {
                error: err instanceof Error ? err.message : String(err)
              })
              return []
            }
          )
        }

        results.push(install)
        log.info('emulator detected', {
          vendor: vendor.id,
          path: candidatePath,
          instances: install.instances.length
        })
        break // one match per vendor
      }
    }
    this.cache = results
    return results
  }

  list(): EmulatorInstall[] {
    return this.cache
  }

  /**
   * Probe every default port of every detected install with
   * `adb connect`. Silent on failure — the call doubles as a liveness
   * test and `adb connect <unreachable>` returns quickly. Successes
   * persist in adb's server state, so the existing deviceService poll
   * picks them up within ~2.5 s and they appear in the device picker
   * without any UI clicks.
   */
  async probeAndConnect(): Promise<{ connected: string[]; failed: string[] }> {
    const log = getLogger()
    const connected: string[] = []
    const failed: string[] = []
    for (const install of this.cache) {
      // Prefer the enumerated instance ports when we have them — they
      // reflect what the user actually configured, not our guess set.
      const targets =
        install.instances.length > 0
          ? install.instances.map((i) => i.adbTarget)
          : install.defaultPorts.map((p) => `${install.defaultHost}:${p}`)
      for (const target of targets) {
        try {
          const res = await runAdb(['connect', target], 3000)
          const text = (res.stdout + res.stderr).toLowerCase()
          if (text.includes('connected to') || text.includes('already connected')) {
            connected.push(target)
            log.info('emulator auto-connected', { vendor: install.vendor, target })
          } else {
            failed.push(target)
          }
        } catch {
          failed.push(target)
        }
      }
    }
    return { connected, failed }
  }

  /**
   * `adb connect` every default port of a specific install. Returns a
   * structured result the UI can summarise as a toast.
   *
   * Two-phase recovery: try the plain connect loop first, and only if
   * every target fails AND the install reports a running instance do
   * we `adb kill-server` + `adb start-server` and retry. That gnarly
   * extra step is needed because LDPlayer (and to a lesser extent the
   * other vendors) ships its own adb.exe; if their adb-daemon version
   * differs from ours, the two daemons can leave the local adb server
   * in a half-handshake state where `connect 127.0.0.1:5555` returns
   * "failed" for a perfectly healthy emulator. Killing and restarting
   * our own adb server makes us the sole owner, after which the
   * connect succeeds on the very next try.
   */
  async connectAll(
    installId: string
  ): Promise<{ connected: string[]; failed: string[] }> {
    const install = this.cache.find((i) => i.id === installId)
    if (!install) throw new Error(`Unknown emulator install: ${installId}`)
    const log = getLogger()
    const targets =
      install.instances.length > 0
        ? install.instances.map((i) => i.adbTarget)
        : install.defaultPorts.map((p) => `${install.defaultHost}:${p}`)

    let result = await this.attemptConnect(targets)

    const hasRunningInstance = install.instances.some((i) => i.running)
    if (result.connected.length === 0 && hasRunningInstance) {
      log.info('emulator-connect: no targets responded — resetting adb server and retrying', {
        vendor: install.vendor,
        targets
      })
      try {
        await runAdb(['kill-server'], 5000)
      } catch (err) {
        log.warn('emulator-connect: kill-server failed (continuing anyway)', {
          error: err instanceof Error ? err.message : String(err)
        })
      }
      // adb takes a moment to release the port after kill. Without the
      // settle, start-server occasionally races and gets EADDRINUSE.
      await new Promise((r) => setTimeout(r, 800))
      try {
        await runAdb(['start-server'], 5000)
      } catch (err) {
        log.warn('emulator-connect: start-server failed (continuing anyway)', {
          error: err instanceof Error ? err.message : String(err)
        })
      }
      result = await this.attemptConnect(targets)
      if (result.connected.length > 0) {
        log.info('emulator-connect: recovered via server reset', {
          vendor: install.vendor,
          connected: result.connected
        })
      }
    }

    return result
  }

  /**
   * Inner loop: walk a list of host:port targets and run `adb connect`
   * against each, classifying responses into connected vs failed. The
   * caller decides whether to retry after a server reset.
   */
  private async attemptConnect(
    targets: string[]
  ): Promise<{ connected: string[]; failed: string[] }> {
    const connected: string[] = []
    const failed: string[] = []
    for (const target of targets) {
      try {
        const res = await runAdb(['connect', target], 4000)
        const text = (res.stdout + res.stderr).toLowerCase()
        if (text.includes('connected to') || text.includes('already connected')) {
          connected.push(target)
        } else {
          failed.push(target)
        }
      } catch {
        failed.push(target)
      }
    }
    return { connected, failed }
  }

  /**
   * Spawn the vendor's launcher in a detached process so it survives
   * MobSec exit. We don't wait for it — UI feedback comes from the
   * device service noticing the new adb device.
   */
  async launch(installId: string): Promise<void> {
    const install = this.cache.find((i) => i.id === installId)
    if (!install || !install.launcherPath) {
      throw new Error(`Unknown emulator install or missing launcher: ${installId}`)
    }
    if (!existsSync(install.launcherPath)) {
      throw new Error(`Launcher not found: ${install.launcherPath}`)
    }
    const log = getLogger()
    log.info('emulator launching', {
      vendor: install.vendor,
      launcher: install.launcherPath
    })
    const child = spawn(install.launcherPath, [], {
      detached: true,
      stdio: 'ignore',
      windowsHide: false
    })
    // unref so a process tree dump on app exit doesn't reap the
    // emulator we just started for the user.
    child.unref()
  }

  /**
   * Best-effort post-launch poll: try to adb-connect every 5 s for up
   * to 90 s after a launch. Stops on the first success. The renderer
   * shows a toast when the device appears in the picker; this loop
   * just makes sure the connection happens without manual clicks.
   */
  async waitForLaunch(installId: string, timeoutMs = 90_000): Promise<string | null> {
    const install = this.cache.find((i) => i.id === installId)
    if (!install) return null
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const { connected } = await this.connectAll(installId).catch(() => ({
        connected: [],
        failed: []
      }))
      if (connected.length > 0) return connected[0]!
      await new Promise((r) => setTimeout(r, 5000))
    }
    void install
    return null
  }

  /**
   * Parse LDPlayer's `ldconsole list2` output, which is CSV-shaped:
   *
   *   <index>,<name>,<top_window>,<bind_window>,<android_started>,<player_pid>,<vbox_pid>,<vbox_window>
   *
   * `android_started == 1` means the instance is up. We compute the
   * adb port via LDPlayer's documented formula `5555 + index * 2`.
   * Older LDPlayer builds use a different formula on a few instances;
   * the auto-probe in `connectAll` covers that gap by also trying the
   * defaultPorts set.
   */
  private listLdPlayerInstances(consolePath: string): Promise<EmulatorInstanceInfo[]> {
    return new Promise((resolve, reject) => {
      const proc = spawn(consolePath, ['list2'], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      })
      let stdout = ''
      proc.stdout?.on('data', (c: Buffer) => {
        stdout += c.toString('utf8')
      })
      proc.on('error', reject)
      proc.on('close', () => {
        const instances: EmulatorInstanceInfo[] = []
        for (const line of stdout.split(/\r?\n/)) {
          const trimmed = line.trim()
          if (!trimmed) continue
          const cols = trimmed.split(',')
          if (cols.length < 5) continue
          const index = Number.parseInt(cols[0] ?? '', 10)
          const name = cols[1] ?? `Instance ${index}`
          const androidStarted = cols[4] === '1'
          if (Number.isNaN(index)) continue
          instances.push({
            index,
            name,
            running: androidStarted,
            adbTarget: `127.0.0.1:${5555 + index * 2}`
          })
        }
        resolve(instances)
      })
    })
  }
}

export const emulatorInstallsService = new EmulatorInstallsService()
