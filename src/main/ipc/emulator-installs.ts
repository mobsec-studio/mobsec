import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc-channels'
import { emulatorInstallsService } from '../services/emulator-installs'
import { safe } from '../utils/result'

export function registerEmulatorInstallsIpc(): void {
  ipcMain.handle(IPC.emulatorInstalls.list, () =>
    safe('emulatorInstalls.list', () => emulatorInstallsService.list())
  )

  ipcMain.handle(IPC.emulatorInstalls.refresh, () =>
    safe('emulatorInstalls.refresh', () => emulatorInstallsService.detect())
  )

  ipcMain.handle(IPC.emulatorInstalls.launch, (_e, raw: unknown) =>
    safe('emulatorInstalls.launch', () => {
      if (typeof raw !== 'string') throw new Error('Install id must be a string')
      return emulatorInstallsService.launch(raw)
    })
  )

  ipcMain.handle(IPC.emulatorInstalls.connectAll, (_e, raw: unknown) =>
    safe('emulatorInstalls.connectAll', () => {
      if (typeof raw !== 'string') throw new Error('Install id must be a string')
      return emulatorInstallsService.connectAll(raw)
    })
  )
}
