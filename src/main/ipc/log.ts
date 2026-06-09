import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc-channels'
import { getLogger } from '../utils/logger'

type Level = 'debug' | 'info' | 'warn' | 'error'
const ALLOWED: Level[] = ['debug', 'info', 'warn', 'error']

export function registerLogIpc(): void {
  ipcMain.on(IPC.log.write, (_e, level: unknown, message: unknown, meta: unknown) => {
    const log = getLogger()
    const lvl: Level = ALLOWED.includes(level as Level) ? (level as Level) : 'info'
    const msg = typeof message === 'string' ? message : JSON.stringify(message)
    if (meta !== undefined) log.log(lvl, `[renderer] ${msg}`, { meta })
    else log.log(lvl, `[renderer] ${msg}`)
  })
}
