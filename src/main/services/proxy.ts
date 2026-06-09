import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { createConnection } from 'node:net'
import { delimiter, join } from 'node:path'
import { platform } from 'node:os'
import type { CapturedRequest, ProxyStatus } from '@shared/types'
import { app } from 'electron'
import { activeProject, capturedRequestsRepo } from './database'
import { bus } from '../utils/event-bus'
import { getLogger } from '../utils/logger'
import { getPaths } from '../utils/paths'

/**
 * Local interception proxy backed by mitmproxy. The flow:
 *
 *   1. Spawn `mitmdump --listen-host 127.0.0.1 --listen-port 8080 -s flow.py`.
 *   2. Our Python addon emits one JSON line per request/response to stdout.
 *   3. We parse those lines, upsert into the SQLite `captured_requests`
 *      table, and forward `proxy:request` / `proxy:response` events on the
 *      event bus → the renderer sees them in real time.
 *   4. The first time we ever start, we keep the process alive long enough
 *      for mitmproxy to mint its CA at `<userData>/mitmproxy/mitmproxy-ca-cert.pem`.
 *
 * HTTPS interception requires the CA to be installed in the emulator's
 * system trust store — that lands in a follow-up step. For now HTTP traffic
 * is captured fully, HTTPS surfaces as CONNECT tunnels (no body decryption).
 */

const PORT = 8080
// mitmproxy listens on every interface (default). That way `adb reverse` AND
// "manually set the WiFi proxy to the host's LAN IP" both work without
// reconfiguration. The only "new" surface is "another host on the same WiFi
// can route through this proxy" — fine for a pentest tool the user runs on
// their own dev machine.
const PROBE_HOST = '127.0.0.1'

interface RawRequestEvent {
  event: 'request'
  id: string
  timestamp: number
  method: string
  scheme: 'http' | 'https'
  host: string
  port: number
  path: string
  url: string
  headers: [string, string][]
  httpVersion: string
  body: string | null
  bodySize: number
  bodyTruncated: boolean
}

interface RawResponseEvent {
  event: 'response'
  id: string
  status: number
  statusText: string
  headers: [string, string][]
  httpVersion: string
  contentType: string | null
  durationMs: number | null
  body: string | null
  bodySize: number
  bodyTruncated: boolean
}

interface RawErrorEvent {
  event: 'error'
  id: string
  message: string
}

type RawEvent = RawRequestEvent | RawResponseEvent | RawErrorEvent

class ProxyService {
  private status: ProxyStatus = { state: 'stopped', port: PORT }
  private process: ChildProcess | null = null
  /** Per-flow request scaffolding while we wait for its response. */
  private inflight = new Map<string, CapturedRequest>()

  getStatus(): ProxyStatus {
    return { ...this.status }
  }

  async start(): Promise<void> {
    // `error` is treated like `stopped` here — the user explicitly clicking
    // Start (or this method being invoked manually after the auto-start
    // backoff) should clear the previous error and try again. We do NOT
    // auto-retry on error from the bus side; `index.ts:reactToActiveChange`
    // gates on `state === 'stopped'` to avoid hot-looping on a port conflict.
    if (this.status.state === 'running' || this.status.state === 'starting') return
    this.setStatus({ state: 'starting', port: PORT })
    const log = getLogger()
    try {
      const bin = locateMitmdump()
      if (!bin) {
        throw new Error(
          'mitmproxy is not installed. Open Settings → External tools and click Install next to "mitmproxy".'
        )
      }
      const script = locateFlowAddon()
      if (!script) {
        throw new Error('mitmproxy addon not found in app resources. Reinstall MobSec Studio.')
      }

      const mitmDir = join(getPaths().userData, 'mitmproxy')

      // Default listen-host (all interfaces) is what we want — that lets
      // both `adb reverse` (loopback) and direct WiFi-IP usage work
      // without restarting. Explicit listen-port keeps us deterministic.
      const args = [
        '--listen-port',
        String(PORT),
        '--set',
        `confdir=${mitmDir}`,
        '--quiet', // silences the per-flow stdout summary from mitmdump itself
        '-s',
        script
      ]
      log.info('Spawning mitmdump', { bin, port: PORT })
      const proc = spawn(bin, args, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          // Force unbuffered Python stdout so flows surface immediately.
          PYTHONUNBUFFERED: '1',
          PATH: process.env['PATH'] ?? ''
        }
      })
      this.process = proc

      // Parse NDJSON lines from stdout.
      let buf = ''
      proc.stdout?.on('data', (chunk: Buffer) => {
        buf += chunk.toString('utf8')
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          this.handleLine(line)
        }
      })

      // Capture stderr into a bounded buffer so a fast-failing mitmdump
      // (port already in use, missing CA dir, bad addon) can include its
      // real diagnostic in the user-visible error message. Without this
      // the renderer just sees "exited with code 1" — useless.
      const stderrBuffer: string[] = []
      proc.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8')
        stderrBuffer.push(text)
        const joined = stderrBuffer.join('')
        if (joined.length > 4096) stderrBuffer.splice(0, stderrBuffer.length, joined.slice(-4096))
        const trimmed = text.trim()
        if (trimmed) log.info(`[mitmdump] ${trimmed}`)
      })
      proc.on('error', (err) => {
        log.error('mitmdump spawn error', { error: err.message })
        this.setStatus({ state: 'error', port: PORT, errorMessage: err.message })
      })
      proc.on('exit', (code, signal) => {
        log.info('mitmdump exited', { code, signal })
        this.process = null
        if (this.status.state !== 'stopping') {
          const captured = stderrBuffer.join('').trim()
          // Trim to last ~500 chars so we surface the meaningful tail.
          const tail = captured.length > 500 ? captured.slice(-500) : captured
          this.setStatus({
            state: code === 0 ? 'stopped' : 'error',
            port: PORT,
            errorMessage:
              code === 0
                ? undefined
                : `mitmdump exited (code ${code}, signal ${signal ?? 'none'})${
                    tail ? `:\n${tail}` : ''
                  }`
          })
        }
      })

      // Probe the listen port instead of waiting a fixed duration. mitmdump
      // typically binds in ~200 ms but can take longer on first-ever run
      // (CA generation). The probe gives us a real readiness signal AND
      // surfaces the most common failure ("port already in use") fast —
      // when the process exits inside the probe window, the exit handler
      // above has already set state to 'error' with the captured stderr.
      const ready = await waitForPort(PROBE_HOST, PORT, 6000)
      if (!ready) {
        if (!this.process) {
          // exit handler already set 'error' with stderr
          throw new Error(this.status.errorMessage ?? 'mitmdump exited before binding')
        }
        // Process is alive but port isn't open — kill it ourselves.
        const captured = stderrBuffer.join('').trim()
        const tail = captured.length > 500 ? captured.slice(-500) : captured
        try {
          if (process.platform === 'win32' && this.process.pid) {
            spawn('taskkill', ['/PID', String(this.process.pid), '/T', '/F'], {
              windowsHide: true
            })
          } else {
            this.process.kill('SIGTERM')
          }
        } catch {
          // ignore
        }
        throw new Error(
          `mitmdump never bound to ${PROBE_HOST}:${PORT} within 6 s${
            tail ? `:\n${tail}` : ' (no stderr output)'
          }`
        )
      }

      this.setStatus({ state: 'running', port: PORT })
      log.info('mitmdump listening', { url: `http://${PROBE_HOST}:${PORT}` })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      getLogger().error('Proxy failed to start', { error: message })
      this.setStatus({ state: 'error', port: PORT, errorMessage: message })
      throw err
    }
  }

  async stop(): Promise<void> {
    if (this.status.state === 'stopped' || this.status.state === 'stopping') return
    this.setStatus({ state: 'stopping', port: PORT })
    if (this.process) {
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/PID', String(this.process.pid), '/T', '/F'], {
            windowsHide: true
          })
        } else {
          this.process.kill('SIGTERM')
        }
      } catch (err) {
        getLogger().warn('Failed to stop mitmdump', {
          error: err instanceof Error ? err.message : String(err)
        })
      }
    }
    this.process = null
    this.inflight.clear()
    this.setStatus({ state: 'stopped', port: PORT })
  }

  async listRequests(opts: {
    limit?: number
    offset?: number
    search?: string
  } = {}): Promise<CapturedRequest[]> {
    const project = activeProject.ensure()
    return capturedRequestsRepo.list(project.id, opts)
  }

  async getRequest(id: string): Promise<CapturedRequest | null> {
    const project = activeProject.ensure()
    return capturedRequestsRepo.get(project.id, id)
  }

  async clearRequests(): Promise<void> {
    const project = activeProject.ensure()
    capturedRequestsRepo.clear(project.id)
  }

  async exportHar(filePath: string): Promise<void> {
    const project = activeProject.ensure()
    const requests = capturedRequestsRepo.list(project.id, { limit: 5000 })
    const har = {
      log: {
        version: '1.2',
        creator: { name: 'MobSec Studio', version: app.getVersion() },
        entries: requests.map(toHarEntry)
      }
    }
    await writeFile(filePath, JSON.stringify(har, null, 2), 'utf8')
  }

  /** Path to mitmproxy's auto-generated CA cert (used by Phase 3 follow-up). */
  caCertPath(): string {
    return join(getPaths().userData, 'mitmproxy', 'mitmproxy-ca-cert.pem')
  }

  private handleLine(line: string): void {
    let raw: RawEvent
    try {
      raw = JSON.parse(line) as RawEvent
    } catch (err) {
      getLogger().warn('Failed to parse mitmdump line', {
        line,
        error: err instanceof Error ? err.message : String(err)
      })
      return
    }

    const project = activeProject.ensure()
    if (raw.event === 'request') {
      const req: CapturedRequest = {
        id: raw.id,
        timestamp: Math.round(raw.timestamp * 1000),
        method: raw.method,
        scheme: raw.scheme,
        host: raw.host,
        port: raw.port,
        path: raw.path,
        url: raw.url,
        requestHeaders: headersFromPairs(raw.headers),
        requestBody: decodeBody(raw.body),
        status: null,
        statusText: null,
        responseHeaders: {},
        responseBody: null,
        contentType: null,
        durationMs: null,
        size: raw.bodySize,
        fromApp: null
      }
      this.inflight.set(raw.id, req)
      capturedRequestsRepo.upsert(project.id, req)
      bus.emit('proxy:request', req)
      return
    }

    if (raw.event === 'response') {
      const existing = this.inflight.get(raw.id)
      if (!existing) {
        getLogger().debug('Response without matching request', { id: raw.id })
        return
      }
      const merged: CapturedRequest = {
        ...existing,
        status: raw.status,
        statusText: raw.statusText,
        responseHeaders: headersFromPairs(raw.headers),
        responseBody: decodeBody(raw.body),
        contentType: raw.contentType,
        durationMs: raw.durationMs,
        size: (existing.size ?? 0) + raw.bodySize
      }
      this.inflight.set(raw.id, merged)
      capturedRequestsRepo.upsert(project.id, merged)
      bus.emit('proxy:response', merged)
      return
    }

    if (raw.event === 'error') {
      const existing = this.inflight.get(raw.id)
      if (existing) {
        const merged: CapturedRequest = {
          ...existing,
          statusText: raw.message
        }
        capturedRequestsRepo.upsert(project.id, merged)
        bus.emit('proxy:response', merged)
      }
    }
  }

  private setStatus(next: ProxyStatus): void {
    this.status = next
    bus.emit('proxy:status', next)
  }
}

function locateMitmdump(): string | null {
  const bin = platform() === 'win32' ? 'mitmdump.exe' : 'mitmdump'
  const bundled = join(getPaths().tools, 'mitmproxy', bin)
  if (existsSync(bundled)) return bundled
  // PATH fallback so users who installed via brew/apt still benefit.
  for (const dir of (process.env['PATH'] ?? '').split(delimiter)) {
    if (!dir) continue
    const candidate = join(dir, bin)
    if (existsSync(candidate)) return candidate
  }
  return null
}

function locateFlowAddon(): string | null {
  // In dev mode, resources live under the repo's resources/ folder; in
  // packaged builds they sit under process.resourcesPath/tools-cache (we
  // ship them via electron-builder's extraResources mapping).
  const candidates = [
    join(app.getAppPath(), 'resources', 'mitmproxy', 'flow.py'),
    join(process.resourcesPath, 'tools-cache', 'mitmproxy', 'flow.py'),
    join(process.resourcesPath, 'app', 'resources', 'mitmproxy', 'flow.py')
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

function headersFromPairs(pairs: [string, string][]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of pairs) {
    // If the same header appears multiple times, join with comma per RFC 7230.
    out[k] = k in out ? `${out[k]}, ${v}` : v
  }
  return out
}

function decodeBody(b64: string | null): string | null {
  if (b64 === null) return null
  try {
    return Buffer.from(b64, 'base64').toString('utf8')
  } catch {
    return null
  }
}

function toHarEntry(req: CapturedRequest): unknown {
  return {
    startedDateTime: new Date(req.timestamp).toISOString(),
    time: req.durationMs ?? 0,
    request: {
      method: req.method,
      url: req.url,
      httpVersion: 'HTTP/1.1',
      cookies: [],
      headers: Object.entries(req.requestHeaders).map(([name, value]) => ({ name, value })),
      queryString: [],
      headersSize: -1,
      bodySize: req.requestBody ? Buffer.byteLength(req.requestBody, 'utf8') : 0,
      postData: req.requestBody
        ? {
            mimeType: req.requestHeaders['Content-Type'] ?? req.requestHeaders['content-type'] ?? 'text/plain',
            text: req.requestBody
          }
        : undefined
    },
    response: {
      status: req.status ?? 0,
      statusText: req.statusText ?? '',
      httpVersion: 'HTTP/1.1',
      cookies: [],
      headers: Object.entries(req.responseHeaders).map(([name, value]) => ({ name, value })),
      content: {
        size: req.responseBody ? Buffer.byteLength(req.responseBody, 'utf8') : 0,
        mimeType: req.contentType ?? 'application/octet-stream',
        text: req.responseBody ?? ''
      },
      redirectURL: '',
      headersSize: -1,
      bodySize: req.responseBody ? Buffer.byteLength(req.responseBody, 'utf8') : 0
    },
    cache: {},
    timings: {
      send: 0,
      wait: req.durationMs ?? 0,
      receive: 0
    }
  }
}

/**
 * Probe a TCP port by attempting a connect every 150 ms until the timeout.
 * Returns true on the first successful socket connect, false if the deadline
 * elapses. Used as a readiness signal for mitmdump's listener.
 */
async function waitForPort(host: string, port: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const ok = await new Promise<boolean>((resolve) => {
      const socket = createConnection({ host, port })
      let settled = false
      const finish = (result: boolean): void => {
        if (settled) return
        settled = true
        socket.destroy()
        resolve(result)
      }
      socket.once('connect', () => finish(true))
      socket.once('error', () => finish(false))
      socket.setTimeout(500, () => finish(false))
    })
    if (ok) return true
    await new Promise((r) => setTimeout(r, 150))
  }
  return false
}

export const proxyService = new ProxyService()
