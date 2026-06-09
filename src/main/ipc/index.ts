import type { BrowserWindow } from 'electron'
import { registerAppIpc } from './app'
import { registerApkIpc } from './apk'
import { registerDbIpc } from './db'
import { registerDeviceIpc } from './device'
import { registerDialogIpc } from './dialog'
import { registerEmulatorIpc } from './emulator'
import { registerEmulatorInstallsIpc } from './emulator-installs'
import { registerFridaIpc } from './frida'
import { registerJadxIpc } from './jadx'
import { registerLogIpc } from './log'
import { registerLogcatIpc } from './logcat'
import { registerMirrorIpc } from './mirror'
import { registerOtherToolsIpc } from './other-tools'
import { registerProxyIpc } from './proxy'
import { registerRepeaterIpc } from './repeater'
import { registerSdkIpc } from './sdk'
import { registerToolchainIpc } from './toolchain'

/**
 * Single entry point for IPC registration. Called once at app boot.
 * Pass `getWin` rather than the window itself so we can hot-swap windows
 * later (e.g. detachable emulator panel).
 */
export function registerIpcHandlers(getWin: () => BrowserWindow | null): void {
  registerAppIpc(getWin)
  registerDbIpc()
  registerDeviceIpc()
  registerEmulatorInstallsIpc()
  registerEmulatorIpc()
  registerToolchainIpc()
  registerSdkIpc()
  registerMirrorIpc()
  registerOtherToolsIpc()
  registerProxyIpc()
  registerRepeaterIpc()
  registerFridaIpc(getWin)
  registerApkIpc()
  registerJadxIpc()
  registerLogcatIpc()
  registerDialogIpc(getWin)
  registerLogIpc()
}
