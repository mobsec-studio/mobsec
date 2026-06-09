import type { RepeaterTab } from '@shared/types'

/**
 * Render a RepeaterTab as a single-line `curl` command. We use single quotes
 * around values and escape embedded single quotes with `'\''` (the standard
 * shell-quoting trick). `--insecure` mirrors the repeater's
 * `rejectUnauthorized: false` setting so the command works against the same
 * self-signed targets MobSec talks to.
 */
export function toCurl(tab: RepeaterTab): string {
  const method = tab.method.toUpperCase()
  const parts: string[] = ['curl', '-X', method, sq(tab.url)]
  for (const line of tab.headers.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const sep = trimmed.indexOf(':')
    if (sep <= 0) continue
    const name = trimmed.slice(0, sep).trim()
    const value = trimmed.slice(sep + 1).trim()
    if (!name) continue
    if (/^(host|content-length)$/i.test(name)) continue
    parts.push('-H', sq(`${name}: ${value}`))
  }
  const hasBody = method !== 'GET' && method !== 'HEAD' && tab.body.length > 0
  if (hasBody) {
    parts.push('--data-raw', sq(tab.body))
  }
  parts.push('--insecure')
  return parts.join(' ')
}

function sq(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}
