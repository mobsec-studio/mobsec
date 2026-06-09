import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { RepeaterTab } from '@shared/types'
import { repeaterService } from '../services/repeater'
import { safe } from '../utils/result'

function isRepeaterTab(raw: unknown): raw is RepeaterTab {
  if (!raw || typeof raw !== 'object') return false
  const t = raw as Record<string, unknown>
  return (
    typeof t.id === 'string' &&
    typeof t.name === 'string' &&
    typeof t.method === 'string' &&
    typeof t.url === 'string' &&
    typeof t.headers === 'string' &&
    typeof t.body === 'string'
  )
}

export function registerRepeaterIpc(): void {
  ipcMain.handle(IPC.repeater.listTabs, () =>
    safe('repeater.listTabs', () => repeaterService.listTabs())
  )

  ipcMain.handle(IPC.repeater.createTab, (_e, raw: unknown) =>
    safe('repeater.createTab', () => {
      const fromRequestId = typeof raw === 'string' ? raw : undefined
      return repeaterService.createTab(fromRequestId)
    })
  )

  ipcMain.handle(IPC.repeater.updateTab, (_e, raw: unknown) =>
    safe('repeater.updateTab', () => {
      if (!isRepeaterTab(raw)) throw new Error('Invalid repeater tab payload')
      return repeaterService.updateTab(raw)
    })
  )

  ipcMain.handle(IPC.repeater.deleteTab, (_e, raw: unknown) =>
    safe('repeater.deleteTab', () => {
      if (typeof raw !== 'string') throw new Error('Tab id must be a string')
      return repeaterService.deleteTab(raw)
    })
  )

  ipcMain.handle(IPC.repeater.send, (_e, raw: unknown) =>
    safe('repeater.send', () => {
      if (!isRepeaterTab(raw)) throw new Error('Invalid repeater tab payload')
      return repeaterService.send(raw)
    })
  )

  ipcMain.handle(IPC.repeater.saveBody, (_e, rawPath: unknown, rawContent: unknown) =>
    safe('repeater.saveBody', () => {
      if (typeof rawPath !== 'string') throw new Error('File path must be a string')
      if (typeof rawContent !== 'string') throw new Error('Response content must be a string')
      return repeaterService.saveBody(rawPath, rawContent)
    })
  )
}
