import {
  AlertTriangle,
  Download,
  Filter,
  FileJson2,
  KeyRound,
  Loader2,
  Network,
  Play,
  Search,
  ShieldCheck,
  ShieldOff,
  Square,
  Trash2,
  type LucideIcon
} from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from '@/components/ui/resizable'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { useCaInstallStore } from '@/stores/useCaInstallStore'
import { useProxyStore } from '@/stores/useProxyStore'
import { RequestList } from '../proxy/RequestList'
import { RequestDetail } from '../proxy/RequestDetail'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { classifyRequest, requestSignals } from '../proxy/requestIntel'
import { cn } from '@/lib/utils'

export function ProxyTab(): JSX.Element {
  const status = useProxyStore((s) => s.status)
  const requests = useProxyStore((s) => s.requests)
  const filters = useProxyStore((s) => s.filters)
  const setFilters = useProxyStore((s) => s.setFilters)
  const clearRequests = useProxyStore((s) => s.clearRequests)
  const hydrate = useProxyStore((s) => s.hydrate)
  const caResult = useCaInstallStore((s) => s.result)
  const caInflight = useCaInstallStore((s) => s.inflight)
  const openWizard = useCaInstallStore((s) => s.openWizard)
  const hydrateCa = useCaInstallStore((s) => s.hydrate)
  const reinstallCa = useCaInstallStore((s) => s.reinstall)

  useEffect(() => {
    void hydrate()
    void hydrateCa()
  }, [hydrate, hydrateCa])

  const isRunning = status.state === 'running'
  const isBusy = status.state === 'starting' || status.state === 'stopping'
  const stats = useMemo(() => {
    let api = 0
    let errors = 0
    let auth = 0
    for (const req of requests) {
      if (classifyRequest(req) === 'xhr') api++
      const signals = requestSignals(req)
      if (signals.some((s) => s.kind === 'error')) errors++
      if (signals.some((s) => s.kind === 'auth')) auth++
    }
    return { api, errors, auth }
  }, [requests])

  const toggle = async (): Promise<void> => {
    if (isRunning) {
      const res = await window.api.proxy.stop()
      if (!res.ok) toast.error('Failed to stop proxy', { description: res.error })
    } else {
      const res = await window.api.proxy.start()
      if (!res.ok) toast.error('Failed to start proxy', { description: res.error })
      else toast.success('mitmproxy listening on :' + status.port)
    }
  }

  const clear = async (): Promise<void> => {
    const res = await window.api.proxy.clearRequests()
    if (res.ok) clearRequests()
    else toast.error('Failed to clear', { description: res.error })
  }

  const exportHar = async (): Promise<void> => {
    const dest = await window.api.dialog.showSave({
      title: 'Export HAR',
      defaultPath: `mobsec-${new Date().toISOString().replace(/[:.]/g, '-')}.har`,
      filters: [
        { name: 'HAR archive', extensions: ['har'] },
        { name: 'JSON', extensions: ['json'] }
      ]
    })
    if (!dest.ok || !dest.value) return
    const res = await window.api.proxy.exportHar(dest.value)
    if (res.ok) toast.success('Exported', { description: dest.value })
    else toast.error('Export failed', { description: res.error })
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b border-border bg-surface/30 px-4 py-2">
        <Network className="h-4 w-4 text-primary" />
        <h1 className="text-sm font-semibold tracking-tight">Proxy</h1>
        <ProxyBadge status={status} />

        <div className="ml-3 flex h-7 min-w-56 max-w-lg flex-1 items-center gap-2 rounded-md border border-border bg-surface/60 px-2.5 text-xs">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            placeholder="Filter by host, path, method, or URL…"
            className="flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground/60"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => setFilters({ search: '' })}
              className="text-2xs text-muted-foreground hover:text-foreground"
            >
              clear
            </button>
          )}
        </div>

        <FilterDropdown />

        <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
          <CaInstallChip
            result={caResult}
            inflight={caInflight}
            onOpenWizard={openWizard}
            onReinstall={async () => {
              const r = await reinstallCa()
              if (r?.state === 'installed' || r?.state === 'already-installed') {
                toast.success(r.message)
              } else if (r?.state === 'user-action-required') {
                toast.info('Look at your phone — finish the install there.')
                openWizard()
              } else if (r?.state === 'error') {
                toast.error('CA install failed', { description: r.message })
                openWizard()
              }
            }}
          />
          <span className="font-mono text-2xs text-muted-foreground">
            {requests.length} captured
          </span>
          <div className="hidden items-center gap-1 xl:flex">
            <StatPill icon={FileJson2} label="API" value={stats.api} />
            <StatPill icon={AlertTriangle} label="Errors" value={stats.errors} hot={stats.errors > 0} />
            <StatPill icon={KeyRound} label="Auth" value={stats.auth} hot={stats.auth > 0} />
          </div>
          <Button variant="ghost" size="sm" onClick={() => void exportHar()} disabled={requests.length === 0}>
            <Download className="h-3.5 w-3.5" /> Export HAR
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void clear()} disabled={requests.length === 0}>
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </Button>
          <Button
            variant={isRunning ? 'outline' : 'default'}
            size="sm"
            disabled={isBusy}
            onClick={() => void toggle()}
          >
            {isRunning ? (
              <>
                <Square className="h-3 w-3" /> Stop
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" /> Start
              </>
            )}
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <ResizablePanelGroup direction="horizontal" autoSaveId="mobsec.proxy-split">
          <ResizablePanel defaultSize={55} minSize={30}>
            <RequestList />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={45} minSize={25}>
            <RequestDetail />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  )
}

function ProxyBadge({ status }: { status: ReturnType<typeof useProxyStore.getState>['status'] }): JSX.Element {
  if (status.state === 'running')
    return <Badge variant="success">Listening :{status.port}</Badge>
  if (status.state === 'starting') return <Badge variant="warning">Starting…</Badge>
  if (status.state === 'stopping') return <Badge variant="warning">Stopping…</Badge>
  if (status.state === 'error') return <Badge variant="destructive">Error</Badge>
  return <Badge variant="muted">Stopped</Badge>
}

function StatPill({
  icon: Icon,
  label,
  value,
  hot = false
}: {
  icon: LucideIcon
  label: string
  value: number
  hot?: boolean
}): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-1 rounded-md border px-2 font-mono text-2xs',
        hot
          ? 'border-warning/35 bg-warning/10 text-warning'
          : 'border-border bg-surface text-muted-foreground'
      )}
    >
      <Icon className="h-3 w-3" />
      {label} {value}
    </span>
  )
}

interface CaInstallChipProps {
  result: ReturnType<typeof useCaInstallStore.getState>['result']
  inflight: boolean
  onOpenWizard: () => void
  onReinstall: () => Promise<void>
}

/**
 * Compact health indicator for the device's CA trust. Three states the user
 * actually cares about:
 *   - 'installed' / 'already-installed' → green shield + click opens wizard
 *     so the user can re-verify or persist via Magisk.
 *   - 'user-action-required' → warning shield + tooltip nudges them to
 *     finish the install on the phone; click opens the wizard.
 *   - everything else (no proxy yet, error) → muted shield + click triggers
 *     a reinstall attempt; that emits the right state which auto-opens
 *     the wizard.
 */
function CaInstallChip({
  result,
  inflight,
  onOpenWizard,
  onReinstall
}: CaInstallChipProps): JSX.Element {
  const state = result?.state ?? null
  const installed = state === 'installed' || state === 'already-installed'
  const needsTap = state === 'user-action-required'
  const errored = state === 'error'

  const label = installed
    ? `CA · ${prettyPath(result?.path)}`
    : needsTap
      ? 'CA · finish on phone'
      : errored
        ? 'CA · failed'
        : 'CA · install'

  const variant = installed
    ? 'border-success/40 bg-success/10 text-success'
    : needsTap
      ? 'border-warning/40 bg-warning/10 text-warning'
      : errored
        ? 'border-destructive/40 bg-destructive/10 text-destructive'
        : 'border-border bg-surface text-muted-foreground'

  const handleClick = (): void => {
    if (installed || needsTap || errored) {
      onOpenWizard()
    } else {
      void onReinstall()
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleClick}
          disabled={inflight}
          className={cnChip(variant)}
        >
          {inflight ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : installed ? (
            <ShieldCheck className="h-3 w-3" />
          ) : (
            <ShieldOff className="h-3 w-3" />
          )}
          <span className="font-mono">{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[280px]">
        {installed
          ? 'CA cert installed. Click to open the wizard (verify or persist via Magisk).'
          : needsTap
            ? 'Cert was pushed and the installer activity launched — finish the install on your phone. Click for steps.'
            : errored
              ? 'CA install failed. Click for details and a retry button.'
              : 'No CA install yet. Click to run the install flow.'}
      </TooltipContent>
    </Tooltip>
  )
}

function prettyPath(path: string | undefined): string {
  if (path === 'system-store') return 'system'
  if (path === 'magisk-module') return 'magisk'
  if (path === 'user-store') return 'user'
  return 'pending'
}

function cnChip(variant: string): string {
  return `inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-2xs transition-colors disabled:opacity-60 ${variant}`
}

function FilterDropdown(): JSX.Element {
  const filters = useProxyStore((s) => s.filters)
  const setFilters = useProxyStore((s) => s.setFilters)
  const activeCount =
    (filters.method !== 'all' ? 1 : 0) +
    (filters.statusClass !== 'all' ? 1 : 0) +
    (filters.scheme !== 'all' ? 1 : 0) +
    (filters.resource !== 'all' ? 1 : 0) +
    (filters.signal !== 'all' ? 1 : 0)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <Filter className="h-3.5 w-3.5" />
          Filters
          {activeCount > 0 && (
            <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-2xs text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        <DropdownMenuLabel>Method</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={filters.method}
          onValueChange={(v) => setFilters({ method: v })}
        >
          {['all', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'CONNECT'].map((m) => (
            <DropdownMenuRadioItem key={m} value={m} className="font-mono text-xs">
              {m === 'all' ? 'All methods' : m}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Status</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={filters.statusClass}
          onValueChange={(v) => setFilters({ statusClass: v as typeof filters.statusClass })}
        >
          {(['all', '2xx', '3xx', '4xx', '5xx', 'pending'] as const).map((s) => (
            <DropdownMenuRadioItem key={s} value={s} className="font-mono text-xs">
              {s === 'all' ? 'All statuses' : s}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Scheme</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={filters.scheme}
          onValueChange={(v) => setFilters({ scheme: v as typeof filters.scheme })}
        >
          {(['all', 'http', 'https'] as const).map((s) => (
            <DropdownMenuRadioItem key={s} value={s} className="font-mono text-xs">
              {s === 'all' ? 'All schemes' : s}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Resource</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={filters.resource}
          onValueChange={(v) => setFilters({ resource: v as typeof filters.resource })}
        >
          {(['all', 'document', 'xhr', 'script', 'style', 'image', 'font', 'media', 'other'] as const).map((s) => (
            <DropdownMenuRadioItem key={s} value={s} className="font-mono text-xs">
              {s === 'all' ? 'All resources' : s}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Signals</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={filters.signal}
          onValueChange={(v) => setFilters({ signal: v as typeof filters.signal })}
        >
          {([
            ['all', 'All traffic'],
            ['interesting', 'Any signal'],
            ['auth', 'Auth material'],
            ['cookies', 'Cookies'],
            ['errors', 'Errors']
          ] as const).map(([value, label]) => (
            <DropdownMenuRadioItem key={value} value={value} className="font-mono text-xs">
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() =>
            setFilters({
              method: 'all',
              statusClass: 'all',
              scheme: 'all',
              resource: 'all',
              signal: 'all'
            })
          }
        >
          Reset filters
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
