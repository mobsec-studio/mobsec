import type { EndpointFinding } from '@shared/types'
import type { CorpusEntry } from './secrets'

/**
 * Extract URLs (and bare IPs) from the corpus and group by host.
 *
 * We intentionally keep the regex permissive (matches `http(s)://…` and
 * unbracketed bare IPs with a port) and dedupe by full URL so the UI can
 * show "this app talks to N hosts" at a glance. Send-to-repeater wires
 * up from the finding row directly.
 */

// eslint-disable-next-line no-useless-escape
const URL_REGEX = /\b(https?:\/\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+)/g

// Bare ipv4:port — useful for sniffing out raw backend endpoints that
// don't carry an http scheme. Skipping bare IPs without ports avoids
// matching version strings like "1.2.3.4".
const IPV4_PORT_REGEX = /\b((?:\d{1,3}\.){3}\d{1,3}:\d{2,5})\b/g

export function extractEndpoints(corpus: CorpusEntry[]): EndpointFinding[] {
  const byUrl = new Map<string, EndpointFinding>()

  for (const entry of corpus) {
    for (let i = 0; i < entry.lines.length; i++) {
      const line = entry.lines[i]!
      if (line.length > 4096) continue

      let m: RegExpExecArray | null
      URL_REGEX.lastIndex = 0
      while ((m = URL_REGEX.exec(line)) !== null) {
        const url = trimPunct(m[1]!)
        if (!url) continue
        addFinding(byUrl, url, entry.source, i + 1)
      }
      IPV4_PORT_REGEX.lastIndex = 0
      while ((m = IPV4_PORT_REGEX.exec(line)) !== null) {
        const target = m[1]!
        // Skip ones that are clearly version triplets followed by a
        // build number (e.g. "1.0.0:1234").
        if (/^0\.0\.0\./.test(target) || /^\d+\.0\.0\./.test(target)) continue
        addFinding(byUrl, `tcp://${target}`, entry.source, i + 1)
      }
    }
  }

  return [...byUrl.values()].sort((a, b) => {
    if (a.host !== b.host) return a.host.localeCompare(b.host)
    return a.url.localeCompare(b.url)
  })
}

function addFinding(
  map: Map<string, EndpointFinding>,
  url: string,
  source: string,
  line: number
): void {
  const existing = map.get(url)
  if (existing) {
    if (existing.occurrences.length < 25) {
      existing.occurrences.push({ source, line })
    }
    return
  }
  const parsed = safeParse(url)
  map.set(url, {
    url,
    scheme: parsed.scheme,
    host: parsed.host,
    port: parsed.port,
    path: parsed.path,
    insecure: parsed.scheme === 'http',
    occurrences: [{ source, line }]
  })
}

function safeParse(url: string): {
  scheme: string
  host: string
  port: number | null
  path: string
} {
  try {
    const u = new URL(url)
    return {
      scheme: u.protocol.replace(':', ''),
      host: u.hostname,
      port: u.port ? Number.parseInt(u.port, 10) : null,
      path: u.pathname + (u.search ?? '')
    }
  } catch {
    // tcp://ip:port — URL doesn't parse those, fall back to manual.
    const m = url.match(/^(\w+):\/\/([^/]+?)(:(\d+))?(\/.*)?$/)
    if (!m) return { scheme: 'unknown', host: url, port: null, path: '' }
    return {
      scheme: m[1]!,
      host: m[2]!,
      port: m[4] ? Number.parseInt(m[4], 10) : null,
      path: m[5] ?? ''
    }
  }
}

function trimPunct(s: string): string {
  // Lots of URLs in code end with `,` `;` `"` `)` etc. — strip them.
  return s.replace(/[),;.'"\]]+$/g, '')
}
