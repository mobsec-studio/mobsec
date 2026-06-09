import {
  Boxes,
  Cpu,
  KeyRound,
  Layers,
  Loader2,
  Network,
  Radar,
  ShieldAlert,
  Sparkles,
  Wand2
} from 'lucide-react'
import type { AppIntelligenceReport, ReconRecommendation, SecurityControl } from '@shared/frida-intel'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { cn } from '@/lib/utils'

interface Props {
  report: AppIntelligenceReport | null
  busy: boolean
  onRerun: () => void
  /** Jump to the Bypass tab (recommendations point there). */
  onGoToBypass: () => void
}

function pct(c: number): string {
  return `${Math.round(c * 100)}%`
}

function priorityVariant(p: ReconRecommendation['priority']): 'destructive' | 'warning' | 'default' {
  return p === 'high' ? 'destructive' : p === 'medium' ? 'warning' : 'default'
}

export function IntelligencePanel({ report, busy, onRerun, onGoToBypass }: Props): JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-surface/30 px-3">
        <Radar className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium">Intelligence</span>
        {report && (
          <span className="font-mono text-2xs text-muted-foreground">
            {report.framework.label} · {report.durationMs}ms
          </span>
        )}
        <Button size="sm" variant="ghost" className="ml-auto" disabled={busy} onClick={onRerun}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radar className="h-3.5 w-3.5" />}
          {report ? 'Re-run Recon' : 'Run Recon'}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
        {!report ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <Radar className="h-8 w-8 opacity-40" />
            <p>Run reconnaissance to profile the selected target.</p>
            <Button size="sm" variant="outline" disabled={busy} onClick={onRerun}>
              <Radar className="h-3.5 w-3.5" /> Run Recon
            </Button>
          </div>
        ) : (
          <ReportBody report={report} onGoToBypass={onGoToBypass} />
        )}
      </div>
    </div>
  )
}

function ReportBody({
  report,
  onGoToBypass
}: {
  report: AppIntelligenceReport
  onGoToBypass: () => void
}): JSX.Element {
  const fw = report.framework
  const facts: [string, string][] = [
    ['Package', report.identifier ?? '—'],
    ['PID', String(report.pid)],
    ['Android', report.device.androidVersion ?? '—'],
    ['API', report.device.apiLevel != null ? String(report.device.apiLevel) : '—'],
    ['ABI', report.device.abi ?? '—'],
    ['VM', report.runtime.vmName ?? '—'],
    ['Debuggable', report.runtime.isDebuggable == null ? '—' : report.runtime.isDebuggable ? 'yes' : 'no'],
    ['Emulated', report.runtime.emulated == null ? '—' : report.runtime.emulated ? 'yes' : 'no']
  ]

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-baseline gap-2">
          <Sparkles className="h-4 w-4 shrink-0 translate-y-0.5 text-primary" />
          <span className="text-lg font-semibold text-primary">{fw.label}</span>
          <span className="font-mono text-2xs text-muted-foreground">
            {pct(fw.confidence)} confidence{fw.version ? ` · v${fw.version}` : ''}
          </span>
        </div>
        {report.frameworks.length > 1 && (
          <p className="mt-1 text-2xs text-muted-foreground">
            Also: {report.frameworks.slice(1).map((f) => `${f.label} (${pct(f.confidence)})`).join(', ')}
          </p>
        )}
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          {facts.map(([k, v]) => (
            <div key={k} className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</span>
              <span className="truncate font-mono text-xs text-foreground">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {report.recommendations.length > 0 && (
        <Section icon={Wand2} title="Recommended bypasses" hint="what the engine suggests">
          <div className="space-y-1.5">
            {report.recommendations.map((r) => (
              <div
                key={r.strategyId + r.label}
                className="flex items-start gap-2 rounded-md border border-border/60 bg-surface/30 px-3 py-2"
              >
                <Badge variant={priorityVariant(r.priority)} className="mt-0.5 shrink-0">
                  {r.priority}
                </Badge>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-foreground">{r.label}</div>
                  <div className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">{r.reason}</div>
                </div>
              </div>
            ))}
          </div>
          <Button size="sm" variant="outline" className="mt-2" onClick={onGoToBypass}>
            <Wand2 className="h-3.5 w-3.5" /> Open Bypass
          </Button>
        </Section>
      )}

      <Section icon={ShieldAlert} title="Security controls" count={report.security.length}>
        {report.security.length === 0 ? (
          <Empty>None detected from the runtime snapshot.</Empty>
        ) : (
          <div className="space-y-1.5">
            {report.security.map((c) => (
              <SecurityRow key={c.id + (c.variant ?? '')} control={c} />
            ))}
          </div>
        )}
      </Section>

      <Section icon={Network} title="Networking" count={report.networking.length}>
        {report.networking.length === 0 ? (
          <Empty>No app-bundled HTTP client detected.</Empty>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {report.networking.map((n) => (
              <Chip key={n.id} title={n.evidence.join('; ')}>
                {n.label}
                {n.version ? <span className="text-muted-foreground"> v{n.version}</span> : null}
              </Chip>
            ))}
          </div>
        )}
      </Section>

      <Section icon={KeyRound} title="Cryptography" count={report.crypto.length}>
        {report.crypto.length === 0 ? (
          <Empty>No crypto surface detected.</Empty>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {report.crypto.map((c) => (
              <Chip key={c.id} title={c.evidence.join('; ')} danger={c.weak}>
                {c.label}
              </Chip>
            ))}
          </div>
        )}
      </Section>

      <Section icon={Layers} title="Storage" count={report.storage.length}>
        <div className="flex flex-wrap gap-1.5">
          {report.storage.map((s) => (
            <Chip key={s.id} title={s.evidence.join('; ')} accent={s.encrypted}>
              {s.label}
              {s.encrypted ? <span className="ml-1 text-success">🔒</span> : null}
            </Chip>
          ))}
        </div>
      </Section>

      <Section icon={Boxes} title="Native libraries" count={report.nativeLibs.length}>
        {report.nativeLibs.length === 0 ? (
          <Empty>No non-system native libraries mapped.</Empty>
        ) : (
          <div className="max-h-44 overflow-auto rounded-md border border-border/60">
            <table className="w-full font-mono text-2xs">
              <tbody>
                {report.nativeLibs.map((l) => (
                  <tr key={l.path} className="border-b border-border/30 last:border-0">
                    <td className="px-2 py-1 text-foreground">{l.name}</td>
                    <td className="px-2 py-1">
                      <span
                        className={cn(
                          'rounded px-1 text-[10px]',
                          l.category === 'security'
                            ? 'bg-destructive/15 text-destructive'
                            : l.category === 'framework'
                              ? 'bg-primary/15 text-primary'
                              : l.category === 'crypto'
                                ? 'bg-warning/15 text-warning'
                                : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {l.category}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section icon={Cpu} title="Runtime surface">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          <Fact k="Loaded classes" v={report.classes.total != null ? String(report.classes.total) : '—'} />
          <Fact k="Obfuscated" v={report.classes.obfuscated ? 'yes' : 'no'} />
          <Fact
            k="Native methods"
            v={report.jni.nativeMethodCount != null ? String(report.jni.nativeMethodCount) : '—'}
          />
          <Fact k="Dynamic DEX" v={report.dynamicDex.loaded ? 'yes' : 'no'} />
        </div>
        {report.classes.appPackages.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {report.classes.appPackages.map((p) => (
              <span key={p} className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {p}
              </span>
            ))}
          </div>
        )}
      </Section>

      {report.warnings.length > 0 && (
        <Section icon={ShieldAlert} title="Warnings" count={report.warnings.length}>
          <ul className="space-y-1">
            {report.warnings.map((w, i) => (
              <li key={i} className="font-mono text-2xs leading-relaxed text-muted-foreground">
                {w}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}

function SecurityRow({ control }: { control: SecurityControl }): JSX.Element {
  return (
    <div className="flex items-start gap-2 rounded-md border border-border/60 bg-surface/30 px-3 py-2">
      <Badge variant={control.confidence >= 0.8 ? 'destructive' : 'warning'} className="mt-0.5 shrink-0">
        {pct(control.confidence)}
      </Badge>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-foreground">{control.label}</span>
          <code className="rounded bg-surface px-1 text-[10px] text-muted-foreground">{control.kind}</code>
          {control.variant && <span className="text-2xs text-muted-foreground">· {control.variant}</span>}
        </div>
        {control.evidence.length > 0 && (
          <div className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">
            {control.evidence.join('; ')}
          </div>
        )}
      </div>
    </div>
  )
}

function Section({
  icon: Icon,
  title,
  count,
  hint,
  children
}: {
  icon: typeof Cpu
  title: string
  count?: number
  hint?: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 border-b border-border/60 pb-1">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold">{title}</span>
        {count != null && <span className="font-mono text-2xs text-muted-foreground">{count}</span>}
        {hint && <span className="text-2xs text-muted-foreground">— {hint}</span>}
      </div>
      {children}
    </div>
  )
}

function Chip({
  children,
  title,
  danger,
  accent
}: {
  children: React.ReactNode
  title?: string
  danger?: boolean
  accent?: boolean
}): JSX.Element {
  return (
    <span
      title={title}
      className={cn(
        'rounded-md border px-2 py-0.5 text-2xs',
        danger
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : accent
            ? 'border-success/40 bg-success/10 text-success'
            : 'border-border bg-surface/40 text-foreground/90'
      )}
    >
      {children}
    </span>
  )
}

function Fact({ k, v }: { k: string; v: string }): JSX.Element {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</span>
      <span className="font-mono text-xs text-foreground">{v}</span>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }): JSX.Element {
  return <p className="text-2xs italic text-muted-foreground">{children}</p>
}
