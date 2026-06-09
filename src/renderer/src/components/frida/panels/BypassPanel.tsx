import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Bookmark, Loader2, Save, ShieldCheck, Trash2 } from 'lucide-react'
import type { FridaPreset, StrategyInfo, StrategyResult } from '@shared/frida-intel'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { cn } from '@/lib/utils'

interface Props {
  sessionId: string | null
  packageName: string | null
  /** Bump to trigger an "apply all safe" run from the header button. */
  applyAllSignal: number
  /** Results from a just-completed Auto-Pwn, shown inline. */
  seedResults?: StrategyResult[] | null
}

export function BypassPanel({
  sessionId,
  packageName,
  applyAllSignal,
  seedResults
}: Props): JSX.Element {
  const [strategies, setStrategies] = useState<StrategyInfo[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [results, setResults] = useState<StrategyResult[]>(seedResults ?? [])
  const [busy, setBusy] = useState(false)
  const [presets, setPresets] = useState<FridaPreset[]>([])
  const [presetName, setPresetName] = useState('')
  const lastHandledApplySignal = useRef(0)

  useEffect(() => {
    if (!sessionId) return
    void (async () => {
      const [st, pr] = await Promise.all([
        window.api.frida.listStrategies(sessionId),
        window.api.frida.listPresets(packageName ?? undefined)
      ])
      if (st.ok) {
        setStrategies(st.value)
        setSelected(new Set(st.value.filter((s) => s.applicable).map((s) => s.id)))
      }
      if (pr.ok) setPresets(pr.value)
    })()
  }, [sessionId, packageName])

  const apply = async (ids: string[]): Promise<void> => {
    if (!sessionId || ids.length === 0) return
    setBusy(true)
    const res = await window.api.frida.applyStrategies(sessionId, ids)
    setBusy(false)
    if (res.ok) {
      setResults(res.value.results)
      const applied = res.value.results.filter((r) => r.applied).length
      const hooks = res.value.results.reduce((n, r) => n + r.hooksInstalled, 0)
      toast.success('Bypasses applied', {
        description: `${applied} strategy(ies), ${hooks} hook(s)`
      })
    } else {
      toast.error('Apply failed', { description: res.error })
    }
  }

  const applyAllSafe = (): void => {
    void apply(strategies.filter((s) => s.applicable && s.autoApply).map((s) => s.id))
  }

  // Header "Apply all (safe)" trigger.
  useEffect(() => {
    if (applyAllSignal <= lastHandledApplySignal.current) return
    if (!sessionId || strategies.length === 0 || busy) return
    lastHandledApplySignal.current = applyAllSignal
    applyAllSafe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyAllSignal, sessionId, strategies.length, busy])

  // Reflect Auto-Pwn results when they arrive.
  useEffect(() => {
    setResults(seedResults ?? [])
  }, [seedResults, sessionId])

  const reloadPresets = async (): Promise<void> => {
    const pr = await window.api.frida.listPresets(packageName ?? undefined)
    if (pr.ok) setPresets(pr.value)
  }

  const savePreset = async (): Promise<void> => {
    if (!presetName.trim()) return
    const res = await window.api.frida.savePreset({
      packageName: packageName ?? '*',
      name: presetName.trim(),
      strategyIds: Array.from(selected),
      monitorIds: []
    })
    if (res.ok) {
      toast.success(`Preset "${res.value.name}" saved`)
      setPresetName('')
      void reloadPresets()
    } else {
      toast.error('Save failed', { description: res.error })
    }
  }

  const applyPreset = (p: FridaPreset): void => {
    setSelected(new Set(p.strategyIds))
    void apply(p.strategyIds)
  }

  const deletePreset = async (p: FridaPreset): Promise<void> => {
    const res = await window.api.frida.deletePreset(p.id)
    if (res.ok) setPresets((prev) => prev.filter((x) => x.id !== p.id))
    else toast.error('Delete failed', { description: res.error })
  }

  const toggle = (id: string): void =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const resultById = (id: string): StrategyResult | undefined => results.find((r) => r.id === id)

  if (!sessionId) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
        Run <span className="mx-1 font-medium text-foreground">Recon</span> or{' '}
        <span className="mx-1 font-medium text-foreground">Auto-Pwn</span> first to load the agent,
        then choose bypasses here.
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-surface/30 px-3">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium">Bypass</span>
        <span className="font-mono text-2xs text-muted-foreground">{selected.size} selected</span>
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => applyAllSafe()} disabled={busy}>
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5" />
            )}
            Apply all safe
          </Button>
          <Button
            size="sm"
            disabled={busy || selected.size === 0}
            onClick={() => void apply(Array.from(selected))}
          >
            Apply {selected.size}
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        <div className="space-y-1.5">
          {strategies.map((s) => {
            const r = resultById(s.id)
            return (
              <label
                key={s.id}
                className="flex cursor-pointer items-start gap-2 rounded-md border border-border/60 bg-surface/30 px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={selected.has(s.id)}
                  onChange={() => toggle(s.id)}
                  className="mt-0.5 accent-primary"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground">{s.label}</span>
                    <code className="rounded bg-surface px-1 text-[10px] text-muted-foreground">
                      {s.category}
                    </code>
                    {s.applicable && <span className="text-2xs text-success">relevant</span>}
                    {!s.autoApply && (
                      <span
                        className="rounded bg-warning/15 px-1 text-[10px] text-warning"
                        title="Not applied by 'Apply all safe' — touches native/global hooks that can destabilise an app."
                      >
                        manual · risky
                      </span>
                    )}
                    {r && (
                      <Badge
                        variant={r.alreadyActive ? 'muted' : r.applied ? 'success' : 'warning'}
                        className="ml-auto"
                      >
                        {r.alreadyActive
                          ? 'active'
                          : r.applied
                            ? `${r.hooksInstalled} hooks`
                            : 'no-op'}
                        {r.verification ? (r.verification.ok ? ' ✓' : ' ✗') : ''}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">
                    {s.description}
                  </div>
                  {r && r.notes.length > 0 && (
                    <div className="mt-0.5 text-2xs text-muted-foreground/80">
                      {r.notes.join(' · ')}
                    </div>
                  )}
                  {r && r.errors.length > 0 && (
                    <div className="mt-0.5 text-2xs text-destructive">{r.errors.join('; ')}</div>
                  )}
                </div>
              </label>
            )
          })}
          {strategies.length === 0 && (
            <span className="text-2xs text-muted-foreground">Loading bypasses…</span>
          )}
        </div>

        {/* Presets */}
        <div className="mt-5">
          <div className="mb-2 flex items-center gap-2 border-b border-border/60 pb-1">
            <Bookmark className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold">Presets</span>
            <span className="text-2xs text-muted-foreground">— save & replay a selection</span>
          </div>
          <div className="flex gap-2">
            <input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void savePreset()
              }}
              placeholder="Name a preset for the selected bypasses"
              className="h-8 flex-1 rounded-md border border-border bg-surface px-2 font-mono text-2xs text-foreground outline-none placeholder:text-muted-foreground/60"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!presetName.trim() || selected.size === 0}
              onClick={() => void savePreset()}
            >
              <Save className="h-3.5 w-3.5" /> Save
            </Button>
          </div>
          {presets.length > 0 && (
            <div className="mt-2 space-y-1">
              {presets.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 rounded-md border border-border/60 bg-surface/30 px-2.5 py-1.5"
                >
                  <Badge variant={p.packageName === '*' ? 'muted' : 'default'}>
                    {p.packageName === '*' ? 'any' : 'app'}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-2xs text-foreground">
                    {p.name}{' '}
                    <span className="text-muted-foreground">· {p.strategyIds.length} bypass</span>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-2xs text-primary"
                    disabled={busy}
                    onClick={() => applyPreset(p)}
                  >
                    Apply
                  </Button>
                  <button
                    type="button"
                    onClick={() => void deletePreset(p)}
                    aria-label="Delete preset"
                    className={cn(
                      'rounded p-1 text-muted-foreground transition-colors hover:text-destructive'
                    )}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
