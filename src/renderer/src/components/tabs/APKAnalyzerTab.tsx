import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Copy,
  Cpu,
  ExternalLink,
  FileBox,
  FileCode2,
  FilePlus2,
  FileSearch,
  Globe,
  Layers,
  Loader2,
  Lock,
  Package,
  Repeat,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  X,
  Zap
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { Progress } from '../ui/progress'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../ui/dropdown-menu'
import { cn, formatBytes } from '@/lib/utils'
import {
  useApkAnalyzerStore,
  type AnalyzerTab
} from '@/stores/useApkAnalyzerStore'
import { selectActiveDevice, useDeviceStore } from '@/stores/useDeviceStore'
import { useRepeaterStore } from '@/stores/useRepeaterStore'
import { useJadxStore } from '@/stores/useJadxStore'
import { useUIStore } from '@/stores/useUIStore'
import type {
  ApkAnalysisSummary,
  ApkAttackSurfaceItem,
  ApkComponentSummary,
  ApkPrivacySignal,
  ApkTechnologyFinding,
  SecretFinding,
  SecurityFinding,
  EndpointFinding,
  TrackerFinding
} from '@shared/types'

const BUILT_IN_SCRIPTS: { id: string; label: string }[] = [
  { id: 'ssl-pinning-bypass', label: 'SSL Pinning Bypass (universal)' },
  { id: 'root-detection-bypass', label: 'Root Detection Bypass' },
  { id: 'emulator-detection-bypass', label: 'Emulator Detection Bypass' },
  { id: 'debugger-detection-bypass', label: 'Debugger Detection Bypass' },
  { id: 'webview-inspect', label: 'WebView Inspect' },
  { id: 'crypto-logger', label: 'Crypto Operations Logger' }
]

export function APKAnalyzerTab(): JSX.Element {
  const summary = useApkAnalyzerStore((s) => s.summary)
  const analyzing = useApkAnalyzerStore((s) => s.analyzing)
  const error = useApkAnalyzerStore((s) => s.error)
  const filePath = useApkAnalyzerStore((s) => s.filePath)
  const loadFromPath = useApkAnalyzerStore((s) => s.loadFromPath)
  const reset = useApkAnalyzerStore((s) => s.reset)

  const onDrop = useCallback(
    (file: File): void => {
      const path = window.api.app.getFilePath(file)
      if (!path) {
        toast.error("Couldn't resolve the dropped file's path.")
        return
      }
      void loadFromPath(path)
    },
    [loadFromPath]
  )

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-surface/30 px-4">
        <FileSearch className="h-4 w-4 text-primary" />
        <h1 className="text-sm font-semibold tracking-tight">APK Analyzer</h1>
        {summary && (
          <Badge variant="muted" className="font-mono">
            {summary.packageName} v{summary.versionName}
          </Badge>
        )}
        {filePath && (
          <span className="ml-2 max-w-md truncate font-mono text-2xs text-muted-foreground">
            {filePath}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {summary && (
            <Button variant="ghost" size="sm" onClick={reset}>
              <X className="h-3.5 w-3.5" /> Close
            </Button>
          )}
        </div>
      </header>

      {analyzing && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-sm text-muted-foreground">Analyzing APK…</div>
          </div>
        </div>
      )}

      {!summary && !analyzing && (
        <DropZone error={error} onPick={onDrop} />
      )}

      {summary && !analyzing && <Analyzer summary={summary} />}
    </div>
  )
}

interface DropZoneProps {
  onPick: (file: File) => void
  error: string | null
}

function DropZone({ onPick, error }: DropZoneProps): JSX.Element {
  const [dragOver, setDragOver] = useState(false)
  return (
    <div
      className="flex flex-1 items-center justify-center p-6"
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files?.[0]
        if (file) onPick(file)
      }}
    >
      <div
        className={cn(
          'flex max-w-2xl flex-col items-center gap-4 rounded-2xl border-2 border-dashed px-12 py-16 text-center transition-colors',
          dragOver
            ? 'border-primary/60 bg-primary/10'
            : 'border-border bg-surface/40 hover:bg-surface/60'
        )}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <FileBox className="h-7 w-7" strokeWidth={1.4} />
        </div>
        <div className="space-y-1.5">
          <div className="text-base font-semibold">Drag an APK or bundle here</div>
          <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
            We&rsquo;ll parse APK, XAPK, APKS, and APKM packages for manifest metadata,
            signing certs, native libs, DEX classes, and sweep DEX strings + resources for{' '}
            <span className="text-foreground">secrets, endpoints, weak crypto,
            WebView misconfigurations, exported components</span> and tracker SDKs.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            const res = await window.api.dialog.showOpen({
              title: 'Select an Android package',
              filters: [
                { name: 'Android package', extensions: ['apk', 'xapk', 'apks', 'apkm'] },
                { name: 'All files', extensions: ['*'] }
              ],
              properties: ['openFile']
            })
            if (res.ok && res.value.length > 0) {
              const path = res.value[0]
              if (path) void useApkAnalyzerStore.getState().loadFromPath(path)
            }
          }}
        >
          <Upload className="h-3.5 w-3.5" /> Choose package&hellip;
        </Button>
        {error && (
          <div className="mt-2 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-2xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  )
}

interface AnalyzerProps {
  summary: ApkAnalysisSummary
}

function Analyzer({ summary }: AnalyzerProps): JSX.Element {
  const tab = useApkAnalyzerStore((s) => s.tab)
  const setTab = useApkAnalyzerStore((s) => s.setTab)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AnalyzerHeader summary={summary} />
      <nav className="flex h-[52px] shrink-0 items-start gap-1 overflow-x-auto overflow-y-hidden border-b border-border bg-surface/20 px-3 pb-1 pt-2">
        <TabPill tab="overview" current={tab} onClick={setTab} label="Overview" />
        <TabPill
          tab="intelligence"
          current={tab}
          onClick={setTab}
          label="Intel"
          count={summary.technologies.length + summary.privacySignals.length}
        />
        <TabPill
          tab="surface"
          current={tab}
          onClick={setTab}
          label="Attack surface"
          count={summary.attackSurface.length}
          highlightSeverity={summary.attackSurface[0]?.severity}
        />
        <TabPill
          tab="network"
          current={tab}
          onClick={setTab}
          label="Network"
          count={summary.networkSecurity.domains.length + summary.networkSecurity.findings.length}
          highlightSeverity={summary.networkSecurity.findings[0]?.severity}
        />
        <TabPill
          tab="inventory"
          current={tab}
          onClick={setTab}
          label="Inventory"
          count={summary.fileInventory.totalEntries}
        />
        <TabPill tab="manifest" current={tab} onClick={setTab} label="Manifest" />
        <TabPill
          tab="permissions"
          current={tab}
          onClick={setTab}
          label="Permissions"
          count={summary.permissions.length}
        />
        <TabPill
          tab="components"
          current={tab}
          onClick={setTab}
          label="Components"
          count={
            summary.components.activities.length +
            summary.components.services.length +
            summary.components.receivers.length +
            summary.components.providers.length
          }
        />
        <TabPill
          tab="security"
          current={tab}
          onClick={setTab}
          label="Security"
          count={summary.securityFindings.length}
          highlightSeverity={summary.securityFindings[0]?.severity}
        />
        <TabPill
          tab="secrets"
          current={tab}
          onClick={setTab}
          label="Secrets"
          count={summary.secrets.length}
          highlightSeverity={summary.secrets[0]?.severity}
        />
        <TabPill
          tab="endpoints"
          current={tab}
          onClick={setTab}
          label="Endpoints"
          count={summary.endpoints.length}
        />
        <TabPill
          tab="trackers"
          current={tab}
          onClick={setTab}
          label="Trackers"
          count={summary.trackers.length}
        />
        <TabPill
          tab="native"
          current={tab}
          onClick={setTab}
          label="Native libs"
          count={summary.nativeLibraries.reduce((a, n) => a + n.files.length, 0)}
        />
        <TabPill
          tab="strings"
          current={tab}
          onClick={setTab}
          label="Strings"
          count={summary.stringsSample.length}
        />
      </nav>

      <div className="min-h-0 flex-1 overflow-auto">
        {tab === 'overview' && <OverviewPanel summary={summary} />}
        {tab === 'intelligence' && <IntelligencePanel summary={summary} />}
        {tab === 'surface' && <AttackSurfacePanel summary={summary} />}
        {tab === 'network' && <NetworkPanel summary={summary} />}
        {tab === 'inventory' && <InventoryPanel summary={summary} />}
        {tab === 'manifest' && <ManifestPanel summary={summary} />}
        {tab === 'permissions' && <PermissionsPanel summary={summary} />}
        {tab === 'components' && <ComponentsPanel summary={summary} />}
        {tab === 'security' && <SecurityPanel findings={summary.securityFindings} />}
        {tab === 'secrets' && <SecretsPanel summary={summary} />}
        {tab === 'endpoints' && <EndpointsPanel summary={summary} />}
        {tab === 'trackers' && <TrackersPanel trackers={summary.trackers} />}
        {tab === 'native' && <NativeLibsPanel summary={summary} />}
        {tab === 'strings' && <StringsPanel summary={summary} />}
      </div>
    </div>
  )
}

function TabPill({
  tab,
  current,
  onClick,
  label,
  count,
  highlightSeverity
}: {
  tab: AnalyzerTab
  current: AnalyzerTab
  onClick: (tab: AnalyzerTab) => void
  label: string
  count?: number
  highlightSeverity?: SecretFinding['severity']
}): JSX.Element {
  const active = current === tab
  const heat =
    highlightSeverity === 'critical' || highlightSeverity === 'high'
      ? 'border-destructive/40 text-destructive'
      : highlightSeverity === 'medium'
        ? 'border-warning/40 text-warning'
        : ''
  return (
    <button
      type="button"
      onClick={() => onClick(tab)}
      className={cn(
        'flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-2xs font-medium transition-colors',
        active
          ? 'border-primary/40 bg-primary/15 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.16)]'
          : 'border-transparent text-muted-foreground hover:bg-surface-raised hover:text-foreground',
        !active && heat
      )}
    >
      {label}
      {typeof count === 'number' && (
        <span className="font-mono text-2xs opacity-80">{count}</span>
      )}
    </button>
  )
}

function AnalyzerHeader({ summary }: { summary: ApkAnalysisSummary }): JSX.Element {
  const activeDevice = useDeviceStore(selectActiveDevice)
  const setActiveTool = useUIStore((s) => s.setActiveTool)
  const setJadxInputPath = useJadxStore((s) => s.setInputPath)
  const [installing, setInstalling] = useState(false)
  const [spawning, setSpawning] = useState<string | null>(null)

  const install = async (): Promise<void> => {
    if (!activeDevice) {
      toast.error('No active device. Connect a phone or start the emulator first.')
      return
    }
    setInstalling(true)
    try {
      const res = await window.api.apk.installOnActiveDevice(summary.filePath)
      if (res.ok) toast.success(`Installed ${res.value.packageName}`)
      else toast.error('Install failed', { description: res.error })
    } finally {
      setInstalling(false)
    }
  }

  const spawn = async (scriptId: string): Promise<void> => {
    setSpawning(scriptId)
    try {
      const res = await window.api.apk.spawnWithBypass(summary.filePath, scriptId)
      if (res.ok) {
        toast.success(`Spawned ${res.value.packageName} with ${scriptId}`)
      } else {
        toast.error('Spawn failed', { description: res.error })
      }
    } finally {
      setSpawning(null)
    }
  }

  return (
    <section className="grid shrink-0 grid-cols-12 gap-4 border-b border-border bg-surface/30 px-4 py-4">
      <div className="col-span-12 lg:col-span-3">
        <RiskCard score={summary.riskScore} verdict={summary.verdict} />
      </div>
      <div className="col-span-12 lg:col-span-6 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Package className="h-4 w-4 text-primary" />
          <span className="font-semibold">{summary.application.label ?? summary.packageName}</span>
          <span className="text-muted-foreground">·</span>
          <span className="font-mono text-2xs text-muted-foreground">{summary.packageName}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-2xs">
          <Kv k="Version" v={`${summary.versionName} (${summary.versionCode})`} />
          <Kv k="Size" v={formatBytes(summary.size)} />
          <Kv k="Format" v={packageFormatLabel(summary)} />
          <Kv k="Min SDK" v={String(summary.minSdk)} />
          <Kv k="Target SDK" v={String(summary.targetSdk)} />
          <Kv k="DEX classes" v={String(summary.dexClassCount)} />
          <Kv
            k="Obfuscation"
            v={`${Math.round(summary.obfuscation.ratio * 100)}% short class names`}
          />
          <Kv k="Permissions" v={String(summary.permissions.length)} />
          <Kv k="Trackers" v={String(summary.trackers.length)} />
          <Kv k="Hardening" v={`${summary.hardening.score}/100`} />
          <Kv k="Attack surface" v={String(summary.attackSurface.length)} />
          <Kv k="Technologies" v={String(summary.technologies.length)} />
          <Kv
            k="Network config"
            v={summary.networkSecurity.present ? summary.networkSecurity.source ?? 'present' : 'none'}
          />
          {summary.bundle.analyzedEntry && (
            <Kv k="Analyzed split" v={summary.bundle.analyzedEntry} />
          )}
        </div>
        {summary.signingCertificates.length > 0 && (
          <div className="rounded-md border border-border bg-surface/40 p-2 text-2xs">
            <div className="mb-1 uppercase tracking-wider text-muted-foreground">
              Signing cert (SHA-256)
            </div>
            <div className="font-mono break-all text-foreground">
              {summary.signingCertificates[0]!.sha256}
            </div>
            <div className="mt-1 text-muted-foreground">
              {summary.signingCertificates[0]!.subject}
            </div>
          </div>
        )}
      </div>
      <div className="col-span-12 lg:col-span-3 flex flex-col items-stretch gap-2">
        <Button size="sm" disabled={installing || !activeDevice} onClick={() => void install()}>
          {installing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Installing&hellip;
            </>
          ) : (
            <>
              <ArrowRight className="h-3.5 w-3.5" /> Install on{' '}
              {activeDevice?.label.split(' ')[0] ?? 'device'}
            </>
          )}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" disabled={!!spawning}>
              {spawning ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Spawning&hellip;
                </>
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5" /> Spawn with Frida bypass
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-[260px]">
            <DropdownMenuLabel>Pick a built-in script</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {BUILT_IN_SCRIPTS.map((s) => (
              <DropdownMenuItem key={s.id} onSelect={() => void spawn(s.id)}>
                {s.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="text-2xs">
              Requires frida-server running on the active device
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setJadxInputPath(summary.filePath)
            setActiveTool('jadx')
          }}
        >
          <FileCode2 className="h-3.5 w-3.5" /> Open in JADX
        </Button>
        <button
          type="button"
          className="text-2xs text-muted-foreground hover:text-foreground"
          onClick={() => {
            navigator.clipboard.writeText(summary.apkSha256)
            toast.success('APK SHA-256 copied')
          }}
        >
          SHA-256 · <span className="font-mono">{summary.apkSha256.slice(0, 16)}…</span>
        </button>
      </div>
    </section>
  )
}

function RiskCard({
  score,
  verdict
}: {
  score: number
  verdict: ApkAnalysisSummary['verdict']
}): JSX.Element {
  const color =
    verdict === 'critical'
      ? 'destructive'
      : verdict === 'risky'
        ? 'destructive'
        : verdict === 'concerning'
          ? 'warning'
          : verdict === 'low-risk'
            ? 'warning'
            : 'success'
  const Icon =
    verdict === 'critical' || verdict === 'risky'
      ? ShieldAlert
      : verdict === 'concerning' || verdict === 'low-risk'
        ? Shield
        : ShieldCheck
  const verdictLabel: Record<typeof verdict, string> = {
    clean: 'Clean',
    'low-risk': 'Low risk',
    concerning: 'Concerning',
    risky: 'Risky',
    critical: 'Critical'
  }
  return (
    <div
      className={cn(
        'flex h-full flex-col rounded-xl border bg-surface/40 p-4',
        color === 'destructive' && 'border-destructive/40 bg-destructive/5',
        color === 'warning' && 'border-warning/40 bg-warning/5',
        color === 'success' && 'border-success/40 bg-success/5'
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-2xs uppercase tracking-wider text-muted-foreground">
          Risk score
        </span>
        <Icon
          className={cn(
            'h-4 w-4',
            color === 'destructive' && 'text-destructive',
            color === 'warning' && 'text-warning',
            color === 'success' && 'text-success'
          )}
        />
      </div>
      <div className="mt-1 flex items-end gap-2">
        <span className="text-3xl font-bold tracking-tight">{score}</span>
        <span className="pb-1 text-xs text-muted-foreground">/ 100</span>
      </div>
      <div className="mt-1">
        <Badge variant={color === 'destructive' ? 'destructive' : color === 'warning' ? 'warning' : 'success'}>
          {verdictLabel[verdict]}
        </Badge>
      </div>
      <div className="mt-3">
        <Progress value={score} />
      </div>
    </div>
  )
}

function Kv({ k, v }: { k: string; v: string }): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{k}:</span>
      <span className="font-mono text-foreground">{v}</span>
    </div>
  )
}

// ----- Tabs ------------------------------------------------------------

function OverviewPanel({ summary }: { summary: ApkAnalysisSummary }): JSX.Element {
  // A glance dashboard: top severity-ranked findings + endpoints + trackers.
  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat
          icon={ShieldAlert}
          label="Security findings"
          value={summary.securityFindings.length}
          highlight={summary.securityFindings.some((f) => f.severity === 'critical' || f.severity === 'high')}
        />
        <Stat
          icon={Lock}
          label="Secret findings"
          value={summary.secrets.length}
          highlight={summary.secrets.some((s) => s.severity === 'critical' || s.severity === 'high')}
        />
        <Stat
          icon={Globe}
          label="Endpoints"
          value={summary.endpoints.length}
          highlight={summary.endpoints.some((e) => e.insecure)}
        />
        <Stat
          icon={FileSearch}
          label="Attack surface"
          value={summary.attackSurface.length}
          highlight={summary.attackSurface.some(
            (item) => item.severity === 'critical' || item.severity === 'high'
          )}
        />
        <Stat
          icon={ShieldCheck}
          label="Hardening"
          value={`${summary.hardening.score}/100`}
          highlight={summary.hardening.score < 60}
        />
        <Stat icon={Layers} label="Technologies" value={summary.technologies.length} />
      </div>

      {summary.riskBreakdown.length > 0 && (
        <Section title="Risk contribution">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
            {summary.riskBreakdown.map((item) => (
              <div
                key={item.label}
                className="rounded-md border border-border bg-surface/40 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-2xs text-muted-foreground">{item.label}</span>
                  <SeverityChip severity={item.severity} />
                </div>
                <div className="mt-1 flex items-end justify-between gap-2">
                  <span className="font-mono text-sm text-foreground">
                    +{Math.round(item.score)}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {item.count} item{item.count === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {summary.securityFindings.length > 0 && (
        <Section title="Top security findings">
          <ul className="space-y-2">
            {summary.securityFindings.slice(0, 5).map((f) => (
              <SecurityRow key={f.id} f={f} />
            ))}
          </ul>
        </Section>
      )}

      {summary.secrets.length > 0 && (
        <Section title="Highest-severity secrets">
          <SecretsTable findings={summary.secrets.slice(0, 5)} />
        </Section>
      )}

      <Section title="Where the app calls home">
        {summary.endpoints.length === 0 ? (
          <Empty text="No URLs found in DEX or resources." />
        ) : (
          <ul className="space-y-1.5">
            {summary.endpoints.slice(0, 8).map((e) => (
              <li
                key={e.url}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface/40 px-3 py-1.5"
              >
                <span className="truncate font-mono text-2xs">
                  <span
                    className={cn(
                      'mr-2 inline-block w-12 rounded px-1 text-center text-[10px] uppercase',
                      e.insecure ? 'bg-destructive/20 text-destructive' : 'bg-success/20 text-success'
                    )}
                  >
                    {e.scheme}
                  </span>
                  {e.host}
                  {e.path}
                </span>
                <SendToRepeaterButton url={e.url} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

function IntelligencePanel({ summary }: { summary: ApkAnalysisSummary }): JSX.Element {
  const technologiesByCategory = groupBy(summary.technologies, (item) => item.category)
  return (
    <div className="space-y-4 p-4">
      <Section title="Hardening posture">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-2xs uppercase tracking-wider text-muted-foreground">
                Hardening score
              </span>
              <Badge
                variant={
                  summary.hardening.score >= 70
                    ? 'success'
                    : summary.hardening.score >= 45
                      ? 'warning'
                      : 'destructive'
                }
              >
                {summary.hardening.score}/100
              </Badge>
            </div>
            <div className="mt-3">
              <Progress value={summary.hardening.score} />
            </div>
            {summary.hardening.notes.length > 0 && (
              <ul className="mt-3 space-y-1 text-2xs text-muted-foreground">
                {summary.hardening.notes.slice(0, 6).map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            )}
          </div>
          <HardeningFlags summary={summary} />
          <PrivacySignals signals={summary.privacySignals} />
        </div>
      </Section>

      <Section title={`Technology fingerprints (${summary.technologies.length})`}>
        {summary.technologies.length === 0 ? (
          <Empty text="No recognizable SDK or framework fingerprints were found." />
        ) : (
          <div className="space-y-3">
            {[...technologiesByCategory.entries()].map(([category, items]) => (
              <div key={category}>
                <div className="mb-1 text-2xs uppercase tracking-wider text-muted-foreground">
                  {category}
                </div>
                <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {items.map((item) => (
                    <TechnologyRow key={item.id} item={item} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

function HardeningFlags({ summary }: { summary: ApkAnalysisSummary }): JSX.Element {
  const flags = [
    ['Debug safe', summary.hardening.debugSafe],
    ['Backup safe', summary.hardening.backupSafe],
    ['Cleartext safe', summary.hardening.cleartextSafe],
    ['Certificate pinning', summary.hardening.certificatePinning],
    ['Root detection', summary.hardening.rootDetection],
    ['Play Integrity', summary.hardening.playIntegrity],
    ['Anti-tamper', summary.hardening.antiTamper],
    ['Obfuscation', summary.hardening.obfuscated],
    ['Native code', summary.hardening.nativeCode]
  ] as const
  return (
    <div className="rounded-xl border border-border bg-surface/40 p-3">
      <div className="mb-2 text-2xs uppercase tracking-wider text-muted-foreground">
        Signals
      </div>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {flags.map(([label, enabled]) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-md border border-border bg-surface/40 px-2 py-1 text-2xs"
          >
            <span>{label}</span>
            <Badge variant={enabled ? 'success' : 'muted'}>{enabled ? 'yes' : 'no'}</Badge>
          </div>
        ))}
      </div>
    </div>
  )
}

function PrivacySignals({ signals }: { signals: ApkPrivacySignal[] }): JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-surface/40 p-3">
      <div className="mb-2 text-2xs uppercase tracking-wider text-muted-foreground">
        Privacy signals
      </div>
      {signals.length === 0 ? (
        <Empty text="No strong privacy signals were detected." />
      ) : (
        <ul className="space-y-1.5">
          {signals.slice(0, 5).map((signal) => (
            <li key={signal.id} className="rounded-md border border-border bg-surface/40 p-2">
              <div className="flex items-center gap-2">
                <SeverityChip severity={signal.severity} />
                <span className="text-2xs font-medium">{signal.label}</span>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">{signal.detail}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TechnologyRow({ item }: { item: ApkTechnologyFinding }): JSX.Element {
  return (
    <li className="rounded-md border border-border bg-surface/40 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium">{item.name}</span>
        <div className="flex items-center gap-1">
          {item.risk && <SeverityChip severity={item.risk} />}
          <Badge variant="muted">{item.confidence}</Badge>
        </div>
      </div>
      {item.note && <div className="mt-1 text-[11px] text-muted-foreground">{item.note}</div>}
      <div className="mt-1 truncate font-mono text-[10px] text-foreground/60">
        {item.evidence.join(' | ')}
      </div>
    </li>
  )
}

function AttackSurfacePanel({ summary }: { summary: ApkAnalysisSummary }): JSX.Element {
  if (summary.attackSurface.length === 0) {
    return (
      <div className="p-4">
        <Empty text="No exported or externally reachable entry points were detected." />
      </div>
    )
  }
  const grouped = groupBy(summary.attackSurface, (item) => item.type)
  return (
    <div className="space-y-4 p-4">
      {[...grouped.entries()].map(([type, items]) => (
        <Section key={type} title={`${type} (${items.length})`}>
          <ul className="space-y-2">
            {items.map((item) => (
              <AttackSurfaceRow key={item.id} item={item} />
            ))}
          </ul>
        </Section>
      ))}
    </div>
  )
}

function AttackSurfaceRow({ item }: { item: ApkAttackSurfaceItem }): JSX.Element {
  return (
    <li className="rounded-xl border border-border bg-surface/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityChip severity={item.severity} />
        <span className="truncate font-mono text-2xs">{item.name}</span>
        {item.exported && <Badge variant={item.permission ? 'success' : 'warning'}>exported</Badge>}
        {item.permission && <Badge variant="muted">{item.permission.split('.').pop()}</Badge>}
      </div>
      <p className="mt-1.5 text-2xs leading-relaxed text-muted-foreground">{item.reason}</p>
      {item.actions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {item.actions.slice(0, 8).map((action) => (
            <span
              key={action}
              className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
            >
              {action.replace('android.intent.action.', '')}
            </span>
          ))}
        </div>
      )}
      {item.deepLinks.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {item.deepLinks.slice(0, 3).map((link) => (
            <div key={link} className="truncate font-mono text-[11px] text-foreground/80">
              {link}
            </div>
          ))}
        </div>
      )}
      {item.authorities && (
        <div className="mt-2 font-mono text-[11px] text-muted-foreground">
          authority: {item.authorities}
        </div>
      )}
      {item.testCommand && (
        <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1">
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
            {item.testCommand}
          </span>
          <CopyButton text={item.testCommand} />
        </div>
      )}
    </li>
  )
}

function NetworkPanel({ summary }: { summary: ApkAnalysisSummary }): JSX.Element {
  const net = summary.networkSecurity
  return (
    <div className="space-y-4 p-4">
      <Section title="Network Security Config">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Stat icon={Globe} label="Config" value={net.present ? 'present' : 'none'} />
          <Stat
            icon={AlertTriangle}
            label="Cleartext base"
            value={
              net.baseCleartextTrafficPermitted === true
                ? 'allowed'
                : net.baseCleartextTrafficPermitted === false
                  ? 'blocked'
                  : 'default'
            }
            highlight={net.baseCleartextTrafficPermitted === true}
          />
          <Stat
            icon={Lock}
            label="User CAs"
            value={net.trustsUserCertificates ? 'trusted' : 'not trusted'}
            highlight={net.trustsUserCertificates}
          />
          <Stat
            icon={ShieldCheck}
            label="Pinning"
            value={net.certificatePinning ? 'detected' : 'not found'}
          />
        </div>
        {net.source && (
          <div className="mt-3 rounded-md border border-border bg-surface/40 px-3 py-2 font-mono text-2xs text-muted-foreground">
            {net.source}
          </div>
        )}
      </Section>

      {net.findings.length > 0 && (
        <Section title="Network findings">
          <ul className="space-y-2">
            {net.findings.map((finding) => (
              <SecurityRow key={finding.id} f={finding} />
            ))}
          </ul>
        </Section>
      )}

      <Section title={`Domain rules (${net.domains.length})`}>
        {net.domains.length === 0 ? (
          <Empty text="No domain-config entries were parsed." />
        ) : (
          <ul className="space-y-2">
            {net.domains.map((domain) => (
              <li
                key={domain.domain}
                className="rounded-md border border-border bg-surface/40 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-2xs">{domain.domain}</span>
                  {domain.includeSubdomains && <Badge variant="muted">subdomains</Badge>}
                  {domain.cleartextTrafficPermitted === true && (
                    <Badge variant="destructive">cleartext</Badge>
                  )}
                  {domain.pinSet && <Badge variant="success">pinned</Badge>}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  trust anchors:{' '}
                  {domain.trustAnchors.length > 0
                    ? domain.trustAnchors.join(', ')
                    : 'platform default'}
                </div>
                {domain.pinSet && (
                  <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                    pins: {domain.pinSet.pins.length}
                    {domain.pinSet.expiration ? `, expires ${domain.pinSet.expiration}` : ''}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

function InventoryPanel({ summary }: { summary: ApkAnalysisSummary }): JSX.Element {
  const inv = summary.fileInventory
  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Stat icon={FileBox} label="Entries" value={inv.totalEntries} />
        <Stat icon={Package} label="Uncompressed" value={formatBytes(inv.totalUncompressedBytes)} />
        <Stat icon={Package} label="Compressed" value={formatBytes(inv.totalCompressedBytes)} />
        <Stat icon={Layers} label="Compression" value={`${Math.round(inv.compressionRatio * 100)}%`} />
      </div>
      {summary.bundle.analyzedEntry && (
        <div className="rounded-md border border-border bg-surface/40 px-3 py-2 text-2xs text-muted-foreground">
          Showing inventory for{' '}
          <span className="font-mono text-foreground">{summary.bundle.analyzedEntry}</span> from{' '}
          <span className="font-mono text-foreground">{packageFormatLabel(summary)}</span>.
        </div>
      )}
      <Section title="Composition">
        <ul className="space-y-1.5">
          {inv.categories.map((category) => (
            <li
              key={category.id}
              className="grid grid-cols-12 items-center gap-2 rounded-md border border-border bg-surface/40 px-3 py-2 text-2xs"
            >
              <span className="col-span-5 truncate">{category.label}</span>
              <span className="col-span-2 font-mono text-muted-foreground">{category.count}</span>
              <span className="col-span-3 font-mono text-muted-foreground">{formatBytes(category.size)}</span>
              <div className="col-span-2">
                <Progress
                  value={Math.min(
                    100,
                    (category.size / Math.max(1, inv.totalUncompressedBytes)) * 100
                  )}
                />
              </div>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Largest files">
        <ul className="space-y-1">
          {inv.largestFiles.map((file) => (
            <li
              key={file.path}
              className="flex items-center justify-between gap-3 rounded-md px-2 py-1 hover:bg-surface-raised/60"
            >
              <span className="truncate font-mono text-2xs">{file.path}</span>
              <span className="shrink-0 font-mono text-2xs text-muted-foreground">
                {formatBytes(file.size)}
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  highlight = false
}: {
  icon: typeof Shield
  label: string
  value: number | string
  highlight?: boolean
}): JSX.Element {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border bg-surface/40 p-3',
        highlight ? 'border-destructive/40' : 'border-border'
      )}
    >
      <Icon className={cn('h-5 w-5', highlight ? 'text-destructive' : 'text-muted-foreground')} />
      <div>
        <div className="text-2xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold">{value}</div>
      </div>
    </div>
  )
}

function Section({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <section className="rounded-xl border border-border bg-surface/30 p-4">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  )
}

function Empty({ text }: { text: string }): JSX.Element {
  return <div className="text-xs italic text-muted-foreground">{text}</div>
}

function ManifestPanel({ summary }: { summary: ApkAnalysisSummary }): JSX.Element {
  return (
    <div className="h-full overflow-auto p-4">
      <pre className="whitespace-pre-wrap break-all rounded-md border border-border bg-surface/40 p-3 font-mono text-2xs text-foreground">
        {summary.manifestXml}
      </pre>
    </div>
  )
}

function PermissionsPanel({ summary }: { summary: ApkAnalysisSummary }): JSX.Element {
  const grouped = useMemo(() => groupPermissions(summary.permissions), [summary.permissions])
  return (
    <div className="space-y-4 p-4">
      {(['dangerous', 'signature', 'normal', 'custom'] as const).map((cat) => {
        const list = grouped[cat]
        if (list.length === 0) return null
        return (
          <Section key={cat} title={`${cat[0]!.toUpperCase()}${cat.slice(1)} (${list.length})`}>
            <ul className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
              {list.map((p) => (
                <li
                  key={p}
                  className="rounded-md border border-border bg-surface/40 px-2 py-1.5 font-mono text-2xs"
                >
                  {p}
                </li>
              ))}
            </ul>
          </Section>
        )
      })}
      {summary.declaredPermissions.length > 0 && (
        <Section title={`Declared permissions (${summary.declaredPermissions.length})`}>
          <ul className="space-y-1">
            {summary.declaredPermissions.map((d) => (
              <li
                key={d.name}
                className="flex items-center justify-between rounded-md border border-border bg-surface/40 px-2 py-1.5 text-2xs"
              >
                <span className="font-mono">{d.name}</span>
                <Badge
                  variant={
                    (d.protectionLevel ?? 'normal') === 'signature' ? 'success' : 'warning'
                  }
                >
                  {d.protectionLevel ?? 'normal'}
                </Badge>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}

function ComponentsPanel({ summary }: { summary: ApkAnalysisSummary }): JSX.Element {
  return (
    <div className="space-y-4 p-4">
      <ComponentGroup title="Activities" items={summary.components.activities} />
      <ComponentGroup title="Services" items={summary.components.services} />
      <ComponentGroup title="Broadcast receivers" items={summary.components.receivers} />
      <ComponentGroup title="Content providers" items={summary.components.providers} />
      {summary.deepLinks.length > 0 && (
        <Section title={`Deep links (${summary.deepLinks.length})`}>
          <ul className="space-y-1">
            {summary.deepLinks.map((d, i) => (
              <li
                key={`${d.example}-${i}`}
                className="flex items-center justify-between rounded-md border border-border bg-surface/40 px-3 py-1.5 font-mono text-2xs"
              >
                <span className="truncate">{d.example}</span>
                <CopyButton text={d.example} />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}

function ComponentGroup({
  title,
  items
}: {
  title: string
  items: ApkComponentSummary[]
}): JSX.Element {
  if (items.length === 0) return <></>
  return (
    <Section title={`${title} (${items.length})`}>
      <ul className="space-y-1.5">
        {items.map((c) => (
          <li
            key={c.name}
            className="rounded-md border border-border bg-surface/40 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span className="truncate font-mono text-2xs">{c.name}</span>
              {c.exported && (
                <Badge variant={c.permission ? 'success' : 'warning'}>
                  exported{c.permission ? ` · ${c.permission.split('.').pop()}` : ''}
                </Badge>
              )}
              {!c.exported && c.exportedExplicit && (
                <Badge variant="muted">not exported</Badge>
              )}
            </div>
            {c.actions.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {c.actions.slice(0, 6).map((a) => (
                  <span
                    key={a}
                    className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                  >
                    {a.replace('android.intent.action.', '')}
                  </span>
                ))}
                {c.actions.length > 6 && (
                  <span className="text-[10px] text-muted-foreground">
                    +{c.actions.length - 6} more
                  </span>
                )}
              </div>
            )}
            {c.deepLinks.length > 0 && (
              <div className="mt-1 space-y-0.5 font-mono text-[11px] text-foreground/90">
                {c.deepLinks.slice(0, 3).map((d, i) => (
                  <div key={`${d}-${i}`}>{d}</div>
                ))}
                {c.deepLinks.length > 3 && (
                  <div className="text-[11px] text-muted-foreground">
                    + {c.deepLinks.length - 3} more
                  </div>
                )}
              </div>
            )}
            {c.authorities && (
              <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                authorities: {c.authorities}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Section>
  )
}

function SecurityPanel({ findings }: { findings: SecurityFinding[] }): JSX.Element {
  if (findings.length === 0) {
    return (
      <div className="p-4">
        <Empty text="No security findings — the manifest looks tight." />
      </div>
    )
  }
  return (
    <ul className="space-y-2 p-4">
      {findings.map((f) => (
        <SecurityRow key={f.id} f={f} />
      ))}
    </ul>
  )
}

function SecurityRow({ f }: { f: SecurityFinding }): JSX.Element {
  return (
    <li
      className={cn(
        'rounded-xl border bg-surface/40 p-3',
        f.severity === 'critical' || f.severity === 'high'
          ? 'border-destructive/40'
          : f.severity === 'medium'
            ? 'border-warning/40'
            : 'border-border'
      )}
    >
      <div className="flex items-center gap-2">
        <SeverityChip severity={f.severity} />
        <span className="text-sm font-medium">{f.title}</span>
      </div>
      <p className="mt-1.5 text-2xs leading-relaxed text-muted-foreground">{f.detail}</p>
      <p className="mt-1.5 text-2xs leading-relaxed">
        <span className="font-semibold text-foreground">Fix:</span>{' '}
        <span className="text-muted-foreground">{f.remediation}</span>
      </p>
    </li>
  )
}

function SeverityChip({ severity }: { severity: SecretFinding['severity'] }): JSX.Element {
  const cls =
    severity === 'critical'
      ? 'border-destructive/40 bg-destructive/15 text-destructive'
      : severity === 'high'
        ? 'border-destructive/40 bg-destructive/10 text-destructive'
        : severity === 'medium'
          ? 'border-warning/40 bg-warning/15 text-warning'
          : severity === 'low'
            ? 'border-border bg-surface text-foreground'
            : 'border-border bg-surface text-muted-foreground'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider',
        cls
      )}
    >
      {severity}
    </span>
  )
}

function SecretsPanel({ summary }: { summary: ApkAnalysisSummary }): JSX.Element {
  const [showRules, setShowRules] = useState(false)
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {summary.secrets.length} finding{summary.secrets.length === 1 ? '' : 's'} across DEX
          strings &amp; resource files.
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowRules(!showRules)}>
          <Repeat className="h-3.5 w-3.5" /> {showRules ? 'Hide' : 'Show'} ruleset
        </Button>
      </div>
      {showRules && <PatternCatalog />}
      {summary.secrets.length === 0 ? (
        <Empty text="No secrets matched — either this APK is genuinely clean or its strings are heavily obfuscated. Open it in the JADX Workbench for deeper source coverage." />
      ) : (
        <SecretsTable findings={summary.secrets} />
      )}
    </div>
  )
}

function PatternCatalog(): JSX.Element {
  const [patterns, setPatterns] = useState<
    { id: string; label: string; description: string; severity: string; regex: string }[]
  >([])
  useEffect(() => {
    let cancelled = false
    void window.api.apk.listPatterns().then((r) => {
      if (!cancelled && r.ok) setPatterns(r.value)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return (
    <div className="rounded-xl border border-border bg-surface/30 p-3">
      <div className="mb-2 text-2xs uppercase tracking-wider text-muted-foreground">
        Built-in patterns ({patterns.length})
      </div>
      <ul className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
        {patterns.map((p) => (
          <li
            key={p.id}
            className="flex items-start gap-2 rounded-md border border-border bg-surface/40 px-2 py-1.5 text-2xs"
          >
            <SeverityChip severity={p.severity as SecretFinding['severity']} />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{p.label}</div>
              <div className="text-muted-foreground">{p.description}</div>
              <div className="mt-0.5 truncate font-mono text-[10px] text-foreground/60">
                {p.regex}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SecretsTable({ findings }: { findings: SecretFinding[] }): JSX.Element {
  return (
    <ul className="space-y-1.5">
      {findings.map((f, i) => (
        <li
          key={`${f.patternId}-${i}`}
          className="rounded-md border border-border bg-surface/40 px-3 py-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <SeverityChip severity={f.severity} />
              <span className="text-2xs font-medium">{f.patternLabel}</span>
            </div>
            <CopyButton text={f.value} />
          </div>
          <div className="mt-1 break-all font-mono text-[11px] text-foreground">{f.value}</div>
          <div className="mt-1 truncate text-[11px] text-muted-foreground">
            <span className="font-mono">{f.source}</span>:{f.line} —{' '}
            <span className="italic">{f.context}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}

function EndpointsPanel({ summary }: { summary: ApkAnalysisSummary }): JSX.Element {
  const grouped = useMemo(() => {
    const byHost = new Map<string, EndpointFinding[]>()
    for (const e of summary.endpoints) {
      const list = byHost.get(e.host) ?? []
      list.push(e)
      byHost.set(e.host, list)
    }
    return [...byHost.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [summary.endpoints])

  if (summary.endpoints.length === 0) {
    return (
      <div className="p-4">
        <Empty text="No URLs found. Either the app generates them at runtime, or strings are heavily obfuscated." />
      </div>
    )
  }
  return (
    <div className="space-y-3 p-4">
      {grouped.map(([host, list]) => (
        <div key={host} className="rounded-xl border border-border bg-surface/30 p-3">
          <div className="mb-2 flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 text-primary" />
            <span className="text-sm font-medium">{host}</span>
            <Badge variant="muted">{list.length} URL{list.length === 1 ? '' : 's'}</Badge>
            {list.some((e) => e.insecure) && (
              <Badge variant="destructive">cleartext</Badge>
            )}
          </div>
          <ul className="space-y-0.5">
            {list.map((e) => (
              <li
                key={e.url}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-surface-raised/60"
              >
                <span className="truncate font-mono text-2xs">
                  <span
                    className={cn(
                      'mr-2 inline-block w-12 rounded px-1 text-center text-[10px] uppercase',
                      e.insecure ? 'bg-destructive/20 text-destructive' : 'bg-success/20 text-success'
                    )}
                  >
                    {e.scheme}
                  </span>
                  {e.path || '/'}
                </span>
                <div className="flex items-center gap-1">
                  <CopyButton text={e.url} />
                  <SendToRepeaterButton url={e.url} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function TrackersPanel({ trackers }: { trackers: TrackerFinding[] }): JSX.Element {
  if (trackers.length === 0) {
    return (
      <div className="p-4">
        <Empty text="No trackers or known SDKs detected. (Or the package names were obfuscated past recognition.)" />
      </div>
    )
  }
  const grouped = new Map<string, TrackerFinding[]>()
  for (const t of trackers) {
    const list = grouped.get(t.category) ?? []
    list.push(t)
    grouped.set(t.category, list)
  }
  return (
    <div className="space-y-3 p-4">
      {[...grouped.entries()].map(([cat, list]) => (
        <Section key={cat} title={`${cat} (${list.length})`}>
          <ul className="space-y-1">
            {list.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-md border border-border bg-surface/40 px-3 py-1.5"
              >
                <span className="text-xs">{t.name}</span>
                {t.url && (
                  <a
                    href={t.url}
                    onClick={(e) => {
                      e.preventDefault()
                      void window.api.app.openExternal(t.url!)
                    }}
                    className="flex items-center gap-1 text-2xs text-primary hover:underline"
                  >
                    docs <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </Section>
      ))}
    </div>
  )
}

function NativeLibsPanel({ summary }: { summary: ApkAnalysisSummary }): JSX.Element {
  if (summary.nativeLibraries.length === 0) {
    return (
      <div className="p-4">
        <Empty text="No native libraries — the app is pure Java/Kotlin." />
      </div>
    )
  }
  return (
    <div className="space-y-3 p-4">
      {summary.nativeLibraries.map((nl) => (
        <Section key={nl.abi} title={`${nl.abi} · ${nl.files.length} .so file(s)`}>
          <ul className="space-y-1.5">
            {nl.files.map((f) => (
              <li
                key={f.name}
                className="rounded-md border border-border bg-surface/40 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-mono text-2xs">{f.name}</span>
                  <span className="font-mono text-2xs text-muted-foreground">
                    {formatBytes(f.size)}
                  </span>
                </div>
                {(f.riskTags?.length || f.symbols?.length) && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(f.riskTags ?? []).map((tag) => (
                      <Badge key={tag} variant="warning">
                        {tag}
                      </Badge>
                    ))}
                    {(f.symbols ?? []).slice(0, 5).map((symbol) => (
                      <span
                        key={symbol}
                        className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                      >
                        {symbol}
                      </span>
                    ))}
                  </div>
                )}
                {f.sha256 && (
                  <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                    <span className="truncate">sha256 {f.sha256}</span>
                    <CopyButton text={f.sha256} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Section>
      ))}
    </div>
  )
}

function StringsPanel({ summary }: { summary: ApkAnalysisSummary }): JSX.Element {
  const [filter, setFilter] = useState('')
  const filtered = useMemo(() => {
    if (!filter.trim()) return summary.stringsSample
    const q = filter.toLowerCase()
    return summary.stringsSample.filter((s) => s.toLowerCase().includes(q))
  }, [summary.stringsSample, filter])
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-surface/20 px-3 text-2xs">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={`Filter ${summary.stringsSample.length} strings…`}
          className="h-7 flex-1 rounded-md border border-border bg-surface px-2 font-mono text-2xs text-foreground outline-none focus:border-primary"
        />
      </div>
      <ul className="min-h-0 flex-1 overflow-auto px-3 py-2 font-mono text-2xs">
        {filtered.map((s, i) => (
          <li key={`${i}-${s.slice(0, 30)}`} className="truncate py-0.5 hover:bg-surface-raised/40">
            {s}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ----- Small helpers ---------------------------------------------------

function CopyButton({ text }: { text: string }): JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
          onClick={() => {
            navigator.clipboard.writeText(text)
            toast.success('Copied', { duration: 1200 })
          }}
        >
          <Copy className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">Copy</TooltipContent>
    </Tooltip>
  )
}

function SendToRepeaterButton({ url }: { url: string }): JSX.Element {
  const setActiveTool = useUIStore((s) => s.setActiveTool)
  const importFromUrl = useRepeaterStore((s) => s.importFromUrl)
  // Drive the import through the store directly. The store creates a
  // blank tab via IPC, patches it with the URL + default headers, and
  // persists in one round-trip — far more reliable than dispatching a
  // window event that the Repeater tab may not be mounted to receive.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-surface-raised hover:text-primary"
          onClick={async () => {
            try {
              await importFromUrl({ url })
              setActiveTool('repeater')
              toast.success('Sent to Repeater', { description: url })
            } catch (err) {
              toast.error('Send to Repeater failed', {
                description: err instanceof Error ? err.message : String(err)
              })
            }
          }}
        >
          <Send className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">Send to Repeater</TooltipContent>
    </Tooltip>
  )
}

function groupBy<T, K extends string>(items: T[], keyOf: (item: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>()
  for (const item of items) {
    const key = keyOf(item)
    const list = out.get(key) ?? []
    list.push(item)
    out.set(key, list)
  }
  return out
}

function packageFormatLabel(summary: ApkAnalysisSummary): string {
  const base = summary.bundle.format.toUpperCase()
  if (summary.bundle.splitCount <= 1) return base
  return `${base} (${summary.bundle.splitCount} APK splits)`
}

function groupPermissions(perms: string[]): Record<'dangerous' | 'signature' | 'normal' | 'custom', string[]> {
  const DANGEROUS = new Set([
    'android.permission.READ_CONTACTS',
    'android.permission.WRITE_CONTACTS',
    'android.permission.READ_SMS',
    'android.permission.SEND_SMS',
    'android.permission.READ_CALL_LOG',
    'android.permission.WRITE_CALL_LOG',
    'android.permission.PROCESS_OUTGOING_CALLS',
    'android.permission.READ_EXTERNAL_STORAGE',
    'android.permission.WRITE_EXTERNAL_STORAGE',
    'android.permission.MANAGE_EXTERNAL_STORAGE',
    'android.permission.ACCESS_FINE_LOCATION',
    'android.permission.ACCESS_COARSE_LOCATION',
    'android.permission.ACCESS_BACKGROUND_LOCATION',
    'android.permission.CAMERA',
    'android.permission.RECORD_AUDIO',
    'android.permission.READ_PHONE_STATE',
    'android.permission.READ_PHONE_NUMBERS',
    'android.permission.CALL_PHONE',
    'android.permission.GET_ACCOUNTS',
    'android.permission.SYSTEM_ALERT_WINDOW',
    'android.permission.QUERY_ALL_PACKAGES',
    'android.permission.BIND_ACCESSIBILITY_SERVICE',
    'android.permission.BIND_DEVICE_ADMIN',
    'android.permission.READ_PRIVILEGED_PHONE_STATE',
    'android.permission.WRITE_SETTINGS',
    'android.permission.WRITE_SECURE_SETTINGS',
    'android.permission.PACKAGE_USAGE_STATS'
  ])
  const SIGNATURE_PREFIXES = ['android.permission.BIND_', 'android.permission.MANAGE_']
  const out = { dangerous: [] as string[], signature: [] as string[], normal: [] as string[], custom: [] as string[] }
  for (const p of perms) {
    if (DANGEROUS.has(p)) out.dangerous.push(p)
    else if (!p.startsWith('android.permission.')) out.custom.push(p)
    else if (SIGNATURE_PREFIXES.some((pre) => p.startsWith(pre))) out.signature.push(p)
    else out.normal.push(p)
  }
  for (const key of Object.keys(out) as (keyof typeof out)[]) out[key].sort()
  return out
}

// `Cpu`, `Layers`, `ChevronRight`, `Trash2`, `CheckCircle2`, `FilePlus2` are imported above for future use; reference them once so eslint's "unused" rule doesn't fire.
void Cpu
void Layers
void ChevronRight
void Trash2
void CheckCircle2
void FilePlus2
