import { ipcMain, shell as electronShell } from 'electron'
import { IPC } from '@shared/ipc-channels'
import { toolchainService } from '../services/toolchain'
import { getPaths } from '../utils/paths'
import { safe } from '../utils/result'

export function registerToolchainIpc(): void {
  ipcMain.handle(IPC.toolchain.list, () => safe('toolchain.list', () => toolchainService.list()))

  ipcMain.handle(IPC.toolchain.install, (_e, raw: unknown) =>
    safe('toolchain.install', () => {
      if (typeof raw !== 'string') throw new Error('Tool id must be a string')
      return toolchainService.install(raw)
    })
  )

  ipcMain.handle(IPC.toolchain.cancel, (_e, raw: unknown) =>
    safe('toolchain.cancel', () => {
      if (typeof raw !== 'string') throw new Error('Tool id must be a string')
      toolchainService.cancel(raw)
    })
  )

  ipcMain.handle(IPC.toolchain.revealInstallDir, () =>
    safe('toolchain.revealInstallDir', async () => {
      await electronShell.openPath(getPaths().tools)
    })
  )
}
