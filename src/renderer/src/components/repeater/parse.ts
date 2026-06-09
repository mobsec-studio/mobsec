/**
 * Repeater parsing utilities.
 *
 * Turns the textual fields the user edits (raw header block, URL, body)
 * into structured tables for the Inspector panel. Everything here is
 * renderer-side so it runs synchronously on every edit; the tables
 * update live.
 */

export interface KvRow {
  name: string
  value: string
}

/**
 * Split a header block ("Header-Name: value\nOther: thing\n…") into a
 * list. Lines that don't contain `:` are dropped silently — they're
 * almost always blank lines or user-typed comments.
 */
export function parseHeaders(block: string): KvRow[] {
  if (!block) return []
  const out: KvRow[] = []
  for (const raw of block.split(/\r?\n/)) {
    const line = raw.trimEnd()
    if (!line) continue
    const i = line.indexOf(':')
    if (i <= 0) continue
    out.push({ name: line.slice(0, i).trim(), value: line.slice(i + 1).trim() })
  }
  return out
}

/**
 * Extract the query string from a URL and decompose into name/value
 * pairs. Tolerant of relative URLs and URLs without a scheme.
 */
export function parseQuery(url: string): KvRow[] {
  if (!url) return []
  const qIdx = url.indexOf('?')
  if (qIdx < 0) return []
  // Use URLSearchParams against the query string only — avoids the new
  // URL() constructor choking on relative URLs.
  const out: KvRow[] = []
  const params = new URLSearchParams(url.slice(qIdx + 1))
  for (const [name, value] of params) out.push({ name, value })
  return out
}

/** `application/x-www-form-urlencoded` body → table. */
export function parseFormBody(body: string): KvRow[] {
  if (!body) return []
  if (body.includes('\n') && !body.includes('=')) return []
  try {
    const params = new URLSearchParams(body)
    const out: KvRow[] = []
    for (const [name, value] of params) out.push({ name, value })
    return out
  } catch {
    return []
  }
}

/** Parse a `Cookie: a=1; b=2` request header into rows. */
export function parseRequestCookies(headers: KvRow[]): KvRow[] {
  const cookieHeader = headers.find((h) => h.name.toLowerCase() === 'cookie')?.value
  if (!cookieHeader) return []
  const out: KvRow[] = []
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=')
    if (eq <= 0) continue
    out.push({ name: part.slice(0, eq).trim(), value: part.slice(eq + 1).trim() })
  }
  return out
}

/**
 * Parse `Set-Cookie:` response headers. Each Set-Cookie may carry
 * attributes (Path, Domain, Max-Age, HttpOnly, Secure, SameSite). We
 * surface the cookie name+value as the row label and the attributes as
 * a single comma-joined detail so the table stays one column.
 */
export interface SetCookieRow {
  name: string
  value: string
  attributes: string
}

export function parseSetCookies(headers: KvRow[]): SetCookieRow[] {
  const out: SetCookieRow[] = []
  for (const h of headers) {
    if (h.name.toLowerCase() !== 'set-cookie') continue
    const parts = h.value.split(';')
    if (parts.length === 0) continue
    const head = parts[0]!.trim()
    const eq = head.indexOf('=')
    if (eq <= 0) continue
    out.push({
      name: head.slice(0, eq).trim(),
      value: head.slice(eq + 1).trim(),
      attributes: parts.slice(1).map((p) => p.trim()).filter(Boolean).join('; ')
    })
  }
  return out
}

/**
 * Render the request as an HTTP/1.1 wire-format string ("Raw" view).
 * The first line is the request-line; then headers; then a blank line;
 * then the body. We compute the path from the URL when possible so the
 * output exactly matches what goes on the wire.
 */
export function toRawRequest(input: {
  method: string
  url: string
  headers: string
  body: string
}): string {
  const path = pathOf(input.url) || '/'
  const head = `${input.method.toUpperCase()} ${path} HTTP/1.1`
  const tail = input.body ? `\n\n${input.body}` : '\n\n'
  return `${head}\n${input.headers.trimEnd()}${tail}`
}

export function toRawResponse(input: {
  status: number
  statusText?: string
  headers: string
  body: string
}): string {
  const statusLine = `HTTP/1.1 ${input.status} ${input.statusText ?? ''}`.trimEnd()
  return `${statusLine}\n${input.headers.trimEnd()}\n\n${input.body}`
}

function pathOf(url: string): string {
  try {
    const u = new URL(url)
    return `${u.pathname}${u.search}`
  } catch {
    // Treat input as already-a-path.
    if (url.startsWith('/')) return url
    const qi = url.indexOf('?')
    return qi < 0 ? '/' : url.slice(qi)
  }
}

/**
 * Convert any text into a classic hex dump. We deliberately use
 * `TextEncoder` (browser-safe) rather than Node's Buffer because this
 * runs in the renderer where Buffer isn't available with
 * contextIsolation enabled.
 */
export function toHexDump(text: string, perLine = 16, maxBytes = 32 * 1024): string {
  const encoded = new TextEncoder().encode(text)
  const slice = encoded.length > maxBytes ? encoded.subarray(0, maxBytes) : encoded
  const lines: string[] = []
  for (let off = 0; off < slice.length; off += perLine) {
    const chunk = slice.subarray(off, off + perLine)
    const hex = Array.from(chunk, (b) => b.toString(16).padStart(2, '0'))
      .join(' ')
      .padEnd(perLine * 3 - 1, ' ')
    const ascii = Array.from(chunk, (b) =>
      b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.'
    ).join('')
    lines.push(`${off.toString(16).padStart(8, '0')}  ${hex}  |${ascii}|`)
  }
  if (encoded.length > maxBytes) {
    lines.push(`… ${encoded.length - maxBytes} more bytes truncated`)
  }
  return lines.join('\n')
}
