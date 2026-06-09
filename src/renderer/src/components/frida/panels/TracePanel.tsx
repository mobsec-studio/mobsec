import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Activity,
  Boxes,
  ChevronRight,
  Cpu,
  Database,
  KeyRound,
  Loader2,
  Network,
  Radio,
  Search
} from 'lucide-react'
import type { ActiveTrace, ClassMethodInfo, HeapInstance, TracerInfo } from '@shared/frida-intel'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { cn } from '@/lib/utils'

interface Props {
  sessionId: string | null
}

const MONITOR_ICON: Record<string, typeof Activity> = {
  crypto: KeyRound,
  storage: Database,
  network: Network,
  ipc: Radio
}

export function TracePanel({ sessionId }: Props): JSX.Element {
  const [tracers, setTracers] = useState<TracerInfo[]>([])
  const [active, setActive] = useState<ActiveTrace[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [classes, setClasses] = useState<string[]>([])
  const [classTotal, setClassTotal] = useState(0)
  const [searching, setSearching] = useState(false)
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const [methods, setMethods] = useState<ClassMethodInfo | null>(null)

  const [heapClass, setHeapClass] = useState('')
  const [instances, setInstances] = useState<HeapInstance[] | null>(null)
  const [heapBusy, setHeapBusy] = useState(false)

  const [nativeModule, setNativeModule] = useState('')
  const [nativeSymbol, setNativeSymbol] = useState('')

  const refresh = async (sid: string): Promise<void> => {
    const [t, a] = await Promise.all([
      window.api.frida.listTracers(sid),
      window.api.frida.listActiveTraces(sid)
    ])
    if (t.ok) setTracers(t.value)
    if (a.ok) setActive(a.value)
  }

  useEffect(() => {
    if (sessionId) void refresh(sessionId)
  }, [sessionId])

  if (!sessionId) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="max-w-md rounded-lg border border-border bg-surface/40 p-5 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
            <Activity className="h-4 w-4" />
          </div>
          <div className="mt-3 text-sm font-medium text-foreground">Trace agent not loaded</div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Run <span className="font-medium text-foreground">Recon</span> or{' '}
            <span className="font-medium text-foreground">Auto-Pwn</span> first. Then class,
            monitor, heap, and native traces can stream results into{' '}
            <span className="font-medium text-foreground">Live events</span>.
          </p>
        </div>
      </div>
    )
  }
  const sid = sessionId

  const toggleMonitor = async (t: TracerInfo): Promise<void> => {
    setBusyId(t.id)
    const res = t.active
      ? await window.api.frida.stopTracer(sid, t.id)
      : await window.api.frida.startTracer(sid, t.id)
    setBusyId(null)
    if (res.ok) {
      setTracers(res.value)
      void refresh(sid)
    } else toast.error('Monitor toggle failed', { description: res.error })
  }

  const searchClasses = async (): Promise<void> => {
    if (!query.trim()) return
    setSearching(true)
    const res = await window.api.frida.enumerateClasses(sid, query.trim(), 200)
    setSearching(false)
    if (res.ok) {
      setClasses(res.value.classes)
      setClassTotal(res.value.total)
    } else toast.error('Class search failed', { description: res.error })
  }

  const pickClass = async (cls: string): Promise<void> => {
    setSelectedClass(cls)
    setMethods(null)
    const res = await window.api.frida.listMethods(sid, cls)
    if (res.ok) setMethods(res.value)
    else toast.error('Could not list methods', { description: res.error })
  }

  const traceSelected = async (): Promise<void> => {
    if (!selectedClass) return
    const res = await window.api.frida.traceClass(sid, selectedClass)
    if (res.ok) {
      toast.success(`Tracing ${selectedClass}`, {
        description: `${res.value.hooked} overload(s) - output on the [trace] channel`
      })
      void refresh(sid)
    } else toast.error('Trace failed', { description: res.error })
  }

  const stopTrace = async (t: ActiveTrace): Promise<void> => {
    let ok = false
    let error = ''
    if (t.kind === 'monitor') {
      const res = await window.api.frida.stopTracer(sid, t.id)
      ok = res.ok
      error = res.ok ? '' : res.error
    } else if (t.kind === 'class') {
      const res = await window.api.frida.untraceClass(sid, t.id)
      ok = res.ok
      error = res.ok ? '' : res.error
    } else {
      const idx = t.id.lastIndexOf('!')
      const mod = idx > 0 && t.id.slice(0, idx) !== '*' ? t.id.slice(0, idx) : ''
      const sym = idx >= 0 ? t.id.slice(idx + 1) : t.id
      const res = await window.api.frida.untraceNative(sid, mod, sym)
      ok = res.ok
      error = res.ok ? '' : res.error
    }
    if (ok) void refresh(sid)
    else toast.error('Stop trace failed', { description: error })
  }

  const snapshotHeap = async (): Promise<void> => {
    if (!heapClass.trim()) return
    setHeapBusy(true)
    const res = await window.api.frida.chooseInstances(sid, heapClass.trim(), 10)
    setHeapBusy(false)
    if (res.ok) setInstances(res.value)
    else toast.error('Heap snapshot failed', { description: res.error })
  }

  const traceNative = async (): Promise<void> => {
    if (!nativeSymbol.trim()) return
    const res = await window.api.frida.traceNative(sid, nativeModule.trim(), nativeSymbol.trim())
    if (res.ok && res.value.ok) {
      toast.success(`Tracing native ${nativeSymbol}`)
      void refresh(sid)
    } else {
      toast.error('Native trace failed', {
        description: res.ok ? 'Symbol not found / not exported' : res.error
      })
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-surface/30 px-3">
        <Activity className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium">Trace &amp; discover</span>
        <span className="ml-auto text-2xs text-muted-foreground">
          output - <span className="text-foreground">Live events</span>
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-auto px-4 py-3">
        {/* Monitors */}
        <section>
          <SectionHead icon={Radio} title="Live monitors" />
          <div className="flex flex-wrap gap-2">
            {tracers.map((t) => {
              const Icon = MONITOR_ICON[t.id] ?? Activity
              return (
                <button
                  key={t.id}
                  type="button"
                  title={t.description}
                  disabled={busyId === t.id}
                  onClick={() => void toggleMonitor(t)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors',
                    t.active
                      ? 'border-success/50 bg-success/10 text-success'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  {busyId === t.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                  {t.label}
                  {t.active && <span className="text-2xs">active</span>}
                </button>
              )
            })}
            {tracers.length === 0 && (
              <span className="text-2xs text-muted-foreground">Loading...</span>
            )}
          </div>
        </section>

        {active.length > 0 && (
          <section>
            <SectionHead icon={Activity} title="Active traces" count={active.length} />
            <div className="space-y-1">
              {active.map((t) => (
                <div
                  key={`${t.kind}:${t.id}`}
                  className="flex items-center gap-2 rounded-md border border-border/60 bg-surface/30 px-2.5 py-1.5"
                >
                  <Badge variant="muted">{t.kind}</Badge>
                  <span className="min-w-0 flex-1 truncate font-mono text-2xs text-foreground">
                    {t.label}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-2xs text-destructive hover:text-destructive"
                    onClick={() => void stopTrace(t)}
                  >
                    Stop
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Class explorer */}
        <section>
          <SectionHead icon={Boxes} title="Class explorer" />
          <div className="flex gap-2">
            <div className="flex h-8 flex-1 items-center gap-2 rounded-md border border-border bg-surface px-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void searchClasses()
                }}
                placeholder="Search loaded classes..."
                className="h-7 flex-1 bg-transparent font-mono text-2xs text-foreground outline-none placeholder:text-muted-foreground/60"
              />
            </div>
            <Button size="sm" variant="outline" onClick={() => void searchClasses()}>
              {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Search'}
            </Button>
          </div>
          {classes.length > 0 && (
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              <div className="max-h-52 overflow-auto rounded-md border border-border/60">
                <div className="sticky top-0 border-b border-border bg-surface/60 px-2 py-1 text-2xs text-muted-foreground backdrop-blur">
                  {classTotal} match{classTotal === 1 ? '' : 'es'}
                  {classTotal > classes.length ? ` (showing ${classes.length})` : ''}
                </div>
                {classes.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => void pickClass(c)}
                    className={cn(
                      'flex w-full items-center gap-1 border-b border-border/30 px-2 py-1 text-left font-mono text-2xs transition-colors hover:bg-surface-raised/60',
                      selectedClass === c && 'bg-surface-raised text-foreground'
                    )}
                  >
                    <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="truncate">{c}</span>
                  </button>
                ))}
              </div>
              <div className="max-h-52 overflow-auto rounded-md border border-border/60">
                {!selectedClass ? (
                  <div className="px-2 py-3 text-2xs text-muted-foreground">Select a class.</div>
                ) : !methods ? (
                  <div className="px-2 py-3 text-2xs text-muted-foreground">Loading...</div>
                ) : (
                  <>
                    <div className="sticky top-0 flex items-center gap-2 border-b border-border bg-surface/60 px-2 py-1 backdrop-blur">
                      <span className="truncate font-mono text-2xs text-foreground">
                        {methods.methods.length} method(s)
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto h-5 px-2 text-2xs text-primary"
                        onClick={() => void traceSelected()}
                      >
                        <Activity className="h-3 w-3" /> Trace class
                      </Button>
                    </div>
                    {methods.methods.map((m) => (
                      <div
                        key={m.signature}
                        className="border-b border-border/30 px-2 py-1 font-mono text-2xs text-muted-foreground"
                      >
                        {m.static && <span className="text-primary">static </span>}
                        {m.signature}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Heap */}
        <section>
          <SectionHead icon={Cpu} title="Heap explorer" hint="live instances + fields" />
          <div className="flex gap-2">
            <input
              value={heapClass}
              onChange={(e) => setHeapClass(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void snapshotHeap()
              }}
              placeholder="Fully-qualified class, e.g. com.example.Session"
              className="h-8 flex-1 rounded-md border border-border bg-surface px-2 font-mono text-2xs text-foreground outline-none placeholder:text-muted-foreground/60"
            />
            <Button size="sm" variant="outline" onClick={() => void snapshotHeap()}>
              {heapBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Snapshot'}
            </Button>
          </div>
          {instances && (
            <div className="mt-2 space-y-2">
              {instances.length === 0 ? (
                <p className="text-2xs italic text-muted-foreground">No live instances found.</p>
              ) : (
                instances.map((inst) => (
                  <div
                    key={inst.handle}
                    className="rounded-md border border-border/60 bg-surface/30 p-2"
                  >
                    <div className="mb-1 font-mono text-2xs text-foreground">
                      <span className="text-muted-foreground">{inst.handle}</span> {inst.summary}
                    </div>
                    <div className="space-y-0.5">
                      {inst.fields.map((f) => (
                        <div key={f.name} className="font-mono text-2xs text-muted-foreground">
                          <span className="text-foreground/80">{f.type} </span>
                          {f.name} = <span className="text-foreground/90">{f.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </section>

        {/* Native */}
        <section>
          <SectionHead icon={Activity} title="Native function trace" />
          <div className="flex gap-2">
            <input
              value={nativeModule}
              onChange={(e) => setNativeModule(e.target.value)}
              placeholder="module (optional), e.g. libnative.so"
              className="h-8 flex-1 rounded-md border border-border bg-surface px-2 font-mono text-2xs text-foreground outline-none placeholder:text-muted-foreground/60"
            />
            <input
              value={nativeSymbol}
              onChange={(e) => setNativeSymbol(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void traceNative()
              }}
              placeholder="symbol, e.g. open"
              className="h-8 flex-1 rounded-md border border-border bg-surface px-2 font-mono text-2xs text-foreground outline-none placeholder:text-muted-foreground/60"
            />
            <Button size="sm" variant="outline" onClick={() => void traceNative()}>
              Trace
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}

function SectionHead({
  icon: Icon,
  title,
  count,
  hint
}: {
  icon: typeof Activity
  title: string
  count?: number
  hint?: string
}): JSX.Element {
  return (
    <div className="mb-2 flex items-center gap-2 border-b border-border/60 pb-1">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <span className="text-xs font-semibold">{title}</span>
      {count != null && <span className="font-mono text-2xs text-muted-foreground">{count}</span>}
      {hint && <span className="text-2xs text-muted-foreground">- {hint}</span>}
    </div>
  )
}
