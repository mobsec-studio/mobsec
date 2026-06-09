import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Centralized filesystem layout. All paths are resolved relative to Electron's
 * userData dir (which is per-user, persistent, and cross-platform safe).
 *
 * Layout under userData:
 *   logs/                  Winston log output
 *   data/mobsec.db         SQLite database
 *   tools/                 Downloaded external tools (adb, scrcpy, mitmproxy, jadx, ...)
 *   avd/                   Android Virtual Device + snapshots
 *   captures/              HAR exports, captured request bodies, screenshots
 *   scripts/               User-saved Frida scripts
 *   tmp/                   Scratch dir for APK extraction, etc.
 */

export interface AppPaths {
  userData: string
  logs: string
  data: string
  db: string
  tools: string
  avd: string
  captures: string
  scripts: string
  tmp: string
  bundledResources: string
}

let cached: AppPaths | null = null

export function getPaths(): AppPaths {
  if (cached) return cached

  const userData = app.getPath('userData')
  const logs = join(userData, 'logs')
  const data = join(userData, 'data')
  const db = join(data, 'mobsec.db')
  const tools = join(userData, 'tools')
  const avd = join(userData, 'avd')
  const captures = join(userData, 'captures')
  const scripts = join(userData, 'scripts')
  const tmp = join(userData, 'tmp')

  // `process.resourcesPath` only exists in packaged builds; fall back to the
  // repo's resources/ during development.
  const bundledResources = app.isPackaged
    ? join(process.resourcesPath, 'tools-cache')
    : join(app.getAppPath(), 'resources')

  for (const dir of [logs, data, tools, avd, captures, scripts, tmp]) {
    mkdirSync(dir, { recursive: true })
  }

  cached = {
    userData,
    logs,
    data,
    db,
    tools,
    avd,
    captures,
    scripts,
    tmp,
    bundledResources
  }
  return cached
}
