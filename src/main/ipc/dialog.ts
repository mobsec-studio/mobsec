import { dialog, ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { DialogOptions } from '@shared/types'
import { safe } from '../utils/result'

function sanitizeOptions(raw: unknown): DialogOptions {
  if (!raw || typeof raw !== 'object') return {}
  const obj = raw as Record<string, unknown>
  const out: DialogOptions = {}
  if (typeof obj.title === 'string') out.title = obj.title
  if (typeof obj.defaultPath === 'string') out.defaultPath = obj.defaultPath
  if (Array.isArray(obj.filters)) {
    out.filters = obj.filters
      .filter((f): f is { name: string; extensions: string[] } =>
        !!f &&
          typeof (f as { name: unknown }).name === 'string' &&
          Array.isArray((f as { extensions: unknown }).extensions)
      )
      .map((f) => ({
        name: f.name,
        extensions: f.extensions.filter((e): e is string => typeof e === 'string')
      }))
  }
  if (Array.isArray(obj.properties)) {
    out.properties = obj.properties.filter(
      (p): p is 'openFile' | 'openDirectory' | 'multiSelections' =>
        p === 'openFile' || p === 'openDirectory' || p === 'multiSelections'
    )
  }
  return out
}

export function registerDialogIpc(getWin: () => BrowserWindow | null): void {
  ipcMain.handle(IPC.dialog.showOpen, (_e, raw: unknown) =>
    safe('dialog.showOpen', async (): Promise<string[]> => {
      const opts = sanitizeOptions(raw)
      const win = getWin()
      const result = win
        ? await dialog.showOpenDialog(win, opts)
        : await dialog.showOpenDialog(opts)
      return result.canceled ? [] : result.filePaths
    })
  )

  ipcMain.handle(IPC.dialog.showSave, (_e, raw: unknown) =>
    safe('dialog.showSave', async (): Promise<string | null> => {
      const opts = sanitizeOptions(raw)
      // `properties` on showSave has a different shape than showOpen, so strip it.
      const { properties: _ignored, ...saveOpts } = opts
      void _ignored
      const win = getWin()
      const result = win
        ? await dialog.showSaveDialog(win, saveOpts)
        : await dialog.showSaveDialog(saveOpts)
      return result.canceled ? null : (result.filePath ?? null)
    })
  )

  ipcMain.handle(IPC.dialog.showMessage, async (_e, message: unknown, detail: unknown) => {
    if (typeof message !== 'string') return
    const win = getWin()
    const opts = {
      type: 'info' as const,
      message,
      detail: typeof detail === 'string' ? detail : undefined,
      buttons: ['OK']
    }
    if (win) await dialog.showMessageBox(win, opts)
    else await dialog.showMessageBox(opts)
  })
}
