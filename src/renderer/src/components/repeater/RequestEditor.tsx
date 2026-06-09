import Editor from '@monaco-editor/react'
import { useMemo, useRef, useState } from 'react'
import type { RepeaterTab } from '@shared/types'
import { cn } from '@/lib/utils'
import { useResolvedTheme } from '@/stores/useThemeStore'
import { methodTone } from '../proxy/methodColor'
import { toHexDump, toRawRequest } from './parse'

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE'] as const

type RequestView = 'pretty' | 'raw' | 'hex'

interface RequestEditorProps {
  tab: RepeaterTab
  onChange: (patch: Partial<RepeaterTab>) => void
  /** When viewing a past history snapshot, the editor goes read-only and
   *  reflects the snapshot's fields instead of the live draft. */
  readOnly?: boolean
  /** When `readOnly` is true, these fields override `tab.*` for rendering. */
  snapshot?: { method: string; url: string; headers: string; body: string }
  /** Wires Cmd/Ctrl+Enter inside any Monaco pane to fire a Send. */
  onSubmit?: () => void
}

export function RequestEditor({
  tab,
  onChange,
  readOnly = false,
  snapshot,
  onSubmit
}: RequestEditorProps): JSX.Element {
  const [view, setView] = useState<RequestView>('pretty')
  const [pane, setPane] = useState<'headers' | 'body'>('body')

  const displayMethod = snapshot?.method ?? tab.method
  const displayUrl = snapshot?.url ?? tab.url
  const displayHeaders = snapshot?.headers ?? tab.headers
  const displayBody = snapshot?.body ?? tab.body

  // Auto-detect a language from Content-Type for body syntax highlighting.
  const language = bodyLanguageFor(displayHeaders, displayBody)

  // Raw / Hex views are computed display strings derived from the four
  // editable fields. A true editable Raw mode means parsing the wire
  // format back into fields on every keystroke — out of scope for v1.
  // The user edits in Pretty and sees the wire-format mirror in Raw/Hex.
  const rawWire = useMemo(
    () =>
      toRawRequest({
        method: displayMethod,
        url: displayUrl,
        headers: displayHeaders,
        body: displayBody
      }),
    [displayMethod, displayUrl, displayHeaders, displayBody]
  )
  const hexDump = useMemo(() => toHexDump(rawWire), [rawWire])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-surface/30 px-3">
        <span
          className={cn(
            'inline-flex h-6 items-center rounded-md border border-border bg-surface-raised px-2 font-mono text-2xs font-semibold',
            methodTone(displayMethod)
          )}
        >
          {displayMethod.toUpperCase()}
        </span>
        <select
          value={displayMethod.toUpperCase()}
          onChange={(e) => onChange({ method: e.target.value })}
          disabled={readOnly}
          className="h-6 rounded-md border border-border bg-surface px-1.5 font-mono text-2xs text-foreground outline-none focus:border-primary disabled:opacity-60"
          aria-label="HTTP method"
        >
          {METHODS.map((m) => (
            <option key={m} value={m} className="bg-background">
              {m}
            </option>
          ))}
          {!METHODS.includes(displayMethod.toUpperCase() as (typeof METHODS)[number]) && (
            <option value={displayMethod.toUpperCase()} className="bg-background">
              {displayMethod.toUpperCase()}
            </option>
          )}
        </select>
        <input
          value={displayUrl}
          onChange={(e) => onChange({ url: e.target.value })}
          placeholder="https://target.example/path"
          spellCheck={false}
          readOnly={readOnly}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              onSubmit?.()
            }
          }}
          className="h-7 flex-1 rounded-md border border-border bg-surface/60 px-2.5 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary read-only:opacity-80"
        />
      </div>
      <div className="flex h-7 shrink-0 items-center justify-between gap-1 border-b border-border bg-surface/20 px-3">
        <div className="flex items-center gap-1">
          <PaneButton active={view === 'pretty'} onClick={() => setView('pretty')}>
            Pretty
          </PaneButton>
          <PaneButton active={view === 'raw'} onClick={() => setView('raw')}>
            Raw
          </PaneButton>
          <PaneButton active={view === 'hex'} onClick={() => setView('hex')}>
            Hex
          </PaneButton>
        </div>
        {view === 'pretty' && (
          <div className="flex items-center gap-1">
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
        {view === 'pretty' ? (
          pane === 'headers' ? (
            <MonacoBox
              language="ini"
              value={displayHeaders}
              onChange={(v) => onChange({ headers: v })}
              placeholder="Header-Name: value (one per line)"
              readOnly={readOnly}
              onSubmit={onSubmit}
            />
          ) : (
            <MonacoBox
              language={language}
              value={displayBody}
              onChange={(v) => onChange({ body: v })}
              placeholder="Request body"
              readOnly={readOnly}
              onSubmit={onSubmit}
            />
          )
        ) : view === 'raw' ? (
          // Raw view: full HTTP wire-format string. Read-only mirror of
          // the editable fields above. Useful for copy/paste workflows;
          // toggle back to Pretty to make edits.
          <MonacoBox language="http" value={rawWire} onChange={() => undefined} readOnly />
        ) : (
          <MonacoBox language="plaintext" value={hexDump} onChange={() => undefined} readOnly />
        )}
      </div>
    </div>
  )
}

interface MonacoBoxProps {
  language: string
  value: string
  onChange: (next: string) => void
  placeholder?: string
  readOnly?: boolean
  onSubmit?: () => void
}

function MonacoBox({
  language,
  value,
  onChange,
  placeholder,
  readOnly = false,
  onSubmit
}: MonacoBoxProps): JSX.Element {
  // Track the latest applied prop value synchronously. Monaco's React
  // adapter sometimes propagates `onChange` events that originate from
  // a programmatic `setValue` (e.g. when the controlled `value` prop
  // changes during a Pretty→Raw view switch). Without this ref-based
  // guard, that spurious event writes the OLD model content (the wire-
  // format string) into the new bound field (the body), and every
  // subsequent view toggle compounds the leak — that was the
  // "content doubles each time I click Pretty / Raw" bug.
  const lastValueRef = useRef(value ?? '')
  if (lastValueRef.current !== (value ?? '')) {
    lastValueRef.current = value ?? ''
  }
  const editorTheme = useResolvedTheme() === 'dark' ? 'vs-dark' : 'vs'
  return (
    <Editor
      language={language}
      value={value || ''}
      onChange={(v) => {
        const next = v ?? ''
        // Programmatic update echo: the new value equals what we just
        // pushed via the prop. Skip — the parent state is already correct.
        if (next === lastValueRef.current) return
        lastValueRef.current = next
        onChange(next)
      }}
      theme={editorTheme}
      onMount={(editor, monaco) => {
        if (!onSubmit) return
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
          onSubmit()
        })
      }}
      options={{
        readOnly,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        renderLineHighlight: 'none',
        lineNumbers: 'on',
        wordWrap: 'on',
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 12,
        scrollbar: { vertical: 'auto', horizontal: 'auto' },
        padding: { top: 8, bottom: 8 },
        contextmenu: false,
        placeholder
      }}
    />
  )
}

function PaneButton({
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
        'h-5 rounded-md px-2 font-mono text-2xs uppercase tracking-wider transition-colors',
        active
          ? 'bg-surface-raised text-foreground'
          : 'text-muted-foreground hover:bg-surface-raised/60 hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}

function bodyLanguageFor(headers: string, body: string): string {
  const ct = headers.match(/^content-type:\s*([^\r\n;]+)/im)?.[1]?.toLowerCase().trim()
  if (ct) {
    if (ct.includes('json')) return 'json'
    if (ct.includes('xml')) return 'xml'
    if (ct.includes('html')) return 'html'
    if (ct.includes('javascript')) return 'javascript'
    if (ct.includes('form-urlencoded')) return 'ini'
    if (ct.includes('text/plain')) return 'plaintext'
  }
  const trimmed = body.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json'
  if (trimmed.startsWith('<')) return 'xml'
  return 'plaintext'
}
