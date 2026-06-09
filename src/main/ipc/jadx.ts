import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { JadxDecompileOptions } from '@shared/types'
import { jadxService } from '../services/jadx'
import { safe } from '../utils/result'

export function registerJadxIpc(): void {
  ipcMain.handle(IPC.jadx.status, () => safe('jadx.status', () => jadxService.status()))

  ipcMain.handle(IPC.jadx.decompile, (_e, raw: unknown) =>
    safe('jadx.decompile', () => jadxService.decompile(parseOptions(raw)))
  )

  ipcMain.handle(IPC.jadx.listTree, (_e, raw: unknown) =>
    safe('jadx.listTree', () => jadxService.listTree(readString(raw, 'Project id')))
  )

  ipcMain.handle(IPC.jadx.readFile, (_e, rawProject: unknown, rawPath: unknown) =>
    safe('jadx.readFile', () =>
      jadxService.readFile(readString(rawProject, 'Project id'), readString(rawPath, 'File path'))
    )
  )

  ipcMain.handle(IPC.jadx.search, (_e, rawProject: unknown, rawQuery: unknown, rawLimit: unknown) =>
    safe('jadx.search', () =>
      jadxService.search(
        readString(rawProject, 'Project id'),
        readString(rawQuery, 'Search query'),
        typeof rawLimit === 'number' ? rawLimit : undefined
      )
    )
  )

  ipcMain.handle(IPC.jadx.revealOutput, (_e, raw: unknown) =>
    safe('jadx.revealOutput', () => jadxService.revealOutput(readString(raw, 'Project id')))
  )

  ipcMain.handle(IPC.jadx.deleteProject, (_e, raw: unknown) =>
    safe('jadx.deleteProject', () => {
      jadxService.deleteProject(readString(raw, 'Project id'))
    })
  )
}

function parseOptions(raw: unknown): JadxDecompileOptions {
  if (!raw || typeof raw !== 'object') throw new Error('JADX options must be an object')
  const value = raw as Partial<JadxDecompileOptions>
  if (typeof value.inputPath !== 'string') throw new Error('Input path must be a string')
  const mode =
    value.mode === 'restructure' || value.mode === 'simple' || value.mode === 'fallback'
      ? value.mode
      : 'auto'
  return {
    inputPath: value.inputPath,
    clean: value.clean !== false,
    deobfuscate: value.deobfuscate !== false,
    showBadCode: value.showBadCode !== false,
    noResources: value.noResources === true,
    exportGradle: value.exportGradle === true,
    mode,
    threads: typeof value.threads === 'number' ? value.threads : 4
  }
}

function readString(raw: unknown, label: string): string {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`)
  }
  return raw
}
