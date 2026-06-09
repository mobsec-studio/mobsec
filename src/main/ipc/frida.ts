import { dialog, ipcMain, type BrowserWindow } from 'electron'
import { basename } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { IPC } from '@shared/ipc-channels'
import type { FridaScript } from '@shared/types'
import { deviceService } from '../services/device'
import { fridaService } from '../services/frida'
import { fridaScriptsRepo, fridaPresetsRepo } from '../services/database'
import { getLogger } from '../utils/logger'
import { safe } from '../utils/result'

export function registerFridaIpc(getWin: () => BrowserWindow | null): void {
  ipcMain.handle(IPC.frida.getStatus, () => fridaService.getStatus())
  ipcMain.handle(IPC.frida.listProcesses, () =>
    safe('frida.listProcesses', () => fridaService.listProcesses())
  )

  ipcMain.handle(IPC.frida.attach, (_e, pid: unknown, scriptSource: unknown) =>
    safe('frida.attach', () => {
      if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0) {
        throw new Error('PID must be a positive integer')
      }
      if (typeof scriptSource !== 'string') throw new Error('Script source must be a string')
      return fridaService.attach(pid, scriptSource)
    })
  )

  ipcMain.handle(IPC.frida.spawn, (_e, identifier: unknown, scriptSource: unknown) =>
    safe('frida.spawn', () => {
      if (typeof identifier !== 'string') throw new Error('Identifier must be a string')
      if (typeof scriptSource !== 'string') throw new Error('Script source must be a string')
      return fridaService.spawn(identifier, scriptSource)
    })
  )

  ipcMain.handle(IPC.frida.launchAndAttach, (_e, identifier: unknown, scriptSource: unknown) =>
    safe('frida.launchAndAttach', () => {
      if (typeof identifier !== 'string') throw new Error('Identifier must be a string')
      if (typeof scriptSource !== 'string') throw new Error('Script source must be a string')
      return fridaService.launchAndAttach(identifier, scriptSource)
    })
  )

  // Load the intelligence agent against a target and resolve its App
  // Intelligence Report. Accepts a running pid and/or a package id; the
  // service picks attach vs launch-attach unless `method` forces one.
  ipcMain.handle(IPC.frida.reconnaissance, (_e, raw: unknown) =>
    safe('frida.reconnaissance', () => {
      if (!raw || typeof raw !== 'object') throw new Error('Invalid reconnaissance options')
      const o = raw as Record<string, unknown>
      const pid = typeof o.pid === 'number' && o.pid > 0 ? o.pid : undefined
      const identifier = typeof o.identifier === 'string' && o.identifier ? o.identifier : undefined
      const method =
        o.method === 'attach' || o.method === 'spawn' || o.method === 'launch-attach'
          ? o.method
          : undefined
      if (pid === undefined && identifier === undefined) {
        throw new Error('Reconnaissance needs either a running pid or a package identifier.')
      }
      return fridaService.reconnaissance({ pid, identifier, method })
    })
  )

  ipcMain.handle(IPC.frida.autoPwn, (_e, raw: unknown) =>
    safe('frida.autoPwn', () => {
      if (!raw || typeof raw !== 'object') throw new Error('Invalid Auto-Pwn options')
      const o = raw as Record<string, unknown>
      const pid = typeof o.pid === 'number' && o.pid > 0 ? o.pid : undefined
      const identifier = typeof o.identifier === 'string' && o.identifier ? o.identifier : undefined
      const method =
        o.method === 'attach' || o.method === 'spawn' || o.method === 'launch-attach'
          ? o.method
          : undefined
      if (pid === undefined && identifier === undefined) {
        throw new Error('Auto-Pwn needs either a running pid or a package identifier.')
      }
      return fridaService.autoPwn({ pid, identifier, method })
    })
  )

  ipcMain.handle(IPC.frida.applyStrategies, (_e, sessionId: unknown, ids: unknown) =>
    safe('frida.applyStrategies', () => {
      if (typeof sessionId !== 'string') throw new Error('Session id must be a string')
      if (!Array.isArray(ids) || ids.some((x) => typeof x !== 'string')) {
        throw new Error('Strategy ids must be an array of strings')
      }
      return fridaService.applyStrategies(sessionId, ids as string[])
    })
  )

  ipcMain.handle(IPC.frida.listStrategies, (_e, sessionId: unknown) =>
    safe('frida.listStrategies', () => {
      if (typeof sessionId !== 'string') throw new Error('Session id must be a string')
      return fridaService.listStrategies(sessionId)
    })
  )

  // --- Deep discovery & live tracing ---------------------------------
  const sid = (v: unknown): string => {
    if (typeof v !== 'string') throw new Error('Session id must be a string')
    return v
  }
  const str = (v: unknown, label: string): string => {
    if (typeof v !== 'string') throw new Error(`${label} must be a string`)
    return v
  }
  const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined)

  ipcMain.handle(IPC.frida.listTracers, (_e, s: unknown) =>
    safe('frida.listTracers', () => fridaService.listTracers(sid(s)))
  )
  ipcMain.handle(IPC.frida.startTracer, (_e, s: unknown, id: unknown) =>
    safe('frida.startTracer', () => fridaService.startTracer(sid(s), str(id, 'Tracer id')))
  )
  ipcMain.handle(IPC.frida.stopTracer, (_e, s: unknown, id: unknown) =>
    safe('frida.stopTracer', () => fridaService.stopTracer(sid(s), str(id, 'Tracer id')))
  )
  ipcMain.handle(IPC.frida.enumerateClasses, (_e, s: unknown, filter: unknown, limit: unknown) =>
    safe('frida.enumerateClasses', () =>
      fridaService.enumerateClasses(sid(s), typeof filter === 'string' ? filter : '', num(limit))
    )
  )
  ipcMain.handle(IPC.frida.listMethods, (_e, s: unknown, cls: unknown) =>
    safe('frida.listMethods', () => fridaService.listMethods(sid(s), str(cls, 'Class name')))
  )
  ipcMain.handle(IPC.frida.traceClass, (_e, s: unknown, cls: unknown) =>
    safe('frida.traceClass', () => fridaService.traceClass(sid(s), str(cls, 'Class name')))
  )
  ipcMain.handle(IPC.frida.untraceClass, (_e, s: unknown, cls: unknown) =>
    safe('frida.untraceClass', () => fridaService.untraceClass(sid(s), str(cls, 'Class name')))
  )
  ipcMain.handle(IPC.frida.chooseInstances, (_e, s: unknown, cls: unknown, limit: unknown) =>
    safe('frida.chooseInstances', () =>
      fridaService.chooseInstances(sid(s), str(cls, 'Class name'), num(limit))
    )
  )
  ipcMain.handle(IPC.frida.traceNative, (_e, s: unknown, mod: unknown, sym: unknown) =>
    safe('frida.traceNative', () =>
      fridaService.traceNative(sid(s), typeof mod === 'string' ? mod : '', str(sym, 'Symbol'))
    )
  )
  ipcMain.handle(IPC.frida.untraceNative, (_e, s: unknown, mod: unknown, sym: unknown) =>
    safe('frida.untraceNative', () =>
      fridaService.untraceNative(sid(s), typeof mod === 'string' ? mod : '', str(sym, 'Symbol'))
    )
  )
  ipcMain.handle(IPC.frida.listActiveTraces, (_e, s: unknown) =>
    safe('frida.listActiveTraces', () => fridaService.listActiveTraces(sid(s)))
  )

  // --- Per-app instrumentation presets -------------------------------
  ipcMain.handle(IPC.frida.listPresets, (_e, packageName: unknown) =>
    safe('frida.listPresets', () =>
      fridaPresetsRepo.list(typeof packageName === 'string' ? packageName : undefined)
    )
  )
  ipcMain.handle(IPC.frida.savePreset, (_e, raw: unknown) =>
    safe('frida.savePreset', () => {
      if (!raw || typeof raw !== 'object') throw new Error('Invalid preset payload')
      const o = raw as Record<string, unknown>
      if (typeof o.name !== 'string' || !o.name.trim()) throw new Error('Preset name required')
      const strategyIds = Array.isArray(o.strategyIds)
        ? o.strategyIds.filter((x): x is string => typeof x === 'string')
        : []
      const monitorIds = Array.isArray(o.monitorIds)
        ? o.monitorIds.filter((x): x is string => typeof x === 'string')
        : []
      return fridaPresetsRepo.upsert({
        id: typeof o.id === 'string' ? o.id : undefined,
        packageName: typeof o.packageName === 'string' && o.packageName ? o.packageName : '*',
        name: o.name,
        strategyIds,
        monitorIds
      })
    })
  )
  ipcMain.handle(IPC.frida.deletePreset, (_e, id: unknown) =>
    safe('frida.deletePreset', () => {
      if (typeof id !== 'string') throw new Error('Preset id must be a string')
      fridaPresetsRepo.delete(id)
    })
  )

  ipcMain.handle(IPC.frida.detach, (_e, raw: unknown) =>
    safe('frida.detach', () => {
      if (typeof raw !== 'string') throw new Error('Session id must be a string')
      return fridaService.detach(raw)
    })
  )

  ipcMain.handle(IPC.frida.loadScript, (_e, sessionId: unknown, scriptSource: unknown) =>
    safe('frida.loadScript', () => {
      if (typeof sessionId !== 'string') throw new Error('Session id must be a string')
      if (typeof scriptSource !== 'string') throw new Error('Script source must be a string')
      return fridaService.loadScript(sessionId, scriptSource)
    })
  )

  ipcMain.handle(IPC.frida.listBuiltinScripts, () =>
    safe('frida.listBuiltinScripts', () => fridaService.listBuiltinScripts())
  )

  ipcMain.handle(IPC.frida.installServer, () =>
    safe('frida.installServer', async () => {
      const device = deviceService.getActive()
      if (!device || device.state !== 'online') {
        throw new Error(
          'Pick a connected device first (Settings → Devices, or start the embedded emulator).'
        )
      }
      if (!device.capabilities.canRunFridaServer) {
        throw new Error(
          `Frida server can't be installed on ${device.label} — it requires root. The device is reporting rooted=false. Options: install Magisk and re-probe, or attach Frida Gadget into the target APK manually.`
        )
      }
      await fridaService.installServer(device.serial, device.abi)
    })
  )

  ipcMain.handle(IPC.frida.stopServer, () =>
    safe('frida.stopServer', () => fridaService.stopServer())
  )

  ipcMain.handle(IPC.frida.listUserScripts, () =>
    safe('frida.listUserScripts', () => fridaScriptsRepo.list())
  )

  ipcMain.handle(IPC.frida.saveUserScript, (_e, raw: unknown) =>
    safe('frida.saveUserScript', () => {
      if (!raw || typeof raw !== 'object') throw new Error('Invalid script payload')
      const obj = raw as Record<string, unknown>
      if (typeof obj.name !== 'string' || !obj.name.trim()) throw new Error('Script name required')
      if (typeof obj.source !== 'string') throw new Error('Script source required')
      return fridaScriptsRepo.upsert({
        id: typeof obj.id === 'string' ? obj.id : undefined,
        name: obj.name.trim(),
        description: typeof obj.description === 'string' ? obj.description : '',
        source: obj.source
      })
    })
  )

  ipcMain.handle(IPC.frida.deleteUserScript, (_e, raw: unknown) =>
    safe('frida.deleteUserScript', () => {
      if (typeof raw !== 'string') throw new Error('Script id must be a string')
      fridaScriptsRepo.delete(raw)
    })
  )

  // Import one or more local .js files into the user library. Each
  // file's `// @name` (if present) becomes its title, otherwise the
  // filename does.
  ipcMain.handle(IPC.frida.importScriptFiles, () =>
    safe('frida.importScriptFiles', async (): Promise<FridaScript[]> => {
      const win = getWin()
      const result = win
        ? await dialog.showOpenDialog(win, {
            title: 'Import Frida script(s)',
            filters: [
              { name: 'Frida / JavaScript', extensions: ['js', 'ts'] },
              { name: 'All files', extensions: ['*'] }
            ],
            properties: ['openFile', 'multiSelections']
          })
        : await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] })
      if (result.canceled || result.filePaths.length === 0) return []

      const imported: FridaScript[] = []
      for (const filePath of result.filePaths) {
        const source = await readFile(filePath, 'utf8').catch(() => null)
        if (source == null) continue
        const meta = parseScriptHeader(source, basename(filePath).replace(/\.(js|ts)$/i, ''))
        imported.push(
          fridaScriptsRepo.upsert({
            name: meta.name,
            description: meta.description,
            source
          })
        )
      }
      return imported
    })
  )

  // Pull a script straight from codeshare.frida.re. Accepts either a
  // bare `user/project` handle, an `@user/project` form, or a full URL.
  // The fetched code runs on a device with full app privileges, so the
  // renderer surfaces a clear "remote code" confirmation before this.
  ipcMain.handle(IPC.frida.importCodeshare, (_e, raw: unknown) =>
    safe('frida.importCodeshare', async (): Promise<FridaScript> => {
      if (typeof raw !== 'string' || !raw.trim()) {
        throw new Error('Provide a CodeShare handle like user/project')
      }
      const handle = normalizeCodeshareHandle(raw)
      if (!/^[^/\s]+\/[^/\s]+$/.test(handle)) {
        throw new Error(
          `"${raw}" doesn't look like a CodeShare handle. Expected user/project (e.g. pcipolloni/universal-android-ssl-pinning-bypass-with-frida).`
        )
      }
      const url = `https://codeshare.frida.re/api/project/${handle}/`
      getLogger().info('frida: fetching codeshare', { handle, url })
      const response = await fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': 'MobSec-Studio', Accept: 'application/json' }
      })
      if (!response.ok) {
        throw new Error(
          `CodeShare returned HTTP ${response.status} for ${handle}. Double-check the handle exists.`
        )
      }
      const data = (await response.json()) as {
        source?: string
        project?: { source?: string }
      }
      const source = data.source ?? data.project?.source
      if (!source) {
        throw new Error('CodeShare response had no source field — the handle may be invalid.')
      }
      const fallbackName = `CodeShare · ${handle}`
      const meta = parseScriptHeader(source, fallbackName)
      return fridaScriptsRepo.upsert({
        name: meta.name === fallbackName ? fallbackName : `${meta.name} (CodeShare)`,
        description: meta.description || `Imported from codeshare.frida.re/@${handle}`,
        source
      })
    })
  )

  // Write a stored script's source out to a .js file.
  ipcMain.handle(IPC.frida.exportScript, (_e, raw: unknown) =>
    safe('frida.exportScript', async (): Promise<{ path: string } | null> => {
      if (typeof raw !== 'string') throw new Error('Script id must be a string')
      const script =
        fridaScriptsRepo.list().find((s) => s.id === raw) ??
        (await fridaService.listBuiltinScripts()).find((s) => s.id === raw)
      if (!script) throw new Error('Script not found')
      const win = getWin()
      const safeName = script.name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()
      const opts = {
        title: 'Export Frida script',
        defaultPath: `${safeName}.js`,
        filters: [{ name: 'JavaScript', extensions: ['js'] }]
      }
      const result = win
        ? await dialog.showSaveDialog(win, opts)
        : await dialog.showSaveDialog(opts)
      if (result.canceled || !result.filePath) return null
      await writeFile(result.filePath, script.source, 'utf8')
      return { path: result.filePath }
    })
  )
  ipcMain.handle(IPC.frida.evalCode, (_e, sessionId: unknown, code: unknown) =>
    safe('frida.evalCode', () => {
      if (typeof sessionId !== 'string' || !sessionId)
        throw new Error('sessionId must be a non-empty string')
      if (typeof code !== 'string') throw new Error('code must be a string')
      return fridaService.evalCode(sessionId, code)
    })
  )
}

interface ScriptHeaderMeta {
  name: string
  description: string
}

/** Pull `// @name` / `// @description` from a script, with fallbacks. */
function parseScriptHeader(source: string, fallbackName: string): ScriptHeaderMeta {
  const nameMatch = source.match(/^[ \t]*\/\/\s*@name\s+(.+)$/m)
  const descMatch = source.match(/^[ \t]*\/\/\s*@description\s+(.+)$/m)
  return {
    name: nameMatch?.[1]?.trim() || fallbackName,
    description: descMatch?.[1]?.trim() || ''
  }
}

/**
 * Normalize a CodeShare reference to a `user/project` handle. Accepts:
 *   - `user/project`
 *   - `@user/project`
 *   - `https://codeshare.frida.re/@user/project/`
 */
function normalizeCodeshareHandle(input: string): string {
  const trimmed = input.trim()
  const urlMatch = trimmed.match(/codeshare\.frida\.re\/@?([^/]+)\/([^/?#]+)/)
  if (urlMatch) return `${urlMatch[1]}/${urlMatch[2]}`
  return trimmed.replace(/^@/, '').replace(/\/+$/, '')
}
