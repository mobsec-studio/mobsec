import { randomUUID } from 'node:crypto'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest, type RequestOptions } from 'node:https'
import { writeFile } from 'node:fs/promises'
import { URL } from 'node:url'
import type {
  CapturedRequest,
  RepeaterResponse,
  RepeaterSnapshot,
  RepeaterTab
} from '@shared/types'
import { activeProject, capturedRequestsRepo, repeaterTabsRepo } from './database'
import { getLogger } from '../utils/logger'

/**
 * Repeater. Each tab is an editable HTTP request. The user clicks Send and
 * we replay it from the main process — this way:
 *
 *   - We bypass the renderer's strict CORS / mixed-content rules.
 *   - We can disable TLS validation so self-signed certs from mitmproxy or
 *     any pentest target server don't error.
 *   - The browser's automatic redirect-following is off; the user sees the
 *     real 30x response as the server sends it.
 *
 * Tabs are persisted in the `repeater_tabs` SQLite table. The shape of one
 * tab is `RepeaterTab` from `@shared/types`.
 */

// Hard upper bound on what we feed back into Monaco. 1 MiB is plenty for
// any human-readable API response; bigger payloads are almost always
// binary (PDFs, images, video) which the editor can't render usefully
// anyway. Allowing more lets a single bad response OOM the renderer.
const MAX_RESPONSE_BYTES = 1024 * 1024 // 1 MiB
const MAX_REDIRECTS = 5
/** Cap how many past sends we keep per tab. Each snapshot can carry up to
 *  ~256 KiB of request + 1 MiB of response, so this is the upper bound on
 *  per-tab memory: 20 × 1.25 MiB ≈ 25 MiB. */
const MAX_HISTORY = 20
const MAX_REPEAT = 100

class RepeaterService {
  async listTabs(): Promise<RepeaterTab[]> {
    const project = activeProject.ensure()
    return repeaterTabsRepo.list(project.id)
  }

  async createTab(fromRequestId?: string): Promise<RepeaterTab> {
    const project = activeProject.ensure()
    const now = new Date().toISOString()
    const id = randomUUID()

    let source: CapturedRequest | null = null
    if (fromRequestId) {
      source = capturedRequestsRepo.get(project.id, fromRequestId)
    }

    const defaultSettings = {
      autoContentLength: true,
      followRedirects: false,
      repeatCount: 1
    }
    const tab: RepeaterTab = source
      ? {
          id,
          name: deriveName(source.url, source.method),
          method: source.method,
          url: source.url,
          headers: headersToText(source.requestHeaders),
          body: source.requestBody ?? '',
          lastResponse: null,
          history: [],
          settings: defaultSettings,
          createdAt: now,
          updatedAt: now
        }
      : {
          id,
          name: 'New request',
          method: 'GET',
          url: 'https://example.com',
          headers: 'User-Agent: MobSec-Studio/0.1\nAccept: */*',
          body: '',
          lastResponse: null,
          history: [],
          settings: defaultSettings,
          createdAt: now,
          updatedAt: now
        }

    repeaterTabsRepo.upsert(project.id, tab)
    return tab
  }

  async updateTab(tab: RepeaterTab): Promise<RepeaterTab> {
    const project = activeProject.ensure()
    const next: RepeaterTab = {
      ...tab,
      history: tab.history ?? [],
      settings: tab.settings ?? {
        autoContentLength: true,
        followRedirects: false,
        repeatCount: 1
      },
      updatedAt: new Date().toISOString()
    }
    repeaterTabsRepo.upsert(project.id, next)
    return next
  }

  async deleteTab(id: string): Promise<void> {
    const project = activeProject.ensure()
    repeaterTabsRepo.delete(project.id, id)
  }

  async saveBody(filePath: string, content: string): Promise<void> {
    await writeFile(filePath, content, 'utf8')
  }

  async send(tab: RepeaterTab): Promise<RepeaterTab> {
    const project = activeProject.ensure()
    const settings = tab.settings ?? {
      autoContentLength: true,
      followRedirects: false,
      repeatCount: 1
    }
    const repeats = Math.max(1, Math.min(MAX_REPEAT, Math.floor(settings.repeatCount || 1)))
    const history = [...(tab.history ?? [])]

    let lastSnapshot: RepeaterSnapshot | null = null
    for (let i = 0; i < repeats; i++) {
      // Apply per-send headers transformation (e.g. recompute Content-Length).
      const requestHeaders = computeRequestHeaders(tab, settings)
      const requestRecord = {
        method: tab.method,
        url: tab.url,
        headers: requestHeaders,
        body: tab.body
      }
      const sentAt = new Date().toISOString()
      try {
        const response = await sendOnce(
          tab.method,
          tab.url,
          requestHeaders,
          tab.body,
          settings.followRedirects
        )
        lastSnapshot = { sentAt, request: requestRecord, response }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        getLogger().info('Repeater request failed', { url: tab.url, error: message })
        lastSnapshot = {
          sentAt,
          request: requestRecord,
          response: null,
          error: message
        }
      }
      history.push(lastSnapshot)
    }

    // Cap history.
    while (history.length > MAX_HISTORY) history.shift()

    const updated: RepeaterTab = {
      ...tab,
      settings,
      lastResponse: lastSnapshot?.response ?? null,
      history,
      updatedAt: new Date().toISOString()
    }
    repeaterTabsRepo.upsert(project.id, updated)
    return updated
  }
}

/**
 * Build the headers we'll actually send, applying any per-tab "auto" rules.
 * Currently:
 *   - autoContentLength: drop user-supplied Content-Length, then add a fresh
 *     one matching the actual body byte length when there IS a body.
 */
function computeRequestHeaders(
  tab: RepeaterTab,
  settings: RepeaterTab['settings']
): string {
  if (!settings.autoContentLength) return tab.headers
  const lines = tab.headers.split(/\r?\n/).filter((line) => {
    const eq = line.indexOf(':')
    if (eq <= 0) return true
    return line.slice(0, eq).trim().toLowerCase() !== 'content-length'
  })
  const method = tab.method.toUpperCase()
  const allowsBody = method !== 'GET' && method !== 'HEAD' && tab.body.length > 0
  if (allowsBody) {
    const length = Buffer.byteLength(tab.body, 'utf8')
    lines.push(`Content-Length: ${length}`)
  }
  return lines.filter((l) => l.trim().length > 0).join('\n')
}

/**
 * Fire a single HTTP request, recursively chasing 3xx Location headers up
 * to MAX_REDIRECTS when `followRedirects` is on. The returned `headers`
 * string is the headers we received from the *final* response in the chain.
 */
async function sendOnce(
  method: string,
  urlString: string,
  headersText: string,
  body: string,
  followRedirects: boolean,
  hopsLeft = MAX_REDIRECTS
): Promise<RepeaterResponse> {
  const url = new URL(urlString)
  const headers = parseHeaders(headersText)
  const start = Date.now()

  const result = await new Promise<{
    status: number
    statusText: string
    headers: Record<string, string>
    body: string
  }>((resolve, reject) => {
    const isHttps = url.protocol === 'https:'
    const lib = isHttps ? httpsRequest : httpRequest
    const opts: RequestOptions = {
      method: method.toUpperCase(),
      protocol: url.protocol,
      host: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      headers,
      rejectUnauthorized: false
    }
    const req = lib(opts, (res) => {
      const chunks: Buffer[] = []
      let total = 0
      res.on('data', (chunk: Buffer) => {
        total += chunk.byteLength
        if (total <= MAX_RESPONSE_BYTES) chunks.push(chunk)
      })
      res.on('end', () => {
        const buffer = Buffer.concat(chunks)
        const responseHeaders: Record<string, string> = {}
        for (const [k, v] of Object.entries(res.headers)) {
          if (v === undefined) continue
          responseHeaders[k] = Array.isArray(v) ? v.join(', ') : v
        }
        const ct = (responseHeaders['content-type'] ?? '').toLowerCase()
        const isLikelyBinary =
          /^image\/|^video\/|^audio\/|^application\/(zip|x-zip|octet-stream|pdf|wasm|x-protobuf)/.test(
            ct
          ) || looksBinary(buffer)
        let respBody: string
        if (isLikelyBinary && buffer.length > 0) {
          respBody = `[binary response, ${buffer.length} bytes, content-type=${ct || 'unknown'}]`
        } else {
          respBody = buffer.toString('utf8')
          if (total > MAX_RESPONSE_BYTES) respBody += '\n…(response truncated)'
        }
        resolve({
          status: res.statusCode ?? 0,
          statusText: res.statusMessage ?? '',
          headers: responseHeaders,
          body: respBody
        })
      })
      res.on('error', reject)
    })
    req.on('error', reject)
    const bodyToSend = method.toUpperCase() === 'GET' || method.toUpperCase() === 'HEAD' ? null : body
    if (bodyToSend !== null && bodyToSend !== '') req.write(bodyToSend)
    req.end()
  })

  // Follow 3xx if asked. Strip the body for redirect chains (per fetch spec
  // behavior for 301/302/303 — they coerce to GET). 307/308 preserve method
  // and body, so we keep them as-is.
  if (
    followRedirects &&
    hopsLeft > 0 &&
    result.status >= 300 &&
    result.status < 400 &&
    result.headers['location']
  ) {
    const nextUrl = new URL(result.headers['location'], urlString).toString()
    const preserveBody = result.status === 307 || result.status === 308
    const nextMethod = preserveBody ? method : 'GET'
    const elapsedBeforeRedirect = Date.now() - start
    const next = await sendOnce(
      nextMethod,
      nextUrl,
      headersText,
      preserveBody ? body : '',
      true,
      hopsLeft - 1
    )
    return {
      ...next,
      durationMs: elapsedBeforeRedirect + next.durationMs,
      redirects: [
        {
          status: result.status,
          statusText: result.statusText,
          url: urlString,
          location: nextUrl
        },
        ...(next.redirects ?? [])
      ]
    }
  }

  return {
    status: result.status,
    statusText: result.statusText,
    headers: headersToText(result.headers),
    body: result.body,
    durationMs: Date.now() - start,
    redirects: []
  }
}

function deriveName(url: string, method: string): string {
  try {
    const u = new URL(url)
    const pathSuffix = u.pathname.length > 1 ? u.pathname.slice(0, 30) : '/'
    return `${method.toUpperCase()} ${u.hostname}${pathSuffix}`
  } catch {
    return `${method.toUpperCase()} ${url.slice(0, 30)}`
  }
}

/** Quick heuristic for binary content. Samples the first 1 KiB and counts
 *  null + non-printable bytes — any null byte is a strong signal, and >30%
 *  non-printable is suspicious. UTF-8 multi-byte sequences are tolerated. */
function looksBinary(buf: Buffer): boolean {
  const sample = buf.subarray(0, Math.min(1024, buf.length))
  if (sample.indexOf(0) !== -1) return true
  let nonPrintable = 0
  for (const byte of sample) {
    const isControl = byte < 0x09 || (byte > 0x0d && byte < 0x20) || byte === 0x7f
    if (isControl) nonPrintable++
  }
  return sample.length > 0 && nonPrintable / sample.length > 0.3
}

function headersToText(headers: Record<string, string>): string {
  return Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
}

function parseHeaders(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const sep = trimmed.indexOf(':')
    if (sep <= 0) continue
    const name = trimmed.slice(0, sep).trim()
    const value = trimmed.slice(sep + 1).trim()
    if (!name) continue
    // Strip hop-by-hop and length-affecting headers we don't want to forge.
    if (/^(host|content-length|connection|transfer-encoding)$/i.test(name)) continue
    out[name] = value
  }
  return out
}

export const repeaterService = new RepeaterService()
