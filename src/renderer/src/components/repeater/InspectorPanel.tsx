import { ChevronDown, ChevronRight, Copy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { RepeaterTab } from '@shared/types'
import { cn } from '@/lib/utils'
import {
  parseFormBody,
  parseHeaders,
  parseQuery,
  parseRequestCookies,
  parseSetCookies,
  type KvRow,
  type SetCookieRow
} from './parse'

interface InspectorProps {
  tab: RepeaterTab
  /** Override the response when viewing a past snapshot. */
  responseOverride?: RepeaterTab['lastResponse']
}

/**
 * Request/response inspector. Lives in a collapsible right
 * column and renders parsed tables for everything the user usually
 * mutates: query params, headers, cookies, body form params (request)
 * and headers, set-cookies (response).
 *
 * Each section is its own accordion item — that keeps the panel
 * scannable when the user is looking for "what cookies just came back?"
 * rather than scrolling through a single long pane.
 */
export function InspectorPanel({ tab, responseOverride }: InspectorProps): JSX.Element {
  const headers = useMemo(() => parseHeaders(tab.headers), [tab.headers])
  const query = useMemo(() => parseQuery(tab.url), [tab.url])
  const cookies = useMemo(() => parseRequestCookies(headers), [headers])
  const formBody = useMemo(() => {
    const ct = headers.find((h) => h.name.toLowerCase() === 'content-type')?.value ?? ''
    if (!ct.toLowerCase().includes('x-www-form-urlencoded')) return []
    return parseFormBody(tab.body)
  }, [headers, tab.body])

  const response = responseOverride !== undefined ? responseOverride : tab.lastResponse
  const respHeaders = useMemo(() => parseHeaders(response?.headers ?? ''), [response?.headers])
  const setCookies = useMemo(() => parseSetCookies(respHeaders), [respHeaders])

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface/30">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-surface/40 px-3 text-2xs uppercase tracking-wider text-muted-foreground">
        Inspector
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
        <Section title="Request query params" count={query.length}>
          <KvTable rows={query} emptyText="No ?key=value parameters in the URL." />
        </Section>
        <Section title="Request headers" count={headers.length}>
          <KvTable rows={headers} emptyText="No headers." />
        </Section>
        <Section title="Request cookies" count={cookies.length}>
          <KvTable rows={cookies} emptyText="No Cookie header." />
        </Section>
        {formBody.length > 0 && (
          <Section title="Body params" count={formBody.length} defaultOpen>
            <KvTable rows={formBody} emptyText="No form-encoded fields." />
          </Section>
        )}
        <div className="my-2 border-t border-border/60" />
        <Section title="Response headers" count={respHeaders.length}>
          {response ? (
            <KvTable rows={respHeaders} emptyText="(empty)" />
          ) : (
            <Empty text="No response yet." />
          )}
        </Section>
        <Section title="Set-Cookie" count={setCookies.length}>
          {setCookies.length === 0 ? (
            <Empty text="Server did not set any cookies." />
          ) : (
            <SetCookieTable rows={setCookies} />
          )}
        </Section>
      </div>
    </div>
  )
}

function Section({
  title,
  count,
  children,
  defaultOpen = true
}: {
  title: string
  count: number
  children: React.ReactNode
  defaultOpen?: boolean
}): JSX.Element {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="mb-2 rounded-md border border-border bg-surface/40">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-7 w-full items-center gap-2 px-2 text-2xs"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        )}
        <span className="font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground/80">{count}</span>
      </button>
      {open && <div className="border-t border-border/60 px-1.5 py-1">{children}</div>}
    </div>
  )
}

function KvTable({ rows, emptyText }: { rows: KvRow[]; emptyText: string }): JSX.Element {
  if (rows.length === 0) return <Empty text={emptyText} />
  return (
    <table className="w-full text-2xs">
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.name}-${i}`} className="group">
            <td className="w-28 truncate align-top py-1 pr-2 font-mono text-muted-foreground">
              {r.name}
            </td>
            <td className="break-all py-1 pr-2 font-mono text-foreground">{r.value || '—'}</td>
            <td className="w-6 py-1">
              <CopyBtn text={`${r.name}: ${r.value}`} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function SetCookieTable({ rows }: { rows: SetCookieRow[] }): JSX.Element {
  return (
    <table className="w-full text-2xs">
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.name}-${i}`} className="border-b border-border/40 last:border-b-0">
            <td className="w-28 truncate align-top py-1 pr-2 font-mono text-muted-foreground">
              {r.name}
            </td>
            <td className="py-1 pr-2">
              <div className="break-all font-mono text-foreground">{r.value}</div>
              {r.attributes && (
                <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                  {r.attributes}
                </div>
              )}
            </td>
            <td className="w-6 py-1">
              <CopyBtn text={`${r.name}=${r.value}${r.attributes ? '; ' + r.attributes : ''}`} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Empty({ text }: { text: string }): JSX.Element {
  return <div className="px-1 py-1 text-[11px] italic text-muted-foreground">{text}</div>
}

function CopyBtn({ text }: { text: string }): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text)
        toast.success('Copied', { duration: 1000 })
      }}
      className={cn(
        'rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-surface-raised hover:text-foreground group-hover:opacity-100'
      )}
      aria-label="Copy"
    >
      <Copy className="h-2.5 w-2.5" />
    </button>
  )
}
