import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { LogcatBuffer, LogcatOptions, LogLevel } from '@shared/types'
import { logcatService } from '../services/logcat'
import { safe } from '../utils/result'

const VALID_BUFFERS: LogcatBuffer[] = ['main', 'system', 'crash', 'events', 'radio', 'kernel']
const VALID_LEVELS = ['V', 'D', 'I', 'W', 'E', 'F']

function parseOptions(raw: unknown): Partial<LogcatOptions> {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as Record<string, unknown>
  const opts: Partial<LogcatOptions> = {}
  if (Array.isArray(o.buffers)) {
    const buffers = [...new Set(o.buffers)].filter(
      (b): b is LogcatBuffer => typeof b === 'string' && VALID_BUFFERS.includes(b as LogcatBuffer)
    )
    if (buffers.length > 0) opts.buffers = buffers
  }
  if (typeof o.minLevel === 'string' && VALID_LEVELS.includes(o.minLevel)) {
    opts.minLevel = o.minLevel as LogLevel
  }
  if (typeof o.pid === 'number' && o.pid > 0) opts.pid = o.pid
  else if (o.pid === null) opts.pid = null
  if (typeof o.tail === 'number' && Number.isFinite(o.tail))
    opts.tail = Math.max(0, Math.floor(o.tail))
  return opts
}

export function registerLogcatIpc(): void {
  ipcMain.handle(IPC.logcat.start, (_e, raw: unknown) =>
    safe('logcat.start', () => logcatService.start(parseOptions(raw)))
  )
  ipcMain.handle(IPC.logcat.stop, () => safe('logcat.stop', () => logcatService.stop()))
  ipcMain.handle(IPC.logcat.clear, () => safe('logcat.clear', () => logcatService.clear()))
  ipcMain.handle(IPC.logcat.getStatus, () =>
    safe('logcat.getStatus', () => logcatService.getStatus())
  )
  ipcMain.handle(IPC.logcat.resolvePid, (_e, pkg: unknown) =>
    safe('logcat.resolvePid', () => logcatService.resolvePid(typeof pkg === 'string' ? pkg : ''))
  )
}
