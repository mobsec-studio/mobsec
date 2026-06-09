import type { CapturedRequest } from '@shared/types'

export type ProxyResourceKind =
  | 'document'
  | 'xhr'
  | 'script'
  | 'style'
  | 'image'
  | 'font'
  | 'media'
  | 'other'

export type ProxySignalKind = 'http' | 'auth' | 'cookies' | 'error' | 'api' | 'large'

export interface ProxySignal {
  kind: ProxySignalKind
  label: string
  detail: string
  tone: string
}

const IMAGE_EXT = /\.(?:avif|bmp|gif|ico|jpe?g|png|svg|webp)(?:[?#].*)?$/i
const SCRIPT_EXT = /\.(?:js|mjs|cjs)(?:[?#].*)?$/i
const STYLE_EXT = /\.(?:css)(?:[?#].*)?$/i
const FONT_EXT = /\.(?:eot|otf|ttf|woff2?)(?:[?#].*)?$/i
const MEDIA_EXT = /\.(?:m4a|m4v|mp3|mp4|ogg|opus|wav|webm)(?:[?#].*)?$/i

export function classifyRequest(req: CapturedRequest): ProxyResourceKind {
  const ct = (req.contentType ?? headerValue(req.responseHeaders, 'content-type') ?? '').toLowerCase()
  const accept = (headerValue(req.requestHeaders, 'accept') ?? '').toLowerCase()
  const path = req.path.toLowerCase()

  if (ct.includes('text/html') || accept.includes('text/html')) return 'document'
  if (ct.includes('json') || ct.includes('xml') || ct.includes('grpc') || ct.includes('protobuf')) return 'xhr'
  if (ct.startsWith('image/') || IMAGE_EXT.test(path)) return 'image'
  if (ct.includes('javascript') || SCRIPT_EXT.test(path)) return 'script'
  if (ct.includes('text/css') || STYLE_EXT.test(path)) return 'style'
  if (ct.includes('font') || FONT_EXT.test(path)) return 'font'
  if (/^(audio|video)\//.test(ct) || MEDIA_EXT.test(path)) return 'media'
  if (isApiPath(path) || req.method.toUpperCase() !== 'GET') return 'xhr'
  return 'other'
}

export function requestSignals(req: CapturedRequest): ProxySignal[] {
  const out: ProxySignal[] = []
  if (req.scheme === 'http') {
    out.push({
      kind: 'http',
      label: 'HTTP',
      detail: 'Traffic is not protected by TLS.',
      tone: 'border-warning/40 bg-warning/10 text-warning'
    })
  }
  if (headerValue(req.requestHeaders, 'authorization') || urlHasSensitiveToken(req.url)) {
    out.push({
      kind: 'auth',
      label: 'Auth',
      detail: 'Authorization material appears in the request.',
      tone: 'border-primary/40 bg-primary/10 text-primary'
    })
  }
  if (headerValue(req.requestHeaders, 'cookie') || headerValue(req.responseHeaders, 'set-cookie')) {
    out.push({
      kind: 'cookies',
      label: 'Cookie',
      detail: 'Request or response carries cookie state.',
      tone: 'border-accent/40 bg-accent/10 text-accent'
    })
  }
  if (req.status !== null && req.status >= 400) {
    out.push({
      kind: 'error',
      label: `${Math.floor(req.status / 100)}xx`,
      detail: 'Server returned an error-class response.',
      tone: req.status >= 500
        ? 'border-destructive/40 bg-destructive/10 text-destructive'
        : 'border-warning/40 bg-warning/10 text-warning'
    })
  }
  if (classifyRequest(req) === 'xhr') {
    out.push({
      kind: 'api',
      label: 'API',
      detail: 'Likely API/XHR traffic.',
      tone: 'border-border bg-surface text-muted-foreground'
    })
  }
  if (req.size >= 1024 * 1024) {
    out.push({
      kind: 'large',
      label: 'Large',
      detail: 'Payload is at least 1 MB.',
      tone: 'border-border bg-surface text-muted-foreground'
    })
  }
  return out
}

export function headerValue(headers: Record<string, string>, name: string): string | undefined {
  const needle = name.toLowerCase()
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === needle) return value
  }
  return undefined
}

function isApiPath(path: string): boolean {
  return /(?:^|\/)(?:api|graphql|rest|rpc|v\d+)(?:\/|$)/i.test(path)
}

function urlHasSensitiveToken(url: string): boolean {
  try {
    const parsed = new URL(url)
    for (const key of parsed.searchParams.keys()) {
      if (/token|auth|access|secret|key|session/i.test(key)) return true
    }
  } catch {
    return /[?&](?:token|auth|access|secret|key|session)=/i.test(url)
  }
  return false
}
