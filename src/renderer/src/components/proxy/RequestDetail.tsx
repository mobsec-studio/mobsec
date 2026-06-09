import { useMemo, useState } from 'react'
import { Copy, FileText, Globe, Send } from 'lucide-react'
import { toast } from 'sonner'
import type { CapturedRequest } from '@shared/types'
import { useProxyStore } from '@/stores/useProxyStore'
import { useRepeaterStore } from '@/stores/useRepeaterStore'
import { useUIStore } from '@/stores/useUIStore'
import { cn, formatBytes, formatDuration } from '@/lib/utils'
import { Button } from '../ui/button'
import { contentTypeShort, methodTone, statusTone } from './methodColor'
import { classifyRequest, requestSignals } from './requestIntel'

type TabId = 'raw' | 'headers' | 'body' | 'preview'
type Direction = 'request' | 'response'

export function RequestDetail(): JSX.Element {
  const selectedId = useProxyStore((s) => s.selectedRequestId)
  const request = useProxyStore((s) =>
    s.selectedRequestId ? s.requests.find((r) => r.id === s.selectedRequestId) : undefined
  )
  const [tab, setTab] = useState<TabId>('raw')
  const [direction, setDirection] = useState<Direction>('request')

  if (!selectedId || !request) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-xs text-muted-foreground">
        <span>Select a request from the list to inspect headers, body, and rendered preview.</span>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <RequestSummary req={request} />
      <SignalStrip req={request} />
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 overflow-x-auto border-b border-border bg-surface/40 px-3">
        <div className="flex h-7 items-center gap-1 rounded-md bg-surface-raised p-0.5 font-mono text-2xs">
          <DirectionButton active={direction === 'request'} onClick={() => setDirection('request')}>
            Request
          </DirectionButton>
          <DirectionButton
            active={direction === 'response'}
            onClick={() => setDirection('response')}
          >
            Response
          </DirectionButton>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <TabButton active={tab === 'raw'} onClick={() => setTab('raw')}>
            Raw
          </TabButton>
          <TabButton active={tab === 'headers'} onClick={() => setTab('headers')}>
            Headers
          </TabButton>
          <TabButton active={tab === 'body'} onClick={() => setTab('body')}>
            Body
          </TabButton>
          <TabButton active={tab === 'preview'} onClick={() => setTab('preview')}>
            Preview
          </TabButton>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {tab === 'raw' && <RawPane req={request} direction={direction} />}
        {tab === 'headers' && <HeadersPane req={request} direction={direction} />}
        {tab === 'body' && <BodyPane req={request} direction={direction} />}
        {tab === 'preview' && <PreviewPane req={request} direction={direction} />}
      </div>
    </div>
  )
}

function RequestSummary({ req }: { req: CapturedRequest }): JSX.Element {
  const createTab = useRepeaterStore((s) => s.createTab)
  const setActiveTool = useUIStore((s) => s.setActiveTool)
  const sendToRepeater = async (): Promise<void> => {
    try {
      const tab = await createTab(req.id)
      setActiveTool('repeater')
      toast.success('Sent to Repeater', { description: tab.name })
    } catch (err) {
      toast.error('Failed to send to Repeater', {
        description: err instanceof Error ? err.message : String(err)
      })
    }
  }
  return (
    <div className="flex min-h-12 shrink-0 items-center gap-3 border-b border-border bg-surface/30 px-3 py-1.5 text-xs">
      <span className={cn('font-mono font-semibold', methodTone(req.method))}>
        {req.method.toUpperCase()}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-foreground/80" title={req.url}>
        {req.url}
      </span>
      <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2 font-mono text-2xs text-muted-foreground">
        {req.status !== null && (
          <span className={cn('font-semibold', statusTone(req.status))}>
            {req.status} {req.statusText ?? ''}
          </span>
        )}
        {req.durationMs !== null && <span>{formatDuration(req.durationMs)}</span>}
        {req.size > 0 && <span>{formatBytes(req.size)}</span>}
        <Button
          size="icon-sm"
          variant="ghost"
          className="h-6 w-6"
          title="Copy URL"
          onClick={() => {
            void navigator.clipboard.writeText(req.url)
            toast.success('URL copied')
          }}
        >
          <Copy className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2"
          onClick={() => void sendToRepeater()}
        >
          <Send className="h-3 w-3" /> Send to Repeater
        </Button>
      </div>
    </div>
  )
}

function SignalStrip({ req }: { req: CapturedRequest }): JSX.Element {
  const signals = requestSignals(req)
  const kind = classifyRequest(req)
  return (
    <div className="flex min-h-8 shrink-0 items-center gap-2 overflow-x-auto border-b border-border bg-surface/20 px-3 py-1 text-2xs">
      <span className="shrink-0 font-mono uppercase tracking-wider text-muted-foreground">
        {kind}
      </span>
      <span className="shrink-0 font-mono text-muted-foreground">
        {req.contentType ? contentTypeShort(req.contentType) : 'no content-type'}
      </span>
      {signals.length === 0 ? (
        <span className="font-mono text-muted-foreground/70">No high-signal flags.</span>
      ) : (
        signals.map((signal) => (
          <span
            key={signal.kind}
            className={cn('shrink-0 rounded border px-1.5 py-0.5 font-mono', signal.tone)}
            title={signal.detail}
          >
            {signal.label}
          </span>
        ))
      )}
    </div>
  )
}

function DirectionButton({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-6 rounded px-2 transition-colors',
        active ? 'bg-background text-foreground shadow' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}

function TabButton({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-6 rounded-md px-2.5 font-mono text-2xs uppercase tracking-wider transition-colors',
        active
          ? 'bg-surface-raised text-foreground'
          : 'text-muted-foreground hover:bg-surface-raised/60 hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}

function RawPane({
  req,
  direction
}: {
  req: CapturedRequest
  direction: Direction
}): JSX.Element {
  const text = useMemo(() => buildRawWire(req, direction), [req, direction])
  return <TextBlock text={text} />
}

function HeadersPane({
  req,
  direction
}: {
  req: CapturedRequest
  direction: Direction
}): JSX.Element {
  const headers = direction === 'request' ? req.requestHeaders : req.responseHeaders
  const entries = Object.entries(headers)
  if (entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        No headers.
      </div>
    )
  }
  return (
    <table className="w-full font-mono text-xs">
      <tbody>
        {entries.map(([name, value]) => (
          <tr key={name} className="border-b border-border/30">
            <td className="w-1/3 px-3 py-1.5 align-top font-medium text-muted-foreground">
              {name}
            </td>
            <td className="break-all px-3 py-1.5 align-top text-foreground/90">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function BodyPane({
  req,
  direction
}: {
  req: CapturedRequest
  direction: Direction
}): JSX.Element {
  const body = direction === 'request' ? req.requestBody : req.responseBody
  if (!body) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        No body.
      </div>
    )
  }
  const text = tryPrettyJson(body)
  return <TextBlock text={text} />
}

function PreviewPane({
  req,
  direction
}: {
  req: CapturedRequest
  direction: Direction
}): JSX.Element {
  const body = direction === 'request' ? req.requestBody : req.responseBody
  const ct = direction === 'request' ? req.requestHeaders['Content-Type'] ?? req.requestHeaders['content-type'] : req.contentType
  if (!body || !ct) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground">
        <FileText className="h-3.5 w-3.5" /> No previewable content.
      </div>
    )
  }
  if (/image\//i.test(ct)) {
    // Bodies were base64-decoded back to utf8 in main; for non-text images
    // this means we lost the bytes. Show a placeholder. Phase 7 polish will
    // pass raw bytes through and render an <img> with a blob URL.
    return (
      <div className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground">
        <Globe className="h-3.5 w-3.5" /> Image preview not supported yet.
      </div>
    )
  }
  if (/html/i.test(ct)) {
    // Render via an opaque sandbox iframe so any scripts can't escape.
    return (
      <iframe
        title="Preview"
        sandbox=""
        srcDoc={body}
        className="h-full w-full border-0 bg-white"
      />
    )
  }
  return <TextBlock text={tryPrettyJson(body)} />
}

function TextBlock({ text }: { text: string }): JSX.Element {
  return (
    <div className="relative h-full">
      <Button
        size="icon-sm"
        variant="ghost"
        className="absolute right-2 top-2 z-10 h-6 w-6"
        onClick={() => void navigator.clipboard.writeText(text)}
        title="Copy"
      >
        <Copy className="h-3 w-3" />
      </Button>
      <pre className="h-full overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-xs leading-relaxed text-foreground/90">
        {text}
      </pre>
    </div>
  )
}

function buildRawWire(req: CapturedRequest, direction: Direction): string {
  if (direction === 'request') {
    const lines: string[] = []
    const host = req.port && req.port !== (req.scheme === 'https' ? 443 : 80)
      ? `${req.host}:${req.port}`
      : req.host
    lines.push(`${req.method.toUpperCase()} ${req.path} HTTP/1.1`)
    lines.push(`Host: ${host}`)
    for (const [k, v] of Object.entries(req.requestHeaders)) {
      if (k.toLowerCase() === 'host') continue
      lines.push(`${k}: ${v}`)
    }
    lines.push('')
    if (req.requestBody) lines.push(req.requestBody)
    return lines.join('\n')
  }
  const lines: string[] = []
  if (req.status === null) {
    lines.push('(no response yet)')
    return lines.join('\n')
  }
  lines.push(`HTTP/1.1 ${req.status} ${req.statusText ?? ''}`.trim())
  for (const [k, v] of Object.entries(req.responseHeaders)) {
    lines.push(`${k}: ${v}`)
  }
  lines.push('')
  if (req.responseBody) lines.push(req.responseBody)
  return lines.join('\n')
}

function tryPrettyJson(body: string): string {
  const trimmed = body.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return body
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2)
  } catch {
    return body
  }
}
