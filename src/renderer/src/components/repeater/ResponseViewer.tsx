import Editor from '@monaco-editor/react'
import { Copy, Download, Save } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import type { RepeaterTab } from '@shared/types'
import { cn, formatBytes, formatDuration, utf8ByteLength } from '@/lib/utils'
import { useResolvedTheme } from '@/stores/useThemeStore'
import { statusTone } from '../proxy/methodColor'
import { toHexDump, toRawResponse } from './parse'

type ResponseView = 'pretty' | 'raw' | 'hex' | 'render'

interface ResponseViewerProps {
  tab: RepeaterTab
  pending: boolean
  overrideResponse?: RepeaterTab['lastResponse']
  errorMessage?: string
}

export function ResponseViewer({
  tab,
  pending,
  overrideResponse,
  errorMessage
}: ResponseViewerProps): JSX.Element {
  const [view, setView] = useState<ResponseView>('pretty')
  const [pane, setPane] = useState<'headers' | 'body'>('body')
  const res = overrideResponse !== undefined ? overrideResponse : tab.lastResponse

  const contentType =
    res?.headers.match(/^content-type:\s*([^\r\n;]+)/im)?.[1]?.toLowerCase().trim() ?? null
  const renderable =
    res !== null &&
    contentType !== null &&
    (contentType.includes('html') ||
      contentType.startsWith('image/') ||
      contentType.includes('svg'))

  const rawWire = useMemo(() => {
    if (!res) return ''
    return toRawResponse({
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
      body: res.body
    })
  }, [res])
  const hexDump = useMemo(() => (res ? toHexDump(res.body) : ''), [res])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-10 shrink-0 items-center gap-3 border-b border-border bg-surface/30 px-3 py-1 font-mono text-xs">
        {res ? (
          <>
            <span className={cn('shrink-0 font-semibold', statusTone(res.status))}>
              {res.status === 0 ? 'NETWORK ERROR' : res.status}
              {res.statusText ? <span className="ml-1 text-muted-foreground">{res.statusText}</span> : null}
            </span>
            <span className="shrink-0 text-muted-foreground">{formatDuration(res.durationMs)}</span>
            <span className="shrink-0 text-muted-foreground">
              {formatBytes(utf8ByteLength(res.body || ''))}
            </span>
            {res.redirects && res.redirects.length > 0 && (
              <span className="shrink-0 rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-2xs text-accent">
                {res.redirects.length} redirect{res.redirects.length === 1 ? '' : 's'}
              </span>
            )}
            {contentType && (
              <span className="min-w-0 truncate text-muted-foreground" title={contentType}>
                {contentType}
              </span>
            )}
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <IconButton
                title="Copy body"
                onClick={() => {
                  void navigator.clipboard.writeText(res.body || '')
                  toast.success('Body copied')
                }}
              >
                <Copy className="h-3 w-3" />
              </IconButton>
              <IconButton
                title="Copy raw response"
                onClick={() => {
                  void navigator.clipboard.writeText(rawWire)
                  toast.success('Raw response copied')
                }}
              >
                <Save className="h-3 w-3" />
              </IconButton>
              <IconButton
                title="Save body to file"
                onClick={async () => {
                  const dest = await window.api.dialog.showSave({
                    title: 'Save response body',
                    defaultPath: `response-${Date.now()}${extensionForContentType(contentType)}`
                  })
                  if (!dest.ok || !dest.value) return
                  const saved = await window.api.repeater.saveBody(dest.value, res.body || '')
                  if (saved.ok) toast.success('Body saved', { description: dest.value })
                  else toast.error('Save failed', { description: saved.error })
                }}
              >
                <Download className="h-3 w-3" />
              </IconButton>
            </div>
          </>
        ) : errorMessage ? (
          <span className="text-destructive">{errorMessage}</span>
        ) : (
          <span className="text-muted-foreground">
            {pending ? 'Sending...' : 'No response yet. Press Send.'}
          </span>
        )}
      </div>
      {res?.redirects && res.redirects.length > 0 && (
        <RedirectChain redirects={res.redirects} />
      )}
      <div className="flex h-7 shrink-0 items-center justify-between gap-1 overflow-x-auto border-b border-border bg-surface/20 px-3">
        <div className="flex shrink-0 items-center gap-1">
          <PaneButton active={view === 'pretty'} onClick={() => setView('pretty')}>
            Pretty
          </PaneButton>
          <PaneButton active={view === 'raw'} onClick={() => setView('raw')}>
            Raw
          </PaneButton>
          <PaneButton active={view === 'hex'} onClick={() => setView('hex')}>
            Hex
          </PaneButton>
          <PaneButton
            active={view === 'render'}
            onClick={() => setView('render')}
            disabled={!renderable}
          >
            Render
          </PaneButton>
        </div>
        {view === 'pretty' && (
          <div className="flex shrink-0 items-center gap-1">
            <PaneButton active={pane === 'headers'} onClick={() => setPane('headers')}>
              Headers
            </PaneButton>
            <PaneButton active={pane === 'body'} onClick={() => setPane('body')}>
              Body
            </PaneButton>
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1">
        {!res ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            {pending ? 'Waiting for response...' : 'Send the request to see the response here.'}
          </div>
        ) : view === 'pretty' ? (
          pane === 'headers' ? (
            <Monaco language="ini" value={res.headers} readOnly />
          ) : (
            <Monaco
              language={languageForBody(res.headers, res.body)}
              value={tryPretty(res.headers, res.body)}
              readOnly
            />
          )
        ) : view === 'raw' ? (
          <Monaco language="http" value={rawWire} readOnly />
        ) : view === 'hex' ? (
          <Monaco language="plaintext" value={hexDump} readOnly />
        ) : (
          <RenderPane headers={res.headers} body={res.body} />
        )}
      </div>
    </div>
  )
}

function RedirectChain({ redirects }: { redirects: NonNullable<RepeaterTab['lastResponse']>['redirects'] }): JSX.Element {
  if (!redirects || redirects.length === 0) return <></>
  return (
    <div className="flex min-h-7 shrink-0 items-center gap-2 overflow-x-auto border-b border-border bg-surface/20 px-3 py-1 font-mono text-2xs">
      <span className="shrink-0 uppercase tracking-wider text-muted-foreground">
        Redirects
      </span>
      {redirects.map((hop, index) => (
        <span
          key={`${hop.status}:${hop.location}:${index}`}
          className="max-w-[22rem] shrink-0 truncate rounded border border-border bg-surface/50 px-2 py-0.5 text-muted-foreground"
          title={`${hop.status} ${hop.url} -> ${hop.location}`}
        >
          {hop.status} {hop.location}
        </span>
      ))}
    </div>
  )
}

function IconButton({
  title,
  onClick,
  children
}: {
  title: string
  onClick: () => void
  children: ReactNode
}): JSX.Element {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="rounded p-1 text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
    >
      {children}
    </button>
  )
}

function PaneButton({
  active,
  onClick,
  disabled,
  children
}: {
  active: boolean
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'h-5 rounded-md px-2 font-mono text-2xs uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        active
          ? 'bg-surface-raised text-foreground'
          : 'text-muted-foreground hover:bg-surface-raised/60 hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}

function Monaco({
  language,
  value,
  readOnly
}: {
  language: string
  value: string
  readOnly?: boolean
}): JSX.Element {
  const editorTheme = useResolvedTheme() === 'dark' ? 'vs-dark' : 'vs'
  return (
    <Editor
      language={language}
      value={value || ''}
      theme={editorTheme}
      options={{
        readOnly,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        renderLineHighlight: 'none',
        lineNumbers: 'on',
        wordWrap: 'on',
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 12,
        contextmenu: false,
        padding: { top: 8, bottom: 8 }
      }}
    />
  )
}

function RenderPane({ headers, body }: { headers: string; body: string }): JSX.Element {
  const ct = headers.match(/^content-type:\s*([^\r\n;]+)/im)?.[1]?.toLowerCase().trim() ?? ''
  if (ct.includes('html')) {
    return <iframe sandbox="" srcDoc={body} title="Render" className="h-full w-full bg-white" />
  }
  if (ct.includes('svg')) {
    return <iframe sandbox="" srcDoc={body} title="SVG render" className="h-full w-full bg-white" />
  }
  if (ct.startsWith('image/')) {
    const dataUrl = `data:${ct};base64,${tryBase64(body)}`
    return (
      <div className="flex h-full w-full items-center justify-center bg-black/50">
        <img src={dataUrl} alt="response" className="max-h-full max-w-full" />
      </div>
    )
  }
  return <Monaco language={languageForBody(headers, body)} value={tryPretty(headers, body)} readOnly />
}

function tryBase64(s: string): string {
  try {
    return btoa(s)
  } catch {
    return ''
  }
}

function extensionForContentType(contentType: string | null): string {
  if (!contentType) return '.txt'
  if (contentType.includes('json')) return '.json'
  if (contentType.includes('html')) return '.html'
  if (contentType.includes('xml')) return '.xml'
  if (contentType.includes('javascript')) return '.js'
  if (contentType.includes('css')) return '.css'
  if (contentType.includes('svg')) return '.svg'
  return '.txt'
}

function languageForBody(headers: string, body: string): string {
  const ct = headers.match(/^content-type:\s*([^\r\n;]+)/im)?.[1]?.toLowerCase().trim()
  if (ct) {
    if (ct.includes('json')) return 'json'
    if (ct.includes('xml')) return 'xml'
    if (ct.includes('html')) return 'html'
    if (ct.includes('javascript')) return 'javascript'
  }
  const trimmed = body.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json'
  if (trimmed.startsWith('<')) return 'xml'
  return 'plaintext'
}

function tryPretty(headers: string, body: string): string {
  const ct = headers.match(/^content-type:\s*([^\r\n;]+)/im)?.[1]?.toLowerCase().trim() ?? ''
  if (ct.includes('json')) {
    try {
      return JSON.stringify(JSON.parse(body), null, 2)
    } catch {
      // Keep the original text.
    }
  }
  return body
}
