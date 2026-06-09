import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  ChevronDown,
  Copy,
  Crosshair,
  Eraser,
  Layers,
  Loader2,
  Pause,
  Play,
  ScrollText,
  Search,
  Square,
  X
} from 'lucide-react'
import { toast } from 'sonner'
import type { LogcatBuffer, LogcatLine, LogLevel } from '@shared/types'
import { useLogcatStore, type LogcatFilters } from '@/stores/useLogcatStore'
import { selectActiveDevice, useDeviceStore } from '@/stores/useDeviceStore'
import { Button } from '../ui/button'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../ui/dropdown-menu'

const ROW_H = 20
const OVERSCAN = 14
const ALL_LEVELS: LogLevel[] = ['V', 'D', 'I', 'W', 'E', 'F']
const ALL_BUFFERS: LogcatBuffer[] = ['main', 'system', 'crash', 'events', 'radio', 'kernel']
const LEVEL_NAME: Record<LogLevel, string> = {
  V: 'Verbose',
  D: 'Debug',
  I: 'Info',
  W: 'Warn',
  E: 'Error',
  F: 'Fatal'
}

function levelText(level: LogLevel): string {
  switch (level) {
    case 'E':
    case 'F':
      return 'text-destructive'
    case 'W':
      return 'text-warning'
    case 'I':
      return 'text-foreground/90'
    case 'D':
      return 'text-primary/90'
    default:
      return 'text-muted-foreground'
  }
}

function levelChip(level: LogLevel, active: boolean): string {
  const tone =
    level === 'E' || level === 'F'
      ? 'border-destructive/50 bg-destructive/15 text-destructive'
      : level === 'W'
        ? 'border-warning/50 bg-warning/15 text-warning'
        : level === 'I'
          ? 'border-success/40 bg-success/10 text-success'
          : level === 'D'
            ? 'border-primary/40 bg-primary/10 text-primary'
            : 'border-border bg-muted text-muted-foreground'
  return active ? tone : 'border-border text-muted-foreground/50'
}

function tokens(s: string): string[] {
  return s
    .split(/[\s,]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
}

interface Matcher {
  test: (line: LogcatLine) => boolean
  term: string
  regex: boolean
  caseSensitive: boolean
  invalidRegex: boolean
}

function buildMatcher(filters: LogcatFilters): Matcher {
  const { levels } = filters
  const inc = tokens(filters.tagInclude)
  const exc = tokens(filters.tagExclude)
  const q = filters.search.trim()
  const cs = filters.caseSensitive
  let re: RegExp | null = null
  let needle: string | null = null
  let invalidRegex = false
  if (q) {
    if (filters.regex) {
      try {
        re = new RegExp(q, cs ? '' : 'i')
      } catch {
        invalidRegex = true
      }
    } else {
      needle = cs ? q : q.toLowerCase()
    }
  }
  const test = (line: LogcatLine): boolean => {
    if (!levels[line.level]) return false
    if (inc.length || exc.length) {
      const tagLc = line.tag.toLowerCase()
      if (inc.length && !inc.some((t) => tagLc.includes(t))) return false
      if (exc.some((t) => tagLc.includes(t))) return false
    }
    if (re) return re.test(line.tag) || re.test(line.message)
    if (needle) {
      const hay = cs ? `${line.tag} ${line.message}` : `${line.tag} ${line.message}`.toLowerCase()
      return hay.includes(needle)
    }
    return true
  }
  return { test, term: q, regex: filters.regex, caseSensitive: cs, invalidRegex }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function Highlighted({ text, matcher }: { text: string; matcher: Matcher }): JSX.Element {
  if (!matcher.term) return <>{text}</>
  let re: RegExp
  try {
    re = new RegExp(
      matcher.regex ? matcher.term : escapeRegExp(matcher.term),
      matcher.caseSensitive ? 'g' : 'gi'
    )
  } catch {
    return <>{text}</>
  }
  const out: ReactNode[] = []
  let last = 0
  let key = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(
      <mark key={key++} className="rounded-[2px] bg-warning/40 text-foreground">
        {m[0]}
      </mark>
    )
    last = m.index + m[0].length
    if (m[0].length === 0) re.lastIndex++
  }
  if (last < text.length) out.push(text.slice(last))
  return <>{out}</>
}

function fmtTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number, w = 2): string => String(n).padStart(w, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

export function LogcatTab(): JSX.Element {
  const lines = useLogcatStore((s) => s.lines)
  const status = useLogcatStore((s) => s.status)
  const filters = useLogcatStore((s) => s.filters)
  const clearLines = useLogcatStore((s) => s.clearLines)
  const setStatus = useLogcatStore((s) => s.setStatus)
  const setFilters = useLogcatStore((s) => s.setFilters)
  const toggleLevel = useLogcatStore((s) => s.toggleLevel)
  const resetFilters = useLogcatStore((s) => s.resetFilters)
  const hydrate = useLogcatStore((s) => s.hydrate)
  const paused = useLogcatStore((s) => s.paused)
  const pausedCount = useLogcatStore((s) => s.pausedCount)
  const setPaused = useLogcatStore((s) => s.setPaused)

  const activeDevice = useDeviceStore(selectActiveDevice)
  const deviceOnline = !!activeDevice && activeDevice.state === 'online'

  // Draft capture options (applied on Start / changed while running).
  const [buffers, setBuffers] = useState<LogcatBuffer[]>(status.buffers)
  const [minLevel, setMinLevel] = useState<LogLevel>(status.minLevel)
  const [scopePkg, setScopePkg] = useState('')
  const [busy, setBusy] = useState(false)
  const [selectedSeq, setSelectedSeq] = useState<number | null>(null)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  // Keep draft options synced when the service reports a (re)start.
  useEffect(() => {
    setBuffers(status.buffers)
    setMinLevel(status.minLevel)
  }, [status.buffers, status.minLevel])

  const matcher = useMemo(() => buildMatcher(filters), [filters])
  const filtered = useMemo(() => lines.filter(matcher.test), [lines, matcher])

  const levelCounts = useMemo(() => {
    const c: Record<LogLevel, number> = { V: 0, D: 0, I: 0, W: 0, E: 0, F: 0 }
    for (const l of lines) c[l.level] += 1
    return c
  }, [lines])

  const selected = useMemo(
    () => (selectedSeq == null ? null : (lines.find((l) => l.seq === selectedSeq) ?? null)),
    [selectedSeq, lines]
  )

  // --- capture controls ---------------------------------------------------
  const applyStart = async (overrides?: { pid?: number | null }): Promise<void> => {
    setBusy(true)
    const res = await window.api.logcat.start({
      buffers,
      minLevel,
      pid: overrides?.pid !== undefined ? overrides.pid : status.pid,
      tail: 500
    })
    setBusy(false)
    if (res.ok) {
      setStatus(res.value)
      setPaused(false)
    } else {
      toast.error('Could not start logcat', { description: res.error })
    }
  }

  const stop = async (): Promise<void> => {
    setBusy(true)
    const res = await window.api.logcat.stop()
    setBusy(false)
    if (res.ok) {
      setStatus(res.value)
      setPaused(false)
    }
  }

  const clearAll = async (alsoDevice: boolean): Promise<void> => {
    clearLines()
    setSelectedSeq(null)
    if (alsoDevice) {
      const res = await window.api.logcat.clear()
      if (res.ok) toast.success('Device log buffers cleared')
      else toast.error('Clear failed', { description: res.error })
    }
  }

  const scopeToApp = async (): Promise<void> => {
    const pkg = scopePkg.trim()
    if (!pkg) return
    setBusy(true)
    const res = await window.api.logcat.resolvePid(pkg)
    setBusy(false)
    if (!res.ok) {
      toast.error('Could not resolve pid', { description: res.error })
      return
    }
    if (res.value == null) {
      toast.warning(`${pkg} isn't running`, { description: 'Launch it, then scope again.' })
      return
    }
    await applyStart({ pid: res.value })
    toast.success(`Scoped to ${pkg}`, { description: `pid ${res.value}` })
  }

  const clearScope = async (): Promise<void> => {
    setScopePkg('')
    await applyStart({ pid: null })
  }

  const toggleBuffer = (b: LogcatBuffer): void => {
    const next = buffers.includes(b) ? buffers.filter((x) => x !== b) : [...buffers, b]
    if (next.length === 0) return
    setBuffers(next)
    if (status.running) {
      void window.api.logcat
        .start({ buffers: next, minLevel, pid: status.pid, tail: 500 })
        .then((r) => r.ok && setStatus(r.value))
    }
  }

  const changeMinLevel = (lvl: LogLevel): void => {
    setMinLevel(lvl)
    if (status.running) {
      void window.api.logcat
        .start({ buffers, minLevel: lvl, pid: status.pid, tail: 500 })
        .then((r) => r.ok && setStatus(r.value))
    }
  }

  const copyVisible = async (): Promise<void> => {
    const text = filtered
      .map((l) => `${fmtTime(l.timestamp)} ${l.pid}-${l.tid} ${l.level} ${l.tag}: ${l.message}`)
      .join('\n')
    await navigator.clipboard.writeText(text)
    toast.success(`Copied ${filtered.length} line(s)`)
  }

  // --- virtualized list ---------------------------------------------------
  const listRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(0)
  const [follow, setFollow] = useState(true)
  const followRef = useRef(true)
  followRef.current = follow
  const newSinceUnfollowRef = useRef(0)
  const [newCount, setNewCount] = useState(0)
  const prevTotalRef = useRef(0)

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const syncViewport = (): void => {
      setViewportH(el.clientHeight)
      setScrollTop(el.scrollTop)
    }
    const ro = new ResizeObserver(syncViewport)
    ro.observe(el)
    syncViewport()
    return () => ro.disconnect()
  }, [])

  const total = filtered.length

  // Auto-scroll to the newest line while following; otherwise track how many
  // arrived so the "jump to latest" pill can show a count.
  useEffect(() => {
    const grew = total - prevTotalRef.current
    prevTotalRef.current = total
    if (followRef.current) {
      const el = listRef.current
      if (el) {
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight
          setScrollTop(el.scrollTop)
          setViewportH(el.clientHeight)
        })
      }
    } else if (grew > 0) {
      newSinceUnfollowRef.current += grew
      setNewCount(newSinceUnfollowRef.current)
    }
  }, [total])

  const onScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    const el = e.currentTarget
    setScrollTop(el.scrollTop)
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < ROW_H * 2
    if (atBottom && !followRef.current) {
      newSinceUnfollowRef.current = 0
      setNewCount(0)
    }
    if (atBottom !== followRef.current) setFollow(atBottom)
  }

  const jumpToLatest = (): void => {
    const el = listRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
      setScrollTop(el.scrollTop)
      setViewportH(el.clientHeight)
    }
    newSinceUnfollowRef.current = 0
    setNewCount(0)
    setFollow(true)
  }

  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN)
  const endIdx = Math.min(total, Math.ceil((scrollTop + viewportH) / ROW_H) + OVERSCAN)
  const visible = filtered.slice(startIdx, endIdx)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Row 1 — capture controls */}
      <header className="flex h-12 shrink-0 items-center gap-2 overflow-hidden border-b border-border bg-surface/30 px-4">
        <div className="flex min-w-0 items-center gap-2">
          <ScrollText className="h-4 w-4 shrink-0 text-primary" />
          <h1 className="shrink-0 text-sm font-semibold tracking-tight">Logcat</h1>
          {status.running ? (
            <span className="flex min-w-0 items-center gap-1.5 truncate font-mono text-2xs text-success">
              <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-success" />{' '}
              streaming
              {status.pid ? ` · pid ${status.pid}` : ''}
            </span>
          ) : (
            <span className="shrink-0 font-mono text-2xs text-muted-foreground">stopped</span>
          )}
          {status.serial && (
            <span className="min-w-0 truncate font-mono text-2xs text-muted-foreground/70">
              {status.serial}
            </span>
          )}
        </div>

        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1 overflow-x-auto overflow-y-hidden py-1">
          {status.running && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setPaused(!paused)}
                >
                  {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                  {paused ? 'Resume' : 'Pause'}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {paused ? 'Resume appending new lines' : 'Freeze the visible log view'}
              </TooltipContent>
            </Tooltip>
          )}
          {status.running ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={busy}
              onClick={() => void stop()}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}{' '}
              Stop
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!deviceOnline || busy}
                  onClick={() => void applyStart()}
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}{' '}
                  Start
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Stream logcat from the active device</TooltipContent>
            </Tooltip>
          )}

          {/* Buffers */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" disabled={busy}>
                <Layers className="h-3.5 w-3.5" /> Buffers
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Logcat buffers</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {ALL_BUFFERS.map((b) => (
                <DropdownMenuCheckboxItem
                  key={b}
                  checked={buffers.includes(b)}
                  onSelect={(e) => {
                    e.preventDefault()
                    toggleBuffer(b)
                  }}
                >
                  {b}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Device-side min level */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" disabled={busy}>
                Min: {minLevel}
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Capture floor (device-side)</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {ALL_LEVELS.map((l) => (
                <DropdownMenuItem key={l} onSelect={() => changeMinLevel(l)}>
                  <span className={cn('font-mono', l === minLevel && 'text-primary')}>{l}</span>
                  <span className="text-muted-foreground">{LEVEL_NAME[l]}+</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Scope to app */}
          {status.pid ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-primary"
              onClick={() => void clearScope()}
            >
              <Crosshair className="h-3.5 w-3.5" /> Scoped · clear
            </Button>
          ) : (
            <div className="flex items-center gap-1">
              <input
                value={scopePkg}
                onChange={(e) => setScopePkg(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void scopeToApp()
                }}
                placeholder="scope to package…"
                className="h-7 w-40 rounded-md border border-border bg-surface px-2 font-mono text-2xs text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary"
              />
              <Button
                size="sm"
                variant="ghost"
                disabled={!scopePkg.trim() || busy}
                onClick={() => void scopeToApp()}
              >
                <Crosshair className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost">
                <Eraser className="h-3.5 w-3.5" /> Clear
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => void clearAll(false)}>Clear view</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void clearAll(true)}>
                Clear view + device buffers
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Row 2 — filters */}
      <div className="flex min-h-11 shrink-0 flex-wrap items-center gap-2 border-b border-border bg-surface/20 px-4 py-1.5 text-2xs">
        <div className="flex items-center gap-1">
          {ALL_LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => toggleLevel(l)}
              aria-pressed={filters.levels[l]}
              title={LEVEL_NAME[l]}
              className={cn(
                'flex h-5 items-center gap-1 rounded-sm border px-1.5 font-mono uppercase tracking-wider transition-colors',
                levelChip(l, filters.levels[l])
              )}
            >
              {l}
              <span className="text-[9px] opacity-70">{levelCounts[l]}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <Search className="h-3 w-3 text-muted-foreground" />
          <input
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            placeholder="Search message + tag…"
            className={cn(
              'h-6 w-56 rounded-md border bg-surface px-2 font-mono text-2xs text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary',
              matcher.invalidRegex ? 'border-destructive' : 'border-border'
            )}
          />
          <FilterChip
            active={filters.regex}
            onClick={() => setFilters({ regex: !filters.regex })}
            label=".*"
            title="Regex"
          />
          <FilterChip
            active={filters.caseSensitive}
            onClick={() => setFilters({ caseSensitive: !filters.caseSensitive })}
            label="Aa"
            title="Case sensitive"
          />
        </div>

        <input
          value={filters.tagInclude}
          onChange={(e) => setFilters({ tagInclude: e.target.value })}
          placeholder="tag includes…"
          className="h-6 w-32 rounded-md border border-border bg-surface px-2 font-mono text-2xs text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary"
        />
        <input
          value={filters.tagExclude}
          onChange={(e) => setFilters({ tagExclude: e.target.value })}
          placeholder="tag excludes…"
          className="h-6 w-32 rounded-md border border-border bg-surface px-2 font-mono text-2xs text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary"
        />

        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono text-muted-foreground">
            {total === lines.length ? `${total}` : `${total}/${lines.length}`} lines
          </span>
          {paused && (
            <span className="rounded border border-warning/30 bg-warning/10 px-1.5 py-0.5 font-mono text-warning">
              paused{pausedCount > 0 ? ` +${pausedCount}` : ''}
            </span>
          )}
          <button
            type="button"
            onClick={() => resetFilters()}
            className="text-muted-foreground hover:text-foreground"
          >
            reset
          </button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2"
            disabled={filtered.length === 0}
            onClick={() => void copyVisible()}
          >
            <Copy className="h-3 w-3" /> Copy
          </Button>
        </div>
      </div>

      {status.errorMessage && (
        <div className="flex min-h-8 shrink-0 items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-1.5 text-2xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{status.errorMessage}</span>
        </div>
      )}

      {/* Body */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {!deviceOnline && lines.length === 0 ? (
          <Empty
            title="No device connected"
            body="Connect a phone or start the emulator, then press Start to stream logs."
          />
        ) : lines.length === 0 ? (
          <Empty
            title={status.running ? 'Waiting for output…' : 'Logcat is stopped'}
            body={
              status.running
                ? 'Logs will appear here as the device emits them.'
                : 'Press Start to stream the device log.'
            }
          />
        ) : (
          <>
            <div
              ref={listRef}
              onScroll={onScroll}
              className="absolute inset-0 min-h-0 overflow-auto font-mono text-2xs leading-[20px]"
            >
              <div style={{ height: total * ROW_H, position: 'relative' }}>
                {visible.map((line, i) => {
                  const idx = startIdx + i
                  const selectedRow = line.seq === selectedSeq
                  return (
                    <div
                      key={line.seq}
                      onClick={() => setSelectedSeq(selectedRow ? null : line.seq)}
                      style={{
                        position: 'absolute',
                        top: idx * ROW_H,
                        height: ROW_H,
                        left: 0,
                        right: 0
                      }}
                      className={cn(
                        'flex cursor-default items-center gap-2 whitespace-pre px-3 hover:bg-surface-raised/50',
                        selectedRow && 'bg-surface-raised',
                        line.level === 'F' && 'bg-destructive/5'
                      )}
                    >
                      <span className="shrink-0 text-muted-foreground/60">
                        {fmtTime(line.timestamp)}
                      </span>
                      <span className="w-[68px] shrink-0 text-right text-muted-foreground/50">
                        {line.pid > 0 ? `${line.pid}-${line.tid}` : ''}
                      </span>
                      <span
                        className={cn('w-3 shrink-0 text-center font-bold', levelText(line.level))}
                      >
                        {line.level}
                      </span>
                      <span className="w-40 shrink-0 truncate text-accent" title={line.tag}>
                        <Highlighted text={line.tag} matcher={matcher} />
                      </span>
                      <span className={cn('min-w-0 flex-1 truncate', levelText(line.level))}>
                        <Highlighted text={line.message} matcher={matcher} />
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {!follow && (
              <button
                type="button"
                onClick={jumpToLatest}
                className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-primary/40 bg-surface-overlay px-3 py-1 text-2xs text-primary shadow-lg backdrop-blur hover:bg-primary/10"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                {newCount > 0 ? `${newCount} new — jump to latest` : 'Jump to latest'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Selected-line detail */}
      {selected && (
        <div className="flex max-h-40 shrink-0 flex-col border-t border-border bg-surface/40">
          <div className="flex h-7 shrink-0 items-center gap-2 border-b border-border px-3 text-2xs">
            <span className={cn('font-mono font-bold', levelText(selected.level))}>
              {selected.level}
            </span>
            <span className="font-mono text-accent">{selected.tag}</span>
            <span className="font-mono text-muted-foreground/60">
              {fmtTime(selected.timestamp)} · pid {selected.pid} · tid {selected.tid}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-5 px-2"
                onClick={() => void navigator.clipboard.writeText(selected.message)}
              >
                <Copy className="h-3 w-3" /> Copy
              </Button>
              <button
                type="button"
                onClick={() => setSelectedSeq(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-all px-3 py-2 font-mono text-2xs text-foreground/90">
            {selected.message}
          </div>
        </div>
      )}
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  label,
  title
}: {
  active: boolean
  onClick: () => void
  label: string
  title: string
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        'h-6 rounded-md border px-1.5 font-mono text-2xs transition-colors',
        active
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-border text-muted-foreground/60'
      )}
    >
      {label}
    </button>
  )
}

function Empty({ title, body }: { title: string; body: string }): JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
      <ScrollText className="h-8 w-8 opacity-40" />
      <p className="text-sm font-medium text-foreground/80">{title}</p>
      <p className="max-w-sm text-xs">{body}</p>
    </div>
  )
}
