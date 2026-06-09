import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc-channels'
import { emulatorService } from '../services/emulator'
import { safe } from '../utils/result'

export function registerEmulatorIpc(): void {
  ipcMain.handle(IPC.emulator.getStatus, () => emulatorService.getStatus())
  ipcMain.handle(IPC.emulator.start, () => safe('emulator.start', () => emulatorService.start()))
  ipcMain.handle(IPC.emulator.stop, () => safe('emulator.stop', () => emulatorService.stop()))
  ipcMain.handle(IPC.emulator.restart, () =>
    safe('emulator.restart', () => emulatorService.restart())
  )

  ipcMain.handle(IPC.emulator.sendKey, (_e, raw: unknown) =>
    safe('emulator.sendKey', () => {
      if (typeof raw !== 'string') throw new Error('Key must be a string')
      return emulatorService.sendKey(raw)
    })
  )

  ipcMain.handle(IPC.emulator.installApk, (_e, raw: unknown) =>
    safe('emulator.installApk', () => {
      if (typeof raw !== 'string') throw new Error('File path must be a string')
      return emulatorService.installApk(raw)
    })
  )

  ipcMain.handle(IPC.emulator.listInstalledApps, () =>
    safe('emulator.listInstalledApps', () => emulatorService.listInstalledApps())
  )

  ipcMain.handle(IPC.emulator.launchApp, (_e, raw: unknown) =>
    safe('emulator.launchApp', () => {
      if (typeof raw !== 'string') throw new Error('Package name must be a string')
      return emulatorService.launchApp(raw)
    })
  )

  ipcMain.handle(IPC.emulator.listAvds, () =>
    safe('emulator.listAvds', () => emulatorService.listAvds())
  )

  ipcMain.handle(IPC.emulator.selectAvd, (_e, raw: unknown) =>
    safe('emulator.selectAvd', () => {
      if (typeof raw !== 'string') throw new Error('AVD name must be a string')
      emulatorService.selectAvd(raw)
    })
  )

  ipcMain.handle(IPC.emulator.getSelectedAvd, () =>
    safe('emulator.getSelectedAvd', () => emulatorService.getSelectedAvd())
  )

  ipcMain.handle(IPC.emulator.detectSdk, () =>
    safe('emulator.detectSdk', () => emulatorService.detectSdk())
  )
}
