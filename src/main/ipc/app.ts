import { app, ipcMain, shell } from 'electron'
import type { BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { AppInfo, CloseConfirmAction } from '@shared/types'
import {
  activeProject,
  capturedRequestsRepo,
  settingsRepo,
  wipeSession
} from '../services/database'
import { safe } from '../utils/result'
import { getLogger } from '../utils/logger'

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

export function registerAppIpc(getWin: () => BrowserWindow | null): void {
  ipcMain.handle(IPC.app.getInfo, (): AppInfo => {
    return {
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      isPackaged: app.isPackaged,
      userData: app.getPath('userData'),
      resourcesPath: app.isPackaged ? process.resourcesPath : app.getAppPath()
    }
  })

  ipcMain.handle(IPC.app.openExternal, (_e, raw: unknown) =>
    safe('app.openExternal', async () => {
      if (typeof raw !== 'string') throw new Error('URL must be a string')
      const url = new URL(raw)
      if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
        throw new Error(`Refusing to open URL with protocol ${url.protocol}`)
      }
      await shell.openExternal(url.toString())
    })
  )

  ipcMain.handle(IPC.app.minimizeWindow, () => getWin()?.minimize())
  ipcMain.handle(IPC.app.maximizeWindow, () => {
    const win = getWin()
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.handle(IPC.app.closeWindow, () => getWin()?.close())
  ipcMain.handle(IPC.app.isMaximized, () => getWin()?.isMaximized() ?? false)
  ipcMain.handle(IPC.app.quit, () => app.quit())

  // Receives the user's choice from the close confirmation dialog. Wiping
  // is best-effort — if the user cancels mid-wipe (e.g. quits forcibly),
  // we don't want to block exit on it.
  ipcMain.handle(IPC.app.confirmClose, (_e, action: unknown, dontAskAgain: unknown) =>
    safe('app.confirmClose', () => {
      const log = getLogger()
      const a = action as CloseConfirmAction
      if (typeof dontAskAgain === 'boolean' && dontAskAgain) {
        settingsRepo.set('closePromptDisabled', 'true')
      }
      try {
        const project = activeProject.ensure()
        if (a === 'discard') {
          wipeSession(project.id)
          log.info('All session data wiped on close', { project: project.id })
        } else if (a === 'discard-proxy') {
          capturedRequestsRepo.clear(project.id)
          log.info('Proxy traffic wiped on close (repeater preserved)', {
            project: project.id
          })
        }
      } catch (err) {
        log.warn('Wipe on close failed', {
          error: err instanceof Error ? err.message : String(err)
        })
      }
      if (a !== 'cancel') {
        // Mark the window as cleared so our close listener actually quits.
        closeState.allowed = true
        getWin()?.close()
      }
      // 'cancel' → no-op; window stays open.
    })
  )
}

/**
 * Mutable state shared with main/index.ts. The window's `close` handler
 * reads `allowed` to decide whether to actually let the close proceed or
 * to first ask the renderer for confirmation.
 */
export const closeState = {
  allowed: false
}
