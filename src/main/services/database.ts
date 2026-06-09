import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { getLogger } from '../utils/logger'
import { getPaths } from '../utils/paths'
import type {
  CapturedRequest,
  FridaScript,
  Project,
  ProjectSummary,
  RepeaterTab,
  Setting
} from '@shared/types'
import type { FridaPreset } from '@shared/frida-intel'

let db: Database.Database | null = null

const DEFAULT_REPEATER_SETTINGS_JSON =
  '{"autoContentLength":true,"followRedirects":false,"repeatCount":1}'

const MIGRATIONS: { id: number; up: string }[] = [
  {
    id: 1,
    up: `
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS captured_requests (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        method TEXT NOT NULL,
        scheme TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        path TEXT NOT NULL,
        url TEXT NOT NULL,
        request_headers TEXT NOT NULL,
        request_body BLOB,
        status INTEGER,
        status_text TEXT,
        response_headers TEXT,
        response_body BLOB,
        content_type TEXT,
        duration_ms INTEGER,
        size INTEGER NOT NULL DEFAULT 0,
        from_app TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_captured_requests_project_timestamp
        ON captured_requests(project_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_captured_requests_host
        ON captured_requests(host);
      CREATE TABLE IF NOT EXISTS repeater_tabs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        method TEXT NOT NULL,
        url TEXT NOT NULL,
        headers TEXT NOT NULL,
        body TEXT NOT NULL,
        last_response TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS frida_scripts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `
  },
  {
    id: 2,
    up: `
      ALTER TABLE repeater_tabs ADD COLUMN history TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE repeater_tabs ADD COLUMN settings TEXT NOT NULL DEFAULT '${DEFAULT_REPEATER_SETTINGS_JSON}';
    `
  },
  {
    id: 3,
    up: `
      CREATE TABLE IF NOT EXISTS frida_presets (
        id TEXT PRIMARY KEY,
        package_name TEXT NOT NULL DEFAULT '*',
        name TEXT NOT NULL,
        strategy_ids TEXT NOT NULL DEFAULT '[]',
        monitor_ids TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_frida_presets_package
        ON frida_presets(package_name);
    `
  }
]

export function initDatabase(): Database.Database {
  if (db) return db
  const paths = getPaths()
  const log = getLogger()

  db = new Database(paths.db)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `)

  const applied = new Set(
    db.prepare('SELECT id FROM _migrations').all().map((r) => (r as { id: number }).id)
  )

  const recordMigration = db.prepare('INSERT INTO _migrations (id, applied_at) VALUES (?, ?)')
  const runMigrations = db.transaction(() => {
    for (const m of MIGRATIONS) {
      if (applied.has(m.id)) continue
      log.info(`Applying database migration ${m.id}`)
      db!.exec(m.up)
      recordMigration.run(m.id, new Date().toISOString())
    }
  })
  runMigrations()

  return db
}

export function getDatabase(): Database.Database {
  if (!db) throw new Error('Database not initialized — call initDatabase() during app boot.')
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

interface ProjectRow {
  id: string
  name: string
  created_at: string
  updated_at: string
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export const projectsRepo = {
  list(): Project[] {
    return getDatabase()
      .prepare('SELECT id, name, created_at, updated_at FROM projects ORDER BY updated_at DESC')
      .all()
      .map((r) => rowToProject(r as ProjectRow))
  },

  create(name: string): Project {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Project name cannot be empty')
    const now = new Date().toISOString()
    const id = randomUUID()
    getDatabase()
      .prepare('INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(id, trimmed, now, now)
    return { id, name: trimmed, createdAt: now, updatedAt: now }
  },

  rename(id: string, name: string): Project {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Project name cannot be empty')
    const now = new Date().toISOString()
    const result = getDatabase()
      .prepare('UPDATE projects SET name = ?, updated_at = ? WHERE id = ?')
      .run(trimmed, now, id)
    if (result.changes === 0) throw new Error(`No project with id ${id}`)
    const row = getDatabase()
      .prepare('SELECT id, name, created_at, updated_at FROM projects WHERE id = ?')
      .get(id) as ProjectRow | undefined
    if (!row) throw new Error(`No project with id ${id}`)
    return rowToProject(row)
  },

  delete(id: string): void {
    const result = getDatabase().prepare('DELETE FROM projects WHERE id = ?').run(id)
    if (result.changes === 0) throw new Error(`No project with id ${id}`)
  },

  get(id: string): Project | null {
    const row = getDatabase()
      .prepare('SELECT id, name, created_at, updated_at FROM projects WHERE id = ?')
      .get(id) as ProjectRow | undefined
    return row ? rowToProject(row) : null
  }
}

export const settingsRepo = {
  list(): Setting[] {
    return getDatabase()
      .prepare('SELECT key, value FROM settings')
      .all() as Setting[]
  },

  get(key: string): string | null {
    const row = getDatabase()
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get(key) as { value: string } | undefined
    return row?.value ?? null
  },

  set(key: string, value: string): void {
    getDatabase()
      .prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      )
      .run(key, value)
  }
}

interface CapturedRow {
  id: string
  project_id: string
  timestamp: number
  method: string
  scheme: string
  host: string
  port: number
  path: string
  url: string
  request_headers: string
  request_body: Buffer | null
  status: number | null
  status_text: string | null
  response_headers: string | null
  response_body: Buffer | null
  content_type: string | null
  duration_ms: number | null
  size: number
  from_app: string | null
}

function rowToRequest(row: CapturedRow): CapturedRequest {
  return {
    id: row.id,
    timestamp: row.timestamp,
    method: row.method,
    scheme: row.scheme as 'http' | 'https',
    host: row.host,
    port: row.port,
    path: row.path,
    url: row.url,
    requestHeaders: JSON.parse(row.request_headers) as Record<string, string>,
    requestBody: row.request_body ? row.request_body.toString('utf8') : null,
    status: row.status,
    statusText: row.status_text,
    responseHeaders: row.response_headers
      ? (JSON.parse(row.response_headers) as Record<string, string>)
      : {},
    responseBody: row.response_body ? row.response_body.toString('utf8') : null,
    contentType: row.content_type,
    durationMs: row.duration_ms,
    size: row.size,
    fromApp: row.from_app
  }
}

export const capturedRequestsRepo = {
  /** Insert (or replace) a captured request row. */
  upsert(projectId: string, req: CapturedRequest): void {
    getDatabase()
      .prepare(
        `INSERT INTO captured_requests
          (id, project_id, timestamp, method, scheme, host, port, path, url,
           request_headers, request_body, status, status_text,
           response_headers, response_body, content_type, duration_ms, size, from_app)
         VALUES (@id, @project_id, @timestamp, @method, @scheme, @host, @port, @path, @url,
           @request_headers, @request_body, @status, @status_text,
           @response_headers, @response_body, @content_type, @duration_ms, @size, @from_app)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status,
           status_text = excluded.status_text,
           response_headers = excluded.response_headers,
           response_body = excluded.response_body,
           content_type = excluded.content_type,
           duration_ms = excluded.duration_ms,
           size = excluded.size`
      )
      .run({
        id: req.id,
        project_id: projectId,
        timestamp: req.timestamp,
        method: req.method,
        scheme: req.scheme,
        host: req.host,
        port: req.port,
        path: req.path,
        url: req.url,
        request_headers: JSON.stringify(req.requestHeaders),
        request_body: req.requestBody !== null ? Buffer.from(req.requestBody, 'utf8') : null,
        status: req.status,
        status_text: req.statusText,
        response_headers: req.responseHeaders ? JSON.stringify(req.responseHeaders) : null,
        response_body: req.responseBody !== null ? Buffer.from(req.responseBody, 'utf8') : null,
        content_type: req.contentType,
        duration_ms: req.durationMs,
        size: req.size,
        from_app: req.fromApp ?? null
      })
  },

  list(
    projectId: string,
    opts: { limit?: number; offset?: number; search?: string } = {}
  ): CapturedRequest[] {
    const limit = Math.max(1, Math.min(5000, opts.limit ?? 500))
    const offset = Math.max(0, opts.offset ?? 0)
    const search = opts.search?.trim() ?? ''
    if (search.length === 0) {
      const rows = getDatabase()
        .prepare(
          `SELECT * FROM captured_requests
           WHERE project_id = ?
           ORDER BY timestamp DESC
           LIMIT ? OFFSET ?`
        )
        .all(projectId, limit, offset) as CapturedRow[]
      return rows.map(rowToRequest)
    }
    const like = `%${search.replace(/[\\%_]/g, '\\$&')}%`
    const rows = getDatabase()
      .prepare(
        `SELECT * FROM captured_requests
         WHERE project_id = ?
           AND (host LIKE ? ESCAPE '\\'
             OR path LIKE ? ESCAPE '\\'
             OR url LIKE ? ESCAPE '\\')
         ORDER BY timestamp DESC
         LIMIT ? OFFSET ?`
      )
      .all(projectId, like, like, like, limit, offset) as CapturedRow[]
    return rows.map(rowToRequest)
  },

  get(projectId: string, id: string): CapturedRequest | null {
    const row = getDatabase()
      .prepare('SELECT * FROM captured_requests WHERE project_id = ? AND id = ?')
      .get(projectId, id) as CapturedRow | undefined
    return row ? rowToRequest(row) : null
  },

  clear(projectId: string): void {
    getDatabase().prepare('DELETE FROM captured_requests WHERE project_id = ?').run(projectId)
  },

  countByProject(projectId: string): number {
    const row = getDatabase()
      .prepare('SELECT COUNT(*) as n FROM captured_requests WHERE project_id = ?')
      .get(projectId) as { n: number } | undefined
    return row?.n ?? 0
  }
}

interface RepeaterTabRow {
  id: string
  project_id: string
  name: string
  method: string
  url: string
  headers: string
  body: string
  last_response: string | null
  history: string | null
  settings: string | null
  created_at: string
  updated_at: string
}

function safeJsonParse<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback
  try {
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

function rowToRepeater(row: RepeaterTabRow): RepeaterTab {
  return {
    id: row.id,
    name: row.name,
    method: row.method,
    url: row.url,
    headers: row.headers,
    body: row.body,
    lastResponse: safeJsonParse<RepeaterTab['lastResponse']>(row.last_response, null),
    history: safeJsonParse<RepeaterTab['history']>(row.history, []),
    settings: safeJsonParse<RepeaterTab['settings']>(row.settings, {
      autoContentLength: true,
      followRedirects: false,
      repeatCount: 1
    }),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export const repeaterTabsRepo = {
  list(projectId: string): RepeaterTab[] {
    return getDatabase()
      .prepare(
        `SELECT * FROM repeater_tabs
         WHERE project_id = ?
         ORDER BY updated_at DESC`
      )
      .all(projectId)
      .map((r) => rowToRepeater(r as RepeaterTabRow))
  },

  get(projectId: string, id: string): RepeaterTab | null {
    const row = getDatabase()
      .prepare('SELECT * FROM repeater_tabs WHERE project_id = ? AND id = ?')
      .get(projectId, id) as RepeaterTabRow | undefined
    return row ? rowToRepeater(row) : null
  },

  upsert(projectId: string, tab: RepeaterTab): void {
    getDatabase()
      .prepare(
        `INSERT INTO repeater_tabs
          (id, project_id, name, method, url, headers, body, last_response,
           history, settings, created_at, updated_at)
         VALUES (@id, @project_id, @name, @method, @url, @headers, @body,
           @last_response, @history, @settings, @created_at, @updated_at)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           method = excluded.method,
           url = excluded.url,
           headers = excluded.headers,
           body = excluded.body,
           last_response = excluded.last_response,
           history = excluded.history,
           settings = excluded.settings,
           updated_at = excluded.updated_at`
      )
      .run({
        id: tab.id,
        project_id: projectId,
        name: tab.name,
        method: tab.method,
        url: tab.url,
        headers: tab.headers,
        body: tab.body,
        last_response: tab.lastResponse ? JSON.stringify(tab.lastResponse) : null,
        history: JSON.stringify(tab.history ?? []),
        settings: JSON.stringify(
          tab.settings ?? {
            autoContentLength: true,
            followRedirects: false,
            repeatCount: 1
          }
        ),
        created_at: tab.createdAt,
        updated_at: tab.updatedAt
      })
  },

  delete(projectId: string, id: string): void {
    getDatabase()
      .prepare('DELETE FROM repeater_tabs WHERE project_id = ? AND id = ?')
      .run(projectId, id)
  },

  countByProject(projectId: string): number {
    const row = getDatabase()
      .prepare('SELECT COUNT(*) as n FROM repeater_tabs WHERE project_id = ?')
      .get(projectId) as { n: number } | undefined
    return row?.n ?? 0
  },

  clearByProject(projectId: string): void {
    getDatabase()
      .prepare('DELETE FROM repeater_tabs WHERE project_id = ?')
      .run(projectId)
  }
}

interface FridaScriptRow {
  id: string
  name: string
  description: string
  source: string
  created_at: string
  updated_at: string
}

export const fridaScriptsRepo = {
  list(): FridaScript[] {
    const rows = getDatabase()
      .prepare(
        'SELECT id, name, description, source, created_at, updated_at FROM frida_scripts ORDER BY updated_at DESC'
      )
      .all() as FridaScriptRow[]
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      source: row.source,
      category: 'user' as const
    }))
  },

  upsert(input: {
    id?: string
    name: string
    description: string
    source: string
  }): FridaScript {
    const id = input.id ?? randomUUID()
    const now = new Date().toISOString()
    getDatabase()
      .prepare(
        `INSERT INTO frida_scripts (id, name, description, source, created_at, updated_at)
         VALUES (@id, @name, @description, @source, @created_at, @updated_at)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           description = excluded.description,
           source = excluded.source,
           updated_at = excluded.updated_at`
      )
      .run({
        id,
        name: input.name.trim() || 'Untitled script',
        description: input.description ?? '',
        source: input.source,
        created_at: now,
        updated_at: now
      })
    return {
      id,
      name: input.name.trim() || 'Untitled script',
      description: input.description ?? '',
      source: input.source,
      category: 'user'
    }
  },

  delete(id: string): void {
    getDatabase().prepare('DELETE FROM frida_scripts WHERE id = ?').run(id)
  }
}

interface FridaPresetRow {
  id: string
  package_name: string
  name: string
  strategy_ids: string
  monitor_ids: string
  created_at: string
  updated_at: string
}

function rowToPreset(row: FridaPresetRow): FridaPreset {
  return {
    id: row.id,
    packageName: row.package_name,
    name: row.name,
    strategyIds: safeJsonParse<string[]>(row.strategy_ids, []),
    monitorIds: safeJsonParse<string[]>(row.monitor_ids, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export const fridaPresetsRepo = {
  /** List presets; when `packageName` is given, that app's presets first
   *  then the wildcard (`*`) ones, so per-app recipes surface first. */
  list(packageName?: string): FridaPreset[] {
    const rows = getDatabase()
      .prepare('SELECT * FROM frida_presets ORDER BY updated_at DESC')
      .all() as FridaPresetRow[]
    const presets = rows.map(rowToPreset)
    if (!packageName) return presets
    const rank = (p: FridaPreset): number =>
      p.packageName === packageName ? 0 : p.packageName === '*' ? 1 : 2
    return presets.sort((a, b) => rank(a) - rank(b))
  },

  upsert(input: {
    id?: string
    packageName: string
    name: string
    strategyIds: string[]
    monitorIds: string[]
  }): FridaPreset {
    const id = input.id ?? randomUUID()
    const now = new Date().toISOString()
    getDatabase()
      .prepare(
        `INSERT INTO frida_presets (id, package_name, name, strategy_ids, monitor_ids, created_at, updated_at)
         VALUES (@id, @package_name, @name, @strategy_ids, @monitor_ids, @created_at, @updated_at)
         ON CONFLICT(id) DO UPDATE SET
           package_name = excluded.package_name,
           name = excluded.name,
           strategy_ids = excluded.strategy_ids,
           monitor_ids = excluded.monitor_ids,
           updated_at = excluded.updated_at`
      )
      .run({
        id,
        package_name: input.packageName.trim() || '*',
        name: input.name.trim() || 'Untitled preset',
        strategy_ids: JSON.stringify(input.strategyIds ?? []),
        monitor_ids: JSON.stringify(input.monitorIds ?? []),
        created_at: now,
        updated_at: now
      })
    return {
      id,
      packageName: input.packageName.trim() || '*',
      name: input.name.trim() || 'Untitled preset',
      strategyIds: input.strategyIds ?? [],
      monitorIds: input.monitorIds ?? [],
      createdAt: now,
      updatedAt: now
    }
  },

  delete(id: string): void {
    getDatabase().prepare('DELETE FROM frida_presets WHERE id = ?').run(id)
  }
}

/** Returns counts of all session-scoped artifacts for one project. */
export function getProjectSummary(projectId: string): ProjectSummary | null {
  const project = projectsRepo.get(projectId)
  if (!project) return null
  return {
    project,
    capturedRequests: capturedRequestsRepo.countByProject(projectId),
    repeaterTabs: repeaterTabsRepo.countByProject(projectId)
  }
}

/** Clear session data (captured requests + repeater tabs) for one project.
 *  The project row itself stays — just the working artifacts go. Wrapped in
 *  a transaction so a power-loss or thrown error doesn't leave half-cleared
 *  state behind. */
export function wipeSession(projectId: string): void {
  const db = getDatabase()
  const tx = db.transaction(() => {
    capturedRequestsRepo.clear(projectId)
    repeaterTabsRepo.clearByProject(projectId)
  })
  tx()
}

const ACTIVE_PROJECT_KEY = 'activeProjectId'

export const activeProject = {
  get(): Project | null {
    const id = settingsRepo.get(ACTIVE_PROJECT_KEY)
    if (!id) return null
    return projectsRepo.get(id)
  },

  set(id: string): void {
    const p = projectsRepo.get(id)
    if (!p) throw new Error(`No project with id ${id}`)
    settingsRepo.set(ACTIVE_PROJECT_KEY, id)
  },

  /**
   * Returns the active project, creating a default one if none exists.
   * Called once at app boot so the UI always has something to display.
   */
  ensure(): Project {
    const existing = activeProject.get()
    if (existing) return existing
    const projects = projectsRepo.list()
    if (projects.length > 0) {
      const first = projects[0]!
      settingsRepo.set(ACTIVE_PROJECT_KEY, first.id)
      return first
    }
    const fresh = projectsRepo.create('Untitled Project')
    settingsRepo.set(ACTIVE_PROJECT_KEY, fresh.id)
    return fresh
  }
}
