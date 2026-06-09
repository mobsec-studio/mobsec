import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Copy, Eraser, Pause, Play, Search, Crosshair } from 'lucide-react'
import type { AgentChannel } from '@shared/frida-intel'
import type { LiveEvent } from '@/stores/useFridaStore'
import { Button } from '../../ui/button'
import { cn } from '@/lib/utils'

interface Props {
  events: LiveEvent[]
  paused: boolean
  pausedCount: number
  onTogglePause: () => void
  onClear: () => void
  /** Trace the class behind an event (method/crypto rows expose one). */
  onTraceClass?: (className: string) => void
}

const CHANNEL_TONE: Partial<Record<AgentChannel, string>> = {
  crypto: 'bg-warning/15 text-warning',
  storage: 'bg-primary/15 text-primary',
  network: 'bg-success/15 text-success',
  ipc: 'bg-secondary text-secondary-foreground',
  trace: 'bg-muted text-muted-foreground',
  jni: 'bg-destructive/15 text-destructive'
}

function classFromMeta(meta?: Record<string, string>): string | null {
  if (!meta) return null
  return meta.class ?? null
}

export function LiveEventsPanel({
  events,
  paused,
  pausedCount,
  onTogglePause,
  onClear,
  onTraceClass
}: Props): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null)
  const [search, setSearch] = useState('')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<number | null>(null)

  const channelsPresent = useMemo(() => {
    const set = new Set<string>()
    for (const e of events) set.add(e.channel)
    return Array.from(set).sort()
  }, [events])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return events.filter((e) => {
      if (hidden.has(e.channel)) return false
      if (!q) return true
      return (
        e.summary.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        (e.detail?.toLowerCase().includes(q) ?? false) ||
        (e.meta ? Object.values(e.meta).some((v) => v.toLowerCase().includes(q)) : false)
      )
    })
  }, [events, search, hidden])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Stick to the bottom only when already near it, so reviewing scrollback
    // isn't interrupted by the live stream.
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (nearBottom) el.scrollTop = el.scrollHeight
  }, [filtered.length])

  const toggleChannel = (c: string): void =>
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex h-8 shrink-0 flex-wrap items-center gap-2 border-b border-border bg-surface/30 px-3 text-2xs">
        <span className="font-mono uppercase tracking-wider text-muted-foreground">
          Live events
        </span>
        <span className="font-mono text-foreground/60">
          {filtered.length === events.length
            ? `(${events.length})`
            : `(${filtered.length}/${events.length})`}
        </span>
        <div className="flex items-center gap-1">
          {channelsPresent.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggleChannel(c)}
              aria-pressed={!hidden.has(c)}
              className={cn(
                'h-4 rounded-sm border px-1 font-mono text-[10px] lowercase tracking-wider transition-colors',
                hidden.has(c)
                  ? 'border-border text-muted-foreground/50'
                  : 'border-transparent ' +
                      (CHANNEL_TONE[c as AgentChannel] ?? 'bg-muted text-foreground')
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="ml-1 flex items-center gap-1">
          <Search className="h-3 w-3 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter events…"
            className="h-5 w-44 rounded-md border border-border bg-surface px-2 font-mono text-2xs text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary"
          />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className={cn('h-5 px-2', paused && 'text-warning')}
            onClick={onTogglePause}
          >
            {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            {paused ? `Resume${pausedCount > 0 ? ` (+${pausedCount})` : ''}` : 'Pause'}
          </Button>
          <Button size="sm" variant="ghost" className="h-5 px-2" onClick={onClear}>
            <Eraser className="h-3 w-3" /> Clear
          </Button>
        </div>
      </div>

      <div ref={ref} className="min-h-0 flex-1 overflow-auto font-mono text-2xs">
        {events.length === 0 ? (
          <div className="px-3 py-3 leading-relaxed text-muted-foreground">
            Live app activity appears here the instant it happens — turn on monitors (crypto,
            storage, network, IPC) or trace a class in the{' '}
            <span className="text-foreground">Trace</span> tab.
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-3 italic text-muted-foreground">No events match the filter.</div>
        ) : (
          filtered.map((e) => {
            const open = expanded === e.id
            const cls = classFromMeta(e.meta)
            return (
              <div key={e.id} className="border-b border-border/30">
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : e.id)}
                  className="flex w-full items-start gap-2 px-3 py-1 text-left transition-colors hover:bg-surface-raised/50"
                >
                  <ChevronRight
                    className={cn(
                      'mt-0.5 h-3 w-3 shrink-0 text-muted-foreground transition-transform',
                      open && 'rotate-90'
                    )}
                  />
                  <span className="shrink-0 text-muted-foreground/60">
                    {new Date(e.ts).toLocaleTimeString()}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 rounded-sm px-1 text-[10px] lowercase',
                      CHANNEL_TONE[e.channel] ?? 'bg-muted text-foreground'
                    )}
                  >
                    {e.channel}
                  </span>
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate',
                      e.severity === 'error'
                        ? 'text-destructive'
                        : e.severity === 'warn'
                          ? 'text-warning'
                          : 'text-foreground/90'
                    )}
                  >
                    {e.summary}
                  </span>
                </button>
                {open && (
                  <div className="space-y-1 border-t border-border/30 bg-surface/20 px-8 py-2">
                    {e.detail && (
                      <div className="whitespace-pre-wrap break-all text-foreground/80">
                        {e.detail}
                      </div>
                    )}
                    {e.meta &&
                      Object.entries(e.meta).map(([k, v]) => (
                        <div key={k} className="flex items-start gap-2">
                          <span className="w-24 shrink-0 text-muted-foreground">{k}</span>
                          <span className="min-w-0 flex-1 whitespace-pre-wrap break-all text-foreground/90">
                            {v}
                          </span>
                          <button
                            type="button"
                            onClick={() => void navigator.clipboard.writeText(v)}
                            className="shrink-0 text-muted-foreground hover:text-foreground"
                            aria-label="Copy value"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    {cls && onTraceClass && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 px-2 text-2xs text-primary"
                        onClick={() => onTraceClass(cls)}
                      >
                        <Crosshair className="h-3 w-3" /> Trace {cls.split('.').pop()}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
