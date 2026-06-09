import { EventEmitter } from 'node:events'
import type { BrowserWindow } from 'electron'
import { IPC_EVENT } from '@shared/ipc-channels'
import type {
  CaInstallResult,
  CapturedRequest,
  DeviceList,
  EmulatorBootProgress,
  EmulatorStatus,
  FridaStatus,
  JadxProgress,
  LogcatLine,
  LogcatStatus,
  MirrorStatus,
  MirrorVideoInit,
  MirrorVideoPacket,
  ProxyStatus,
  SdkSetupProgress,
  ToolInstallProgress,
  WirelessConnectProgress
} from '@shared/types'
import type { FridaEvent } from '@shared/frida-intel'

/**
 * Type-safe pub/sub for cross-service events inside the main process.
 * The `wireToWindow` helper forwards every event onto a BrowserWindow's
 * webContents so the renderer receives a mirror stream.
 */

export interface MainEvents {
  'device:listChanged': DeviceList
  'device:activeChanged': { serial: string | null }
  'device:wirelessProgress': WirelessConnectProgress
  'emulator:status': EmulatorStatus
  'emulator:bootProgress': EmulatorBootProgress
  'proxy:status': ProxyStatus
  'proxy:request': CapturedRequest
  'proxy:response': CapturedRequest
  'proxy:caInstall': CaInstallResult
  'frida:status': FridaStatus
  'frida:console': { sessionId: string; level: string; text: string }
  'frida:scriptError': { sessionId: string; error: string }
  'frida:event': FridaEvent
  'logcat:lines': LogcatLine[]
  'logcat:status': LogcatStatus
  'jadx:progress': JadxProgress
  'toolInstall:progress': ToolInstallProgress
  'sdkSetup:progress': SdkSetupProgress
  'mirror:status': MirrorStatus
  'mirror:videoInit': MirrorVideoInit
  'mirror:videoPacket': MirrorVideoPacket
  'window:maximizedChanged': boolean
  /**
   * Fired whenever `adb root` actually restarted adbd (not just confirmed
   * "already running as root"). Every long-lived ADB socket — scrcpy mirror,
   * logcat tail, etc. — is severed when this happens, so consumers should
   * tear down and reconnect.
   */
  'device:adbRestarted': { serial: string }
}

class TypedEventBus {
  private emitter = new EventEmitter()

  constructor() {
    this.emitter.setMaxListeners(50)
  }

  emit<K extends keyof MainEvents>(event: K, payload: MainEvents[K]): void {
    this.emitter.emit(event, payload)
  }

  on<K extends keyof MainEvents>(event: K, handler: (payload: MainEvents[K]) => void): () => void {
    this.emitter.on(event, handler as (...args: unknown[]) => void)
    return () => this.emitter.off(event, handler as (...args: unknown[]) => void)
  }
}

export const bus = new TypedEventBus()

/** Forward main-process events out to a BrowserWindow's renderer. */
export function wireToWindow(win: BrowserWindow): () => void {
  const send = <T>(channel: string, payload: T) => {
    if (win.isDestroyed()) return
    win.webContents.send(channel, payload)
  }

  const unsubs = [
    bus.on('device:listChanged', (p) => send(IPC_EVENT.device.listChanged, p)),
    bus.on('device:activeChanged', (p) => send(IPC_EVENT.device.activeChanged, p)),
    bus.on('device:wirelessProgress', (p) => send(IPC_EVENT.device.wirelessProgress, p)),
    bus.on('emulator:status', (p) => send(IPC_EVENT.emulator.statusChanged, p)),
    bus.on('emulator:bootProgress', (p) => send(IPC_EVENT.emulator.bootProgress, p)),
    bus.on('proxy:status', (p) => send(IPC_EVENT.proxy.statusChanged, p)),
    bus.on('proxy:request', (p) => send(IPC_EVENT.proxy.request, p)),
    bus.on('proxy:response', (p) => send(IPC_EVENT.proxy.response, p)),
    bus.on('proxy:caInstall', (p) => send(IPC_EVENT.proxy.caInstall, p)),
    bus.on('frida:status', (p) => send(IPC_EVENT.frida.statusChanged, p)),
    bus.on('frida:console', (p) => send(IPC_EVENT.frida.consoleMessage, p)),
    bus.on('frida:scriptError', (p) => send(IPC_EVENT.frida.scriptError, p)),
    bus.on('frida:event', (p) => send(IPC_EVENT.frida.event, p)),
    bus.on('logcat:lines', (p) => send(IPC_EVENT.logcat.lines, p)),
    bus.on('logcat:status', (p) => send(IPC_EVENT.logcat.status, p)),
    bus.on('jadx:progress', (p) => send(IPC_EVENT.jadx.progress, p)),
    bus.on('toolInstall:progress', (p) => send(IPC_EVENT.toolInstall.progress, p)),
    bus.on('sdkSetup:progress', (p) => send(IPC_EVENT.sdkSetup.progress, p)),
    bus.on('mirror:status', (p) => send(IPC_EVENT.mirror.statusChanged, p)),
    bus.on('mirror:videoInit', (p) => send(IPC_EVENT.mirror.videoInit, p)),
    bus.on('mirror:videoPacket', (p) => send(IPC_EVENT.mirror.videoPacket, p)),
    bus.on('window:maximizedChanged', (p) => send(IPC_EVENT.window.maximizedChanged, p))
  ]

  return () => unsubs.forEach((u) => u())
}
