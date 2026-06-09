import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, Menu, Tray, nativeImage, shell } from 'electron'
import { existsSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { join } from 'node:path'
import { registerIpcHandlers } from './ipc'
import { closeState } from './ipc/app'
import { IPC_EVENT } from '@shared/ipc-channels'
import { runAdb } from './services/adb'
import { ensureCaInstalled } from './services/ca-install'
import {
  activeProject,
  closeDatabase,
  getProjectSummary,
  initDatabase,
  settingsRepo
} from './services/database'
import { deviceService } from './services/device'
import { emulatorInstallsService } from './services/emulator-installs'
import { emulatorService } from './services/emulator'
import { fridaService } from './services/frida'
import { mirrorService } from './services/mirror'
import { proxyService } from './services/proxy'
import { registerToolDependent } from './services/toolchain'
import { wireToWindow } from './utils/event-bus'
import { getLogger } from './utils/logger'
import { getPaths } from './utils/paths'
import { bus } from './utils/event-bus'

let mainWindow: BrowserWindow | null = null
let appTray: Tray | null = null

function resolveAppIconPath(): string {
  const candidates = app.isPackaged
    ? [
        join(process.resourcesPath, 'icons', 'icon.png'),
        join(process.resourcesPath, 'build', 'icon.png')
      ]
    : [
        join(app.getAppPath(), 'build', 'icon.png'),
        join(__dirname, '../../build/icon.png')
      ]

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]!
}

function createTray(): void {
  if (appTray) return

  const baseImage = nativeImage.createFromPath(resolveAppIconPath())
  if (baseImage.isEmpty()) {
    getLogger().warn('Tray icon image could not be loaded', { path: resolveAppIconPath() })
    return
  }

  const size = process.platform === 'linux' ? 22 : process.platform === 'darwin' ? 18 : 16
  const trayImage = baseImage.resize({ width: size, height: size })
  appTray = new Tray(trayImage)
  appTray.setToolTip('MobSec Studio')
  appTray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Show MobSec Studio',
        click: () => {
          if (!mainWindow) {
            mainWindow = createWindow()
            wireToWindow(mainWindow)
          }
          mainWindow.show()
          mainWindow.focus()
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => app.quit()
      }
    ])
  )
  appTray.on('click', () => {
    if (!mainWindow) return
    mainWindow.show()
    mainWindow.focus()
  })
}

function createWindow(): BrowserWindow {
  const iconPath = resolveAppIconPath()
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 16, y: 14 },
    backgroundColor: '#06070a',
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false
    }
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })

  win.on('maximize', () => bus.emit('window:maximizedChanged', true))
  win.on('unmaximize', () => bus.emit('window:maximizedChanged', false))

  // Close-intercept: when the user hits the close button (or Cmd-Q on
  // macOS) we ask the renderer to confirm whether to keep or wipe the
  // current session. The renderer responds via the `app:confirmClose` IPC
  // which flips `closeState.allowed` and re-closes the window.
  win.on('close', (event) => {
    if (closeState.allowed) return
    const project = activeProject.ensure()
    const summary = getProjectSummary(project.id) ?? {
      project,
      capturedRequests: 0,
      repeaterTabs: 0
    }
    const promptDisabled = settingsRepo.get('closePromptDisabled') === 'true'
    const nothingToSave = summary.capturedRequests === 0 && summary.repeaterTabs === 0
    // Skip the prompt if the user opted out or the session is empty.
    if (promptDisabled || nothingToSave) return
    event.preventDefault()
    win.webContents.send(IPC_EVENT.window.closeRequested, summary)
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  // Lock down navigation — the renderer is local and should never navigate.
  win.webContents.on('will-navigate', (event, url) => {
    if (is.dev && url.startsWith(process.env['ELECTRON_RENDERER_URL'] ?? '')) return
    event.preventDefault()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('studio.mobsec.app')
  app.setName('MobSec Studio')

  // Ensure userData paths exist and bring up the database before any IPC.
  getPaths()
  initDatabase()

  const log = getLogger()
  log.info('MobSec Studio starting', {
    platform: process.platform,
    arch: process.arch,
    electron: process.versions.electron,
    node: process.versions.node
  })

  app.on('browser-window-created', (_event, win) => {
    optimizer.watchWindowShortcuts(win)
  })

  registerIpcHandlers(() => mainWindow)

  // Tell the toolchain installer how to release locked binaries before
  // wiping their install dirs. Windows holds the .exe of a running process
  // open, so otherwise reinstall fails with EPERM on unlink.
  registerToolDependent('mitmproxy', () => proxyService.stop())
  registerToolDependent('scrcpy', () => mirrorService.stop())

  // The device service polls adb in the background; tools route through
  // its `getActive()` rather than the emulator. Booting the embedded
  // emulator just causes it to show up here as an `emulator`-transport
  // device — no special case needed.
  deviceService.start()

  // Scan the host for third-party emulators (LDPlayer, BlueStacks, Nox,
  // MEmu, Genymotion) and *silently* try `adb connect host:port` for
  // each vendor's default ports. If the user already has LDPlayer or
  // any other emulator running, this catches it within a poll cycle
  // and surfaces it in the device picker with zero clicks. Failures
  // are expected (most ports won't be live) and ignored.
  void (async () => {
    try {
      const installs = await emulatorInstallsService.detect()
      if (installs.length === 0) {
        getLogger().info('No third-party emulators detected')
        return
      }
      getLogger().info('Detected third-party emulators', {
        vendors: installs.map((i) => i.vendor)
      })
      const probe = await emulatorInstallsService.probeAndConnect()
      if (probe.connected.length > 0) {
        getLogger().info('Auto-connected to running emulator(s)', {
          targets: probe.connected
        })
        // Force a device-list refresh so the connect lands in the UI
        // immediately rather than waiting for the next 2.5 s poll.
        void deviceService.refresh().catch(() => undefined)
      }
    } catch (err) {
      getLogger().warn('Emulator-installs detect/probe failed', {
        error: err instanceof Error ? err.message : String(err)
      })
    }
  })()

  // Track the previous active serial so we can tear down stale per-device
  // state (mirror, http_proxy setting) when the user switches devices.
  let lastActiveSerial: string | null = null

  // Auto-start the embedded screen mirror when an active device comes
  // online; tear it down when it goes away or the user picks a different
  // device. Works identically for the emulator, USB devices, and WiFi
  // devices — scrcpy doesn't care about transport.
  const reactToActiveChange = (): void => {
    const active = deviceService.getActive()
    const serial = active && active.state === 'online' ? active.serial : null

    if (serial !== lastActiveSerial) {
      // Device switch — drop the mirror's old socket (its adb forward is
      // bound to the previous serial) and let it reconnect against the
      // new one. Stopping is idempotent if the mirror is already idle.
      void mirrorService.stop()
    }

    if (serial) {
      void mirrorService.start(serial).catch((err) => {
        getLogger().warn('Failed to start embedded mirror', {
          serial,
          error: err instanceof Error ? err.message : String(err)
        })
      })
      // mitmproxy is host-side, so it lives independently of which device
      // is active. We only auto-start when the proxy hasn't yet been
      // brought up (state === 'stopped') — never on 'error', because a
      // port conflict or other fatal would loop on every listChanged
      // tick. The user retries via the Proxy tab's Start button after
      // they fix the underlying problem.
      if (proxyService.getStatus().state === 'stopped') {
        void proxyService.start().catch((err) => {
          getLogger().info('Skipping auto-start of mitmproxy', {
            reason: err instanceof Error ? err.message : String(err)
          })
        })
      }
    } else {
      void mirrorService.stop()
    }
    lastActiveSerial = serial
  }
  bus.on('device:activeChanged', reactToActiveChange)
  bus.on('device:listChanged', reactToActiveChange)

  // Push the HTTP proxy setting onto the active device whenever both it
  // and mitmproxy are live. Three transport-specific routes:
  //
  //   - Emulator → `10.0.2.2:port` (qemu's NAT alias for the host loopback).
  //   - Real device → try `adb reverse tcp:port tcp:port` + `127.0.0.1:port`
  //     first; if reverse fails (old adbd, port collision on the device),
  //     fall back to the host's LAN IP:port so a WiFi device on the same
  //     network reaches mitmproxy directly. USB-only devices that can't
  //     route to the LAN IP get a clear log line so we know to investigate.
  const syncDeviceProxy = async (): Promise<void> => {
    const device = deviceService.getActive()
    const px = proxyService.getStatus()
    if (!device || device.state !== 'online') return
    const log = getLogger()
    try {
      if (px.state === 'running') {
        if (device.transport === 'emulator') {
          await runAdb([
            '-s',
            device.serial,
            'shell',
            'settings',
            'put',
            'global',
            'http_proxy',
            `10.0.2.2:${px.port}`
          ])
          log.info('Device HTTP proxy set (emulator)', {
            serial: device.serial,
            port: px.port
          })
        } else {
          let proxyTarget: string | null = null
          // Try `adb reverse` first — works over USB and WiFi adb, and
          // doesn't depend on the device being able to route to the host's
          // LAN address.
          const reverseRes = await runAdb([
            '-s',
            device.serial,
            'reverse',
            `tcp:${px.port}`,
            `tcp:${px.port}`
          ]).catch((err): { exitCode: number; stderr: string; stdout: string } => ({
            exitCode: -1,
            stderr: err instanceof Error ? err.message : String(err),
            stdout: ''
          }))
          if (reverseRes.exitCode === 0) {
            proxyTarget = `127.0.0.1:${px.port}`
          } else {
            log.warn('adb reverse failed — falling back to host LAN IP', {
              serial: device.serial,
              error: reverseRes.stderr.trim() || reverseRes.stdout.trim()
            })
            const lanIp = getHostLanIp()
            if (lanIp) {
              proxyTarget = `${lanIp}:${px.port}`
              log.info('Using host LAN IP for proxy', {
                serial: device.serial,
                lanIp
              })
            } else {
              log.error(
                'No LAN IP discovered and adb reverse failed. The device cannot reach mitmproxy until adb reverse works or the host gets a routable IP.',
                { serial: device.serial }
              )
              return
            }
          }
          await runAdb([
            '-s',
            device.serial,
            'shell',
            'settings',
            'put',
            'global',
            'http_proxy',
            proxyTarget
          ])
          log.info('Device HTTP proxy set', {
            serial: device.serial,
            transport: device.transport,
            target: proxyTarget
          })
        }
      } else {
        await runAdb([
          '-s',
          device.serial,
          'shell',
          'settings',
          'put',
          'global',
          'http_proxy',
          ':0'
        ])
      }
    } catch (err) {
      log.warn('Failed to sync device proxy setting', {
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }
  bus.on('device:activeChanged', () => void syncDeviceProxy())
  bus.on('device:listChanged', () => void syncDeviceProxy())
  bus.on('proxy:status', () => void syncDeviceProxy())

  // Install the mitmproxy CA into the active device's trust store whenever
  // both it and the proxy are live. The CA installer itself branches on
  // the device's capabilities (rooted system store / Magisk module / user
  // store fallback with warnings).
  let caInstallInflight = false
  const syncCaInstall = async (): Promise<void> => {
    if (caInstallInflight) return
    const device = deviceService.getActive()
    const px = proxyService.getStatus()
    if (!device || device.state !== 'online') return
    if (px.state !== 'running') return

    caInstallInflight = true
    const log = getLogger()
    try {
      // Retry every 1.5s for up to ~12s while mitmproxy is generating its
      // CA. Once the file appears, ensureCaInstalled returns 'installed'.
      let result = await ensureCaInstalled(device.serial)
      for (let attempt = 0; attempt < 8 && result.state === 'skipped'; attempt++) {
        await new Promise((r) => setTimeout(r, 1500))
        result = await ensureCaInstalled(device.serial)
      }
      bus.emit('proxy:caInstall', result)
      if (result.state === 'installed') {
        log.info('CA install complete', { message: result.message })
      } else if (result.state === 'error') {
        log.warn('CA install failed', { message: result.message })
      } else {
        log.debug('CA install', { state: result.state, message: result.message })
      }
    } finally {
      caInstallInflight = false
    }
  }
  bus.on('device:activeChanged', () => void syncCaInstall())
  bus.on('device:listChanged', () => void syncCaInstall())
  bus.on('proxy:status', () => void syncCaInstall())

  // `adb root` restarts adbd as root, which severs every long-lived ADB
  // socket. That includes the scrcpy mirror's video + control streams,
  // so without this hook the device freezes the moment Frida (or CA
  // install) elevates — and the next touch errors with "ended by the
  // other party". Reconnect the mirror as soon as adbd comes back.
  bus.on('device:adbRestarted', ({ serial }) => {
    const active = deviceService.getActive()
    if (!active || active.serial !== serial || active.state !== 'online') return
    getLogger().info('Restarting mirror after adb root', { serial })
    void mirrorService.restart(serial).catch((err) => {
      getLogger().warn('Failed to restart mirror after adb root', {
        error: err instanceof Error ? err.message : String(err)
      })
    })
  })

  mainWindow = createWindow()
  wireToWindow(mainWindow)
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
      wireToWindow(mainWindow)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

/**
 * Best-effort LAN IP discovery for the host. Used as a fallback proxy
 * target when `adb reverse` fails on a real device — that device is
 * presumably on the same network as the host, so it can reach
 * `<host LAN IP>:<port>` directly. Walks the OS's interface list and
 * returns the first non-internal IPv4. Returns null if the host has no
 * routable IPv4 (e.g. WiFi off, only IPv6).
 */
function getHostLanIp(): string | null {
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal && iface.address) {
        return iface.address
      }
    }
  }
  return null
}

// Tear down every subprocess we spawned before letting Electron exit.
// The previous implementation fire-and-forgot the .stop() calls and never
// touched the emulator at all — Electron exited within a few ms and the
// child processes (emulator/qemu, mitmproxy, scrcpy, frida-server's adb
// shell host child) survived as orphans the user had to kill from Task
// Manager. We now preventDefault on the first quit, run cleanup in the
// background, then force-exit when every owner reports done.
let shuttingDown = false
app.on('before-quit', (event) => {
  if (shuttingDown) return
  shuttingDown = true
  event.preventDefault()

  const log = getLogger()
  log.info('MobSec Studio shutting down — tearing down subprocesses')

  // 6s ceiling. Without it a stuck child (e.g. mitmproxy ignoring SIGTERM
  // on Windows) would block the user from ever closing the app.
  const deadline = setTimeout(() => {
    log.warn('Shutdown deadline reached — force-exiting with possible orphans')
    app.exit(1)
  }, 6000)

  // Stop the adb poll so we don't keep racing against the cleanup.
  deviceService.stop()

  void (async () => {
    // Run in parallel — they don't depend on each other and we want the
    // user's window gone fast. `allSettled` so one stubborn child doesn't
    // mask the rest. `emulatorService.forceStop()` skips the graceful
    // `reboot -p` because the user's already committed to closing the
    // app; we just want the qemu tree dead.
    const results = await Promise.allSettled([
      mirrorService.stop(),
      proxyService.stop(),
      fridaService.stopServer(),
      emulatorService.forceStop()
    ])
    for (const r of results) {
      if (r.status === 'rejected') {
        log.warn('Subprocess cleanup failed', {
          error: r.reason instanceof Error ? r.reason.message : String(r.reason)
        })
      }
    }
    closeDatabase()
    clearTimeout(deadline)
    log.info('Shutdown complete')
    app.exit(0)
  })()
})
