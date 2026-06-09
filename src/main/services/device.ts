import type {
  Device,
  DeviceCapabilities,
  DeviceList,
  DeviceState,
  DeviceTransport,
  RootMethod,
  WirelessConnectProgress,
  WirelessPairResult
} from '@shared/types'
import { getProp, inputKeyEvent, KeyCode, listDevices, runAdb, shell, type AdbKey } from './adb'
import { settingsRepo } from './database'
import { bus } from '../utils/event-bus'
import { getLogger } from '../utils/logger'

/**
 * The single source of truth for "which devices does this app know about?".
 *
 * Everything else in the main process — mirror, proxy, Frida, CA install,
 * logcat — used to read its target serial from `emulatorService.getStatus()`.
 * That conflated three different concepts: "the emulator subprocess we own",
 * "the device adb sees", and "the device the user wants tools to act on".
 *
 * This service untangles them:
 *
 *   - It polls `adb devices` and keeps a Device record per visible serial,
 *     transport (emulator / usb / wifi), state, model, root status, etc.
 *   - It owns the *active* device — the one tool actions implicitly route
 *     to. Persisted to settings so it survives restarts.
 *   - It exposes wireless-connect helpers (tcpip → connect → verify) so the
 *     UI can have a one-click wizard.
 *
 * The emulator subprocess is still managed by `emulatorService`; once it
 * boots it shows up in `adb devices` and naturally appears here as an
 * `emulator` transport. The `prefer the emulator` policy below ensures
 * users who don't actively pick a real device keep their old experience.
 */

const POLL_INTERVAL_MS = 2500
const ACTIVE_DEVICE_SETTING_KEY = 'device.activeSerial'

class DeviceService {
  private devices = new Map<string, Device>()
  private activeSerial: string | null = null
  private pollTimer: NodeJS.Timeout | null = null
  private inflightProbe = new Set<string>()
  /** Serials we've ever probed — used to avoid re-running expensive shell
   *  commands on every poll once metadata is stable. Cleared when a serial
   *  goes offline so a reconnect reprobes from scratch. */
  private probed = new Set<string>()
  /** Serials currently being liveness-checked. Avoids overlapping probes
   *  if a previous one is still pending. */
  private inflightLiveness = new Set<string>()
  /** Wall-clock of the last successful liveness check per serial. Used
   *  to gate the rate of active probes (no point pinging every 2.5 s). */
  private lastLivenessAt = new Map<string, number>()

  start(): void {
    if (this.pollTimer) return
    // Hydrate persisted active selection before the first poll so the very
    // first `device:listChanged` emission already reflects the user's pick.
    const persisted = settingsRepo.get(ACTIVE_DEVICE_SETTING_KEY)
    if (persisted) this.activeSerial = persisted

    void this.refresh()
    this.pollTimer = setInterval(() => {
      void this.refresh()
    }, POLL_INTERVAL_MS)
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  list(): Device[] {
    return [...this.devices.values()].sort((a, b) => {
      // Online before offline; emulator first (familiar default); then
      // alphabetical by label so the UI is stable across polls.
      const score = (d: Device): number => {
        let s = 0
        if (d.state !== 'online') s += 10
        if (d.transport !== 'emulator') s += 1
        return s
      }
      const sa = score(a)
      const sb = score(b)
      if (sa !== sb) return sa - sb
      return a.label.localeCompare(b.label)
    })
  }

  getActiveSerial(): string | null {
    return this.activeSerial
  }

  getActive(): Device | null {
    if (!this.activeSerial) return null
    return this.devices.get(this.activeSerial) ?? null
  }

  getSnapshot(): DeviceList {
    return { devices: this.list(), activeSerial: this.activeSerial }
  }

  async reprobe(serial: string): Promise<Device | null> {
    const current = this.devices.get(serial)
    if (!current || current.state !== 'online') return current ?? null
    this.probed.delete(serial)
    await this.enrich(serial)
    return this.devices.get(serial) ?? null
  }

  setActive(serial: string | null): void {
    if (serial && !this.devices.has(serial)) {
      throw new Error(`Unknown device ${serial}`)
    }
    if (this.activeSerial === serial) return
    this.activeSerial = serial
    if (serial) settingsRepo.set(ACTIVE_DEVICE_SETTING_KEY, serial)
    else settingsRepo.set(ACTIVE_DEVICE_SETTING_KEY, '')
    bus.emit('device:activeChanged', { serial })
    bus.emit('device:listChanged', this.getSnapshot())
  }

  /**
   * Walk `adb devices`, diff against our cache, kick off metadata probes
   * for new arrivals. Cheap enough to call on a 2.5 s interval — `adb
   * devices` is a quick local query against the adb server.
   */
  async refresh(): Promise<DeviceList> {
    const log = getLogger()
    let listed: Awaited<ReturnType<typeof listDevices>>
    try {
      listed = await listDevices()
    } catch (err) {
      log.warn('device: listDevices failed', {
        error: err instanceof Error ? err.message : String(err)
      })
      return this.getSnapshot()
    }

    const seen = new Set<string>()
    let changed = false

    for (const row of listed) {
      const serial = row.serial
      seen.add(serial)
      const existing = this.devices.get(serial)
      const state = mapState(row.state)
      const transport = inferTransport(serial)
      const baseLabel = labelFor(serial, transport)

      if (!existing) {
        this.devices.set(serial, {
          serial,
          transport,
          state,
          label: baseLabel,
          model: null,
          manufacturer: null,
          brand: null,
          product: null,
          androidVersion: null,
          sdkLevel: null,
          abi: null,
          capabilities: defaultCapabilities(),
          lastSeenAt: Date.now()
        })
        changed = true
        log.info('device: discovered', { serial, transport, state })
      } else if (existing.state !== state) {
        this.devices.set(serial, { ...existing, state, lastSeenAt: Date.now() })
        changed = true
        log.info('device: state changed', { serial, from: existing.state, to: state })
        // A device that went offline and came back may have different
        // capabilities (e.g. user enabled root). Force a re-probe.
        if (state === 'online') this.probed.delete(serial)
      } else {
        // Touch lastSeenAt without flagging changed; idle poll.
        existing.lastSeenAt = Date.now()
      }

      // Kick off enrichment for newly-online devices. Doing it after the
      // map insert means the UI gets a row immediately (state=online, no
      // model yet) and the metadata fills in on a follow-up tick.
      if (state === 'online' && !this.probed.has(serial) && !this.inflightProbe.has(serial)) {
        this.inflightProbe.add(serial)
        void this.enrich(serial).finally(() => this.inflightProbe.delete(serial))
      }

      // Active liveness check for WiFi devices. `adb devices` keeps a
      // stale `device` row alive when the TCP connection dies silently
      // (no FIN, just packets lost — phone went out of range, killed
      // WiFi, etc.) until the kernel's TCP keepalive fires, which can
      // be hours by default. Sending a 1 s `shell true` per device
      // every ~5 s drains the dead connection fast and flips the row
      // to `offline` so the UI doesn't lie about reachability.
      if (transport === 'wifi' && state === 'online' && !this.inflightLiveness.has(serial)) {
        const since = Date.now() - (this.lastLivenessAt.get(serial) ?? 0)
        if (since >= 5000) {
          this.inflightLiveness.add(serial)
          void this.probeLiveness(serial).finally(() => this.inflightLiveness.delete(serial))
        }
      }
    }

    // Reap devices adb no longer sees. WiFi devices in particular can flap
    // and we want them gone from the picker until the user reconnects.
    for (const serial of [...this.devices.keys()]) {
      if (!seen.has(serial)) {
        this.devices.delete(serial)
        this.probed.delete(serial)
        this.lastLivenessAt.delete(serial)
        changed = true
        log.info('device: removed', { serial })
        if (this.activeSerial === serial) {
          // Active device unplugged — fall back to whichever device looks
          // most appropriate (first online).
          const next = this.list().find((d) => d.state === 'online')
          this.activeSerial = next?.serial ?? null
          if (this.activeSerial) settingsRepo.set(ACTIVE_DEVICE_SETTING_KEY, this.activeSerial)
          else settingsRepo.set(ACTIVE_DEVICE_SETTING_KEY, '')
          bus.emit('device:activeChanged', { serial: this.activeSerial })
        }
      }
    }

    // If we still don't have an active device but at least one is online,
    // adopt it. This is the "user just booted the emulator, please default
    // to it" path.
    if (!this.activeSerial) {
      const candidate = this.list().find((d) => d.state === 'online')
      if (candidate) {
        this.activeSerial = candidate.serial
        settingsRepo.set(ACTIVE_DEVICE_SETTING_KEY, candidate.serial)
        bus.emit('device:activeChanged', { serial: candidate.serial })
        changed = true
      }
    }

    if (changed) bus.emit('device:listChanged', this.getSnapshot())
    return this.getSnapshot()
  }

  private async enrich(serial: string): Promise<void> {
    const log = getLogger()
    try {
      const [model, manufacturer, brand, product, androidVersion, sdkRaw, abi, buildType] =
        await Promise.all([
          getProp(serial, 'ro.product.model').catch(() => ''),
          getProp(serial, 'ro.product.manufacturer').catch(() => ''),
          getProp(serial, 'ro.product.brand').catch(() => ''),
          getProp(serial, 'ro.product.name').catch(() => ''),
          getProp(serial, 'ro.build.version.release').catch(() => ''),
          getProp(serial, 'ro.build.version.sdk').catch(() => ''),
          getProp(serial, 'ro.product.cpu.abi').catch(() => ''),
          getProp(serial, 'ro.build.type').catch(() => '')
        ])

      const sdkLevel = sdkRaw ? Number.parseInt(sdkRaw, 10) || null : null
      const userdebug = buildType === 'userdebug' || buildType === 'eng'

      const { rooted, rootMethod, magiskInstalled } = await this.probeRoot(serial, userdebug)

      const current = this.devices.get(serial)
      if (!current) return
      const updated: Device = {
        ...current,
        model: model || null,
        manufacturer: manufacturer || null,
        brand: brand || null,
        product: product || null,
        androidVersion: androidVersion || null,
        sdkLevel,
        abi: abi || null,
        label: prettyLabel(current, manufacturer, model),
        capabilities: deriveCapabilities({
          rooted,
          rootMethod,
          magiskInstalled,
          userdebug,
          transport: current.transport
        }),
        lastSeenAt: Date.now()
      }
      this.devices.set(serial, updated)
      this.probed.add(serial)
      bus.emit('device:listChanged', this.getSnapshot())
      log.info('device: enriched', {
        serial,
        model: updated.model,
        sdk: updated.sdkLevel,
        rooted,
        rootMethod
      })
    } catch (err) {
      log.warn('device: enrich failed', {
        serial,
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }

  /**
   * Probe root access without actually invoking `adb root` (that command
   * restarts adbd and would invalidate every long-lived ADB socket — see
   * `adb.ts:root` for the bus event we fire for that case). Three signals:
   *
   *   - `su -c id` returning `uid=0` → either Magisk (preferred) or a
   *     legacy `su` binary.
   *   - `/data/adb/magisk` existing → Magisk infrastructure available.
   *   - `ro.build.type=userdebug|eng` → AOSP debug build that can `adb root`.
   *
   * We don't insist on `su -c id` to call something "rooted" — a userdebug
   * build is functionally rooted for our purposes (frida-server pushes
   * succeed via `adb root`).
   */
  /**
   * Run a 1-second `shell true` on the given WiFi device. On failure
   * (timeout or non-zero exit), mark the row offline, fire `adb
   * disconnect` so adb's server cleans up its stale entry, and emit
   * a list-changed event so the renderer's picker updates.
   *
   * We use `shell true` rather than `get-state` because adb's server
   * caches `get-state` for a moment after the TCP connection dies,
   * whereas a shell command immediately exercises the underlying
   * transport and surfaces the EOF.
   */
  private async probeLiveness(serial: string): Promise<void> {
    const log = getLogger()
    const result = await Promise.race<'alive' | 'dead'>([
      shell(serial, 'true')
        .then((r) => (r.exitCode === 0 ? 'alive' : 'dead'))
        .catch(() => 'dead'),
      new Promise<'dead'>((resolve) => setTimeout(() => resolve('dead'), 2000))
    ])

    if (result === 'alive') {
      this.lastLivenessAt.set(serial, Date.now())
      return
    }

    const current = this.devices.get(serial)
    if (!current || current.state !== 'online') return
    log.info('device: liveness probe failed — marking offline', { serial })
    this.devices.set(serial, { ...current, state: 'offline' })
    bus.emit('device:listChanged', this.getSnapshot())

    // Tell adb to drop the stale row. We don't await — if it hangs
    // (which it can during a network partition), we don't care.
    void runAdb(['disconnect', serial], 5000).catch(() => undefined)

    // If the dead device was active, pick the next online one (or
    // null) so tools stop trying to route through a dead serial.
    if (this.activeSerial === serial) {
      const next = this.list().find((d) => d.state === 'online')
      this.activeSerial = next?.serial ?? null
      settingsRepo.set(ACTIVE_DEVICE_SETTING_KEY, this.activeSerial ?? '')
      bus.emit('device:activeChanged', { serial: this.activeSerial })
      bus.emit('device:listChanged', this.getSnapshot())
    }
  }

  private async probeRoot(
    serial: string,
    userdebug: boolean
  ): Promise<{ rooted: boolean; rootMethod: RootMethod; magiskInstalled: boolean }> {
    const suRes = await shell(serial, 'su -c id 2>/dev/null').catch(() => null)
    const suWorks = !!suRes && /uid=0/.test(suRes.stdout)

    // Magisk: classic install path is /data/adb/magisk, but newer Magisk
    // also leaves `/sbin/.magisk` or `/data/adb/modules/`. Check both.
    const magiskRes = await shell(
      serial,
      '[ -d /data/adb/magisk ] || [ -d /data/adb/modules ] || [ -e /sbin/.magisk ] && echo yes || echo no'
    ).catch(() => null)
    const magiskInstalled = !!magiskRes && /yes/.test(magiskRes.stdout)

    if (suWorks) {
      return {
        rooted: true,
        rootMethod: magiskInstalled ? 'magisk' : 'su',
        magiskInstalled
      }
    }
    if (userdebug) {
      return { rooted: true, rootMethod: 'adb-root', magiskInstalled }
    }
    return { rooted: false, rootMethod: null, magiskInstalled }
  }

  // ---------------- Wireless helpers -----------------

  /** `adb -s <serial> tcpip <port>` — opens the device for TCP/IP adb. */
  async enableTcpip(serial: string, port = 5555): Promise<{ host: string; port: number }> {
    const adbPort = normalizeAdbPort(port)
    const dev = this.devices.get(serial)
    if (!dev) throw new Error(`Unknown device ${serial}`)
    if (dev.transport === 'wifi') {
      throw new Error(`${serial} is already connected over WiFi.`)
    }
    await runAdb(['-s', serial, 'tcpip', String(adbPort)], 10_000)
    const ip = await detectWifiIp(serial)
    if (!ip) {
      throw new Error(
        "Could not read the device's WiFi IP. Make sure the device is on the same WiFi network, then try again."
      )
    }
    return { host: ip, port: adbPort }
  }

  async connect(target: string): Promise<{ serial: string }> {
    const normalised = normalizeAdbTarget(target, 5555)
    const res = await runAdb(['connect', normalised], 15_000)
    if (/cannot connect|failed to connect|unable to connect/i.test(res.stdout + res.stderr)) {
      throw new Error(
        withWirelessPairingHint(
          (res.stderr || res.stdout).trim() || `adb connect ${normalised} failed`,
          normalised
        )
      )
    }
    // adb prints "connected to host:port" on success. Wait until adb
    // actually lists it as online so the renderer sees the row populated.
    await this.refresh()
    const ok = await this.waitForOnline(normalised, 8000)
    if (!ok) {
      throw new Error(
        `Connected to ${normalised} but the device didn't come online — try unlocking the screen and accepting the debugging prompt.`
      )
    }
    return { serial: normalised }
  }

  async disconnect(serial: string): Promise<void> {
    await runAdb(['disconnect', serial], 5000).catch(() => undefined)
    await this.refresh()
  }

  async sendKey(keyName: string): Promise<void> {
    const active = this.getActive()
    if (!active || active.state !== 'online') {
      throw new Error('No active online device.')
    }
    if (!(keyName in KeyCode)) {
      throw new Error(`Unknown key: ${keyName}`)
    }
    const keycode = KeyCode[keyName as AdbKey]
    await inputKeyEvent(active.serial, keycode)
  }

  /**
   * Higher-level wizard. Two modes:
   *
   *   - `fromSerial`: take a connected USB device and promote it to TCP/IP.
   *     Runs `adb tcpip 5555`, reads the device's WiFi IP via
   *     `ip addr show wlan0`, then `adb connect`.
   *   - `hostPort`: skip the tcpip step and just `adb connect host:port` —
   *     for users who already enabled wireless debugging on the device.
   *
   * Progress is streamed on `device:wirelessProgress` so the renderer can
   * show a live status line in its modal.
   */
  async wirelessConnect(opts: {
    fromSerial?: string
    hostPort?: string
    port?: number
  }): Promise<{ serial: string }> {
    const port = normalizeAdbPort(opts.port ?? 5555)
    const emit = (
      phase: WirelessConnectProgress['phase'],
      message: string,
      extra?: Partial<WirelessConnectProgress>
    ): void => {
      bus.emit('device:wirelessProgress', { phase, message, ...extra })
    }

    try {
      let hostPort: string
      if (opts.fromSerial) {
        emit('enabling-tcpip', `Switching ${opts.fromSerial} to TCP/IP on port ${port}…`)
        await runAdb(['-s', opts.fromSerial, 'tcpip', String(port)], 10_000)
        emit('discovering-ip', "Reading the device's WiFi IP address…")
        const ip = await detectWifiIp(opts.fromSerial)
        if (!ip) {
          throw new Error(
            "Couldn't find the device's WiFi IP. Make sure it's on the same network and try again."
          )
        }
        hostPort = `${ip}:${port}`
      } else if (opts.hostPort) {
        hostPort = normalizeAdbTarget(opts.hostPort, port)
      } else {
        throw new Error('wirelessConnect requires either fromSerial or hostPort')
      }

      emit('connecting', `Connecting to ${hostPort}…`, { serial: hostPort })
      const res = await runAdb(['connect', hostPort], 15_000)
      const text = (res.stdout + res.stderr).trim()
      if (/cannot connect|failed to connect|unable to connect/i.test(text)) {
        throw new Error(withWirelessPairingHint(text || `adb connect ${hostPort} failed`, hostPort))
      }

      emit('verifying', `Waiting for ${hostPort} to come online…`, { serial: hostPort })
      await this.refresh()
      const ok = await this.waitForOnline(hostPort, 12_000)
      if (!ok) {
        throw new Error(
          `Connected to ${hostPort} but the device didn't come online. Unlock the screen and accept the prompt, then retry.`
        )
      }
      emit('done', `Connected to ${hostPort}.`, { serial: hostPort })
      return { serial: hostPort }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      emit('error', message, { errorMessage: message })
      throw err
    }
  }

  async pairWireless(opts: {
    pairHostPort: string
    pairingCode: string
    connectHostPort?: string
  }): Promise<WirelessPairResult> {
    const requestedPairTarget = opts.pairHostPort.trim()
    const pairingCode = normalizePairingCode(opts.pairingCode)
    const requestedConnectTarget = opts.connectHostPort?.trim() || null
    const emit = (
      phase: WirelessConnectProgress['phase'],
      message: string,
      extra?: Partial<WirelessConnectProgress>
    ): void => {
      bus.emit('device:wirelessProgress', { phase, message, ...extra })
    }

    try {
      const pairHostPort =
        (await resolveWirelessMdnsTarget(requestedPairTarget, 'pairing')) ??
        normalizeAdbTarget(requestedPairTarget, 0)
      let connectHostPort = requestedConnectTarget
        ? normalizeAdbTarget(requestedConnectTarget, 5555)
        : await resolveWirelessMdnsTarget(requestedPairTarget, 'connect')

      emit('pairing', `Pairing with ${pairHostPort}...`, { serial: pairHostPort })
      const pair = await runAdb(['pair', pairHostPort, pairingCode], 30_000)
      const pairText = (pair.stdout + pair.stderr).trim()
      if (
        pair.exitCode !== 0 ||
        /failed|unable|cannot|error|wrong password|timed out/i.test(pairText)
      ) {
        throw new Error(pairText || `adb pair ${pairHostPort} failed`)
      }

      if (!connectHostPort) {
        connectHostPort = await resolveWirelessMdnsTarget(requestedPairTarget, 'connect')
      }

      if (!connectHostPort) {
        emit(
          'done',
          'Paired. Enter the connection address from the main Wireless Debugging screen to connect.',
          { serial: pairHostPort }
        )
        await this.refresh()
        return { paired: true, serial: null }
      }

      emit('connecting', `Connecting to ${connectHostPort}...`, { serial: connectHostPort })
      const connect = await runAdb(['connect', connectHostPort], 15_000)
      const connectText = (connect.stdout + connect.stderr).trim()
      if (/cannot connect|failed to connect|unable to connect/i.test(connectText)) {
        throw new Error(
          withWirelessPairingHint(
            connectText || `adb connect ${connectHostPort} failed`,
            connectHostPort
          )
        )
      }

      emit('verifying', `Waiting for ${connectHostPort} to come online...`, {
        serial: connectHostPort
      })
      await this.refresh()
      const ok = await this.waitForOnline(connectHostPort, 12_000)
      if (!ok) {
        throw new Error(
          `Paired with ${pairHostPort}, but ${connectHostPort} did not come online. Unlock the screen, keep Wireless Debugging open, and retry Connect.`
        )
      }
      emit('done', `Paired and connected to ${connectHostPort}.`, { serial: connectHostPort })
      return { paired: true, serial: connectHostPort }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      emit('error', message, { errorMessage: message })
      throw err
    }
  }

  private async waitForOnline(serial: string, timeoutMs: number): Promise<boolean> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      await this.refresh()
      const d = this.devices.get(serial)
      if (d && d.state === 'online') return true
      await new Promise((r) => setTimeout(r, 500))
    }
    return false
  }
}

function mapState(state: string): DeviceState {
  if (state === 'device') return 'online'
  if (state === 'unauthorized') return 'unauthorized'
  return 'offline'
}

function inferTransport(serial: string): DeviceTransport {
  if (serial.startsWith('emulator-')) return 'emulator'
  // Any `host:port`-shaped serial is a TCP connection (modern wireless
  // debugging uses high ports like :37000+, classic uses :5555). Catches
  // IPv4 and IPv6 (which is bracketed: `[::1]:5555`).
  if (/:\d+$/.test(serial)) return 'wifi'
  return 'usb'
}

function labelFor(serial: string, transport: DeviceTransport): string {
  if (transport === 'emulator') return `Emulator (${serial})`
  if (transport === 'wifi') return `WiFi · ${serial}`
  return serial
}

function prettyLabel(current: Device, manufacturer: string | null, model: string | null): string {
  const brand = manufacturer?.trim()
  const m = model?.trim()
  if (!brand && !m) return current.label
  const suffix =
    current.transport === 'emulator'
      ? ` (${current.serial})`
      : current.transport === 'wifi'
        ? ` · ${current.serial}`
        : ` · ${current.serial}`
  if (brand && m) return `${capitalize(brand)} ${m}${suffix}`
  return (m || brand || current.label) + suffix
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0]!.toUpperCase() + s.slice(1) : s
}

function defaultCapabilities(): DeviceCapabilities {
  return {
    rooted: false,
    rootMethod: null,
    magiskInstalled: false,
    userdebugBuild: false,
    canRunFridaServer: false,
    canInstallSystemCa: false,
    canInstallMagiskCa: false,
    canInstallUserCa: true,
    canMirror: true,
    canLogcat: true,
    warnings: []
  }
}

function deriveCapabilities(input: {
  rooted: boolean
  rootMethod: RootMethod
  magiskInstalled: boolean
  userdebug: boolean
  transport: DeviceTransport
}): DeviceCapabilities {
  const warnings: string[] = []
  if (!input.rooted) {
    warnings.push(
      'Not rooted: Frida server and system-store CA install are unavailable. The proxy CA still installs to the user store, but only apps with a permissive Network Security Config will trust it.'
    )
  }
  // The Magisk-persistence warning is meaningful only on real devices.
  // On the embedded emulator we control the boot args (-writable-system)
  // and our syncCaInstall coordinator re-applies the CA on every session,
  // so the "won't survive /system remount" caveat doesn't apply — the
  // cert is effectively re-installed automatically whenever the emulator
  // comes online. Showing the warning there confused users with a fix
  // (install Magisk) that doesn't address a problem they have.
  if (input.rooted && !input.magiskInstalled && input.transport !== 'emulator') {
    warnings.push(
      'Rooted without Magisk: the CA install survives until the next /system remount. Install Magisk for a persistent module-based install.'
    )
  }
  return {
    rooted: input.rooted,
    rootMethod: input.rootMethod,
    magiskInstalled: input.magiskInstalled,
    userdebugBuild: input.userdebug,
    canRunFridaServer: input.rooted,
    canInstallSystemCa: input.rooted,
    canInstallMagiskCa: input.rooted && input.magiskInstalled,
    canInstallUserCa: true,
    canMirror: true,
    canLogcat: true,
    warnings
  }
}

async function detectWifiIp(serial: string): Promise<string | null> {
  // Try wlan0 first (the overwhelming default), fall back to any inet on
  // a non-loopback interface so devices on Ethernet docks still work.
  const wlan = await shell(serial, 'ip -f inet addr show wlan0 2>/dev/null').catch(() => null)
  const wlanMatch = wlan?.stdout.match(/inet\s+(\d+\.\d+\.\d+\.\d+)\//)
  if (wlanMatch?.[1]) return wlanMatch[1]

  const route = await shell(serial, 'ip route get 8.8.8.8 2>/dev/null').catch(() => null)
  const routeMatch = route?.stdout.match(/\bsrc\s+(\d+\.\d+\.\d+\.\d+)\b/)
  if (routeMatch?.[1] && routeMatch[1] !== '127.0.0.1') return routeMatch[1]

  const all = await shell(serial, 'ip -f inet -o addr').catch(() => null)
  if (all) {
    for (const line of all.stdout.split('\n')) {
      const m = line.match(/\d+:\s+([^\s]+)\s+inet\s+(\d+\.\d+\.\d+\.\d+)\//)
      if (m && !m[1]?.startsWith('lo') && m[2]) return m[2]
    }
  }

  for (const prop of ['dhcp.wlan0.ipaddress', 'dhcp.eth0.ipaddress', 'wifi.interface']) {
    const value = await getProp(serial, prop).catch(() => '')
    if (/^\d+\.\d+\.\d+\.\d+$/.test(value) && value !== '127.0.0.1') return value
  }
  return null
}

function normalizeAdbTarget(raw: string, defaultPort: number): string {
  const value = raw.trim()
  if (!value || /[\s\r\n\t]/.test(value)) {
    throw new Error('Target must be a host or host:port without spaces.')
  }
  const requiresExplicitPort = defaultPort < 1
  if (/^\[[0-9a-fA-F:]+\](?::\d+)?$/.test(value)) {
    if (value.includes(']:')) return value
    if (requiresExplicitPort) throw new Error('Target must include a port.')
    return `${value}:${defaultPort}`
  }
  if (/^[^:]+:\d+$/.test(value)) return value
  if (/^[A-Za-z0-9.-]+$/.test(value)) {
    if (requiresExplicitPort) throw new Error('Target must include a port.')
    return `${value}:${defaultPort}`
  }
  throw new Error('Target must look like 192.168.1.10:5555, localhost:5555, or [::1]:5555.')
}

function normalizePairingCode(raw: string): string {
  const code = raw.trim()
  if (!/^\S{4,128}$/.test(code)) {
    throw new Error('Pairing code must be 4-128 non-space characters.')
  }
  return code
}

function withWirelessPairingHint(message: string, target: string): string {
  const port = Number(target.match(/:(\d+)$/)?.[1] ?? 0)
  if (port > 1024 && port !== 5555) {
    return `${message}\n\nThis looks like Android 11+ Wireless Debugging. If ${target} is the port from "Pair device with pairing code", use Pair/QR first. After pairing, connect to the separate IP address and port shown on the main Wireless Debugging screen.`
  }
  return message
}

async function resolveWirelessMdnsTarget(
  serviceName: string,
  mode: 'pairing' | 'connect'
): Promise<string | null> {
  const value = serviceName.trim()
  if (!value || /:\d+$/.test(value)) return null
  const type = mode === 'pairing' ? '_adb-tls-pairing._tcp' : '_adb-tls-connect._tcp'
  const res = await runAdb(['mdns', 'services'], 5000).catch(() => null)
  if (!res) return null

  const serviceNeedle = value.replace(/\._adb-tls-(pairing|connect)\._tcp\.?$/i, '')
  const targetPattern = /((?:\d{1,3}\.){3}\d{1,3}|\[[0-9a-fA-F:]+\]|[A-Za-z0-9.-]+):(\d{2,5})\b/
  for (const line of `${res.stdout}\n${res.stderr}`.split('\n')) {
    if (!line.includes(type) || !line.includes(serviceNeedle)) continue
    const target = line.match(targetPattern)?.[0]
    if (target) return target
  }
  return null
}

function normalizeAdbPort(raw: number): number {
  if (!Number.isInteger(raw) || raw < 1 || raw > 65535) {
    throw new Error('ADB port must be between 1 and 65535.')
  }
  return raw
}

export const deviceService = new DeviceService()
