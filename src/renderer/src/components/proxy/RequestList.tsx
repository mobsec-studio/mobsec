import { useMemo } from 'react'
import { Loader2, LockKeyhole } from 'lucide-react'
import type { CapturedRequest } from '@shared/types'
import { useProxyStore, type ProxyFilters } from '@/stores/useProxyStore'
import { cn, formatBytes, formatDuration } from '@/lib/utils'
import { methodTone, statusTone } from './methodColor'
import { classifyRequest, requestSignals } from './requestIntel'

function matchFilters(req: CapturedRequest, f: ProxyFilters): boolean {
  if (f.scheme !== 'all' && req.scheme !== f.scheme) return false
  if (f.method !== 'all' && req.method.toUpperCase() !== f.method.toUpperCase()) return false
  if (f.resource !== 'all' && classifyRequest(req) !== f.resource) return false
  if (f.signal !== 'all') {
    const signals = requestSignals(req)
    if (f.signal === 'interesting' && signals.length === 0) return false
    if (f.signal === 'auth' && !signals.some((s) => s.kind === 'auth')) return false
    if (f.signal === 'cookies' && !signals.some((s) => s.kind === 'cookies')) return false
    if (f.signal === 'errors' && !signals.some((s) => s.kind === 'error')) return false
  }
  if (f.statusClass !== 'all') {
    if (f.statusClass === 'pending') {
      if (req.status !== null) return false
    } else {
      const c = req.status
      if (c === null) return false
      const expected = parseInt(f.statusClass[0]!, 10)
      if (Math.floor(c / 100) !== expected) return false
    }
  }
  if (f.search.trim()) {
    const needle = f.search.toLowerCase()
    const hay = `${req.host} ${req.path} ${req.url} ${req.method}`.toLowerCase()
    if (!hay.includes(needle)) return false
  }
  return true
}

export function RequestList(): JSX.Element {
  const requests = useProxyStore((s) => s.requests)
  const filters = useProxyStore((s) => s.filters)
  const selectedId = useProxyStore((s) => s.selectedRequestId)
  const select = useProxyStore((s) => s.selectRequest)

  const filtered = useMemo(() => requests.filter((r) => matchFilters(r, filters)), [
    requests,
    filters
  ])
  const ordinalById = useMemo(() => {
    const out = new Map<string, number>()
    requests.forEach((req, i) => out.set(req.id, requests.length - i))
    return out
  }, [requests])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid h-7 shrink-0 min-w-[760px] grid-cols-[3rem_4rem_minmax(8rem,1fr)_minmax(10rem,1.5fr)_4rem_5rem_5rem_4rem] items-center gap-2 border-b border-border bg-surface/50 px-3 font-mono text-2xs uppercase tracking-wider text-muted-foreground">
        <span>#</span>
        <span>Method</span>
        <span>Host</span>
        <span>Path</span>
        <span className="text-right">Status</span>
        <span>Kind</span>
        <span className="text-right">Size</span>
        <span className="text-right">Time</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            {requests.length === 0
              ? 'No captured requests yet. Start the proxy, then use an app.'
              : 'No requests match the current filters.'}
          </div>
        ) : (
          filtered.map((req) => {
            const kind = classifyRequest(req)
            const signals = requestSignals(req).slice(0, 2)
            return (
              <button
                key={req.id}
                type="button"
                onClick={() => select(req.id)}
                className={cn(
                  'grid min-w-[760px] w-full grid-cols-[3rem_4rem_minmax(8rem,1fr)_minmax(10rem,1.5fr)_4rem_5rem_5rem_4rem] items-center gap-2 border-b border-border/30 px-3 py-1.5 text-left font-mono text-2xs transition-colors hover:bg-surface-raised/60',
                  selectedId === req.id && 'bg-surface-raised'
                )}
              >
                <span className="text-muted-foreground">{ordinalById.get(req.id) ?? '-'}</span>
                <span className={cn('font-semibold', methodTone(req.method))}>
                  {req.method.toUpperCase()}
                </span>
                <span className="flex min-w-0 items-center gap-1 text-foreground/90">
                  {req.scheme === 'https' && (
                    <LockKeyhole className="h-3 w-3 shrink-0 text-success" />
                  )}
                  <span className="truncate">
                    {req.host}
                    {req.port && req.port !== (req.scheme === 'https' ? 443 : 80) ? `:${req.port}` : ''}
                  </span>
                </span>
                <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                  <span className="truncate">{req.path}</span>
                  {signals.map((signal) => (
                    <span
                      key={signal.kind}
                      className={cn('shrink-0 rounded border px-1 py-0.5 text-[9px]', signal.tone)}
                      title={signal.detail}
                    >
                      {signal.label}
                    </span>
                  ))}
                </span>
                <span className={cn('text-right font-semibold', statusTone(req.status))}>
                  {req.status === null ? (
                    <Loader2 className="ml-auto h-3 w-3 animate-spin" />
                  ) : (
                    req.status
                  )}
                </span>
                <span className="truncate text-muted-foreground" title={kind}>
                  {kind}
                </span>
                <span className="text-right text-muted-foreground">
                  {req.size > 0 ? formatBytes(req.size) : '-'}
                </span>
                <span className="text-right text-muted-foreground">
                  {req.durationMs !== null ? formatDuration(req.durationMs) : '-'}
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
