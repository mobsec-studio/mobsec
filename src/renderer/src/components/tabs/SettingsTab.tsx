import {
  AlertTriangle,
  Box,
  CheckCircle2,
  Cpu,
  Database,
  Download,
  FolderOpen,
  HardDrive,
  Info,
  Loader2,
  Network,
  RefreshCw,
  ScrollText,
  Settings2,
  Smartphone,
  Wrench,
  type LucideIcon
} from 'lucide-react'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import type { ToolInfo, ToolInstallProgress } from '@shared/types'
import { DevicesManager } from '../devices/DevicesManager'
import { MobSecLogo } from '../MobSecLogo'
import { ProjectsManager } from '../ProjectsManager'
import { SdkSetupCard } from '../SdkSetupCard'
import { Button } from '../ui/button'
import { Progress } from '../ui/progress'
import { formatBytes } from '@/lib/utils'
import { useAppStore } from '@/stores/useAppStore'
import { selectActiveDevice, useDeviceStore } from '@/stores/useDeviceStore'
import { useEmulatorStore } from '@/stores/useEmulatorStore'
import { useFridaStore } from '@/stores/useFridaStore'
import { useLogcatStore } from '@/stores/useLogcatStore'
import { useProxyStore } from '@/stores/useProxyStore'
import { useToolchainStore } from '@/stores/useToolchainStore'
import { useUIStore, type SettingsSectionId } from '@/stores/useUIStore'

const SETTINGS_SECTIONS: Array<{
  id: SettingsSectionId
  label: string
  icon: LucideIcon
}> = [
  { id: 'overview', label: 'Overview', icon: Settings2 },
  { id: 'projects', label: 'Projects', icon: Database },
  { id: 'devices', label: 'Devices', icon: Smartphone },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'sdk', label: 'Android SDK', icon: Cpu },
  { id: 'about', label: 'About', icon: Info }
]

export function SettingsTab(): JSX.Element {
  const activeSection = useUIStore((s) => s.activeSettingsSection)
  const setActiveSection = useUIStore((s) => s.setActiveSettingsSection)
  const info = useAppStore((s) => s.info)
  const sdk = useEmulatorStore((s) => s.sdk)
  const hydrateEmulator = useEmulatorStore((s) => s.hydrate)
  const activeDevice = useDeviceStore(selectActiveDevice)
  const deviceCount = useDeviceStore((s) => s.devices.length)
  const hydrateDevices = useDeviceStore((s) => s.hydrate)
  const fridaStatus = useFridaStore((s) => s.status)
  const hydrateFrida = useFridaStore((s) => s.hydrate)
  const proxyStatus = useProxyStore((s) => s.status)
  const hydrateProxy = useProxyStore((s) => s.hydrate)
  const logcatStatus = useLogcatStore((s) => s.status)
  const hydrateLogcat = useLogcatStore((s) => s.hydrate)
  const tools = useToolchainStore((s) => s.tools)
  const progress = useToolchainStore((s) => s.progress)
  const loading = useToolchainStore((s) => s.loading)
  const hydrateTools = useToolchainStore((s) => s.hydrate)
  const install = useToolchainStore((s) => s.install)

  const toolsInstalled = tools.filter((tool) => tool.state === 'installed').length
  const toolsNeedAttention = tools.filter(
    (tool) => tool.state === 'error' || tool.state === 'unavailable'
  ).length
  const sdkReady = !!sdk && (sdk.hasPlatformTools || sdk.hasEmulator)
  const toolsDir = `${info?.userData ?? '~/AppData'}/tools`

  useEffect(() => {
    void hydrateTools()
    void hydrateDevices()
    void hydrateFrida()
    void hydrateProxy()
    void hydrateLogcat()
  }, [hydrateTools, hydrateDevices, hydrateFrida, hydrateProxy, hydrateLogcat])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border bg-surface/30 px-8 py-5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <Settings2 className="h-3.5 w-3.5" />
              Settings
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Workspace</h1>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Configure projects, devices, tool downloads, Android SDK paths, and local workspace
              metadata from dedicated panes.
            </p>
          </div>
          <div className="grid min-w-[16rem] grid-cols-2 gap-2 text-2xs">
            <MiniStatus
              label="Tools"
              value={`${toolsInstalled}/${tools.length || 0}`}
              tone={toolsNeedAttention > 0 ? 'danger' : toolsInstalled > 0 ? 'success' : 'muted'}
            />
            <MiniStatus
              label="SDK"
              value={sdkReady ? 'Ready' : 'Missing'}
              tone={sdkReady ? 'success' : 'danger'}
            />
          </div>
        </div>

        <nav className="mx-auto mt-5 flex max-w-6xl gap-2 overflow-x-auto pb-0.5">
          {SETTINGS_SECTIONS.map((section) => (
            <SettingsNavButton
              key={section.id}
              section={section}
              active={activeSection === section.id}
              onClick={() => setActiveSection(section.id)}
            />
          ))}
        </nav>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-8 py-6">
          {activeSection === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <HealthCell
                  icon={Smartphone}
                  label="Active device"
                  value={activeDevice ? activeDevice.label : 'No active device'}
                  detail={
                    activeDevice
                      ? `${activeDevice.serial} - ${activeDevice.abi ?? 'unknown ABI'}`
                      : `${deviceCount} detected`
                  }
                  tone={activeDevice?.state === 'online' ? 'success' : 'muted'}
                />
                <HealthCell
                  icon={Cpu}
                  label="Frida"
                  value={fridaStatus.state}
                  detail={
                    fridaStatus.serverVersion
                      ? `server ${fridaStatus.serverVersion}`
                      : 'instrumentation'
                  }
                  tone={
                    fridaStatus.state === 'connected'
                      ? 'success'
                      : fridaStatus.state === 'error'
                        ? 'danger'
                        : 'muted'
                  }
                />
                <HealthCell
                  icon={Network}
                  label="Proxy"
                  value={proxyStatus.state}
                  detail={proxyStatus.errorMessage ?? `port ${proxyStatus.port}`}
                  tone={
                    proxyStatus.state === 'running'
                      ? 'success'
                      : proxyStatus.state === 'error'
                        ? 'danger'
                        : 'muted'
                  }
                />
                <HealthCell
                  icon={ScrollText}
                  label="Logcat"
                  value={logcatStatus.running ? 'capturing' : 'idle'}
                  detail={
                    logcatStatus.errorMessage ??
                    (logcatStatus.serial
                      ? `${logcatStatus.serial} - ${logcatStatus.buffers.join(', ')}`
                      : 'no stream')
                  }
                  tone={
                    logcatStatus.running
                      ? 'success'
                      : logcatStatus.errorMessage
                        ? 'danger'
                        : 'muted'
                  }
                />
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <OverviewCard
                  icon={Database}
                  title="Projects"
                  detail="Manage capture scope, saved Frida scripts, repeater tabs, and project data."
                  onClick={() => setActiveSection('projects')}
                />
                <OverviewCard
                  icon={Smartphone}
                  title="Devices"
                  detail={`${deviceCount} detected target${deviceCount === 1 ? '' : 's'} available for emulator, USB, or wireless workflows.`}
                  onClick={() => setActiveSection('devices')}
                />
                <OverviewCard
                  icon={Wrench}
                  title="Tools"
                  detail={`${toolsInstalled} installed, ${toolsNeedAttention} need attention. Cached under ${toolsDir}.`}
                  onClick={() => setActiveSection('tools')}
                />
              </div>
            </div>
          )}

          {activeSection === 'projects' && <ProjectsManager />}

          {activeSection === 'devices' && <DevicesManager />}

          {activeSection === 'tools' && (
            <SettingsPanel
              title="External tools"
              description={
                <>
                  Downloaded once and cached under <span className="font-mono">{toolsDir}</span>.
                </>
              }
              action={
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={loading}
                    onClick={() => void hydrateTools()}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void window.api.toolchain.revealInstallDir()}
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    Open folder
                  </Button>
                </div>
              }
            >
              <div className="overflow-hidden rounded-lg border border-border">
                {tools.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                    {loading ? 'Scanning tools...' : 'No external tools detected.'}
                  </div>
                ) : (
                  tools.map((tool, i) => (
                    <ToolRow
                      key={tool.id}
                      tool={tool}
                      progress={progress[tool.id]}
                      first={i === 0}
                      onInstall={async () => {
                        try {
                          await install(tool.id)
                          toast.success(`${tool.label} installed`)
                          await hydrateEmulator()
                        } catch (err) {
                          toast.error(`Failed to install ${tool.label}`, {
                            description: err instanceof Error ? err.message : String(err)
                          })
                        }
                      }}
                    />
                  ))
                )}
              </div>
            </SettingsPanel>
          )}

          {activeSection === 'sdk' && (
            <SettingsPanel
              title="Android SDK"
              description="Platform tools, emulator binaries, and AVD management."
            >
              <div className="rounded-lg border border-border bg-surface/40 p-4">
                {sdkReady && sdk ? (
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <span className="text-foreground">SDK detected via {sdk.source}</span>
                    </div>
                    <div className="break-all font-mono text-2xs">{sdk.root}</div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <SdkBadge ok={sdk.hasPlatformTools} label="platform-tools" />
                      <SdkBadge ok={sdk.hasEmulator} label="emulator" />
                      <SdkBadge ok={sdk.hasAvdManager} label="avdmanager" />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 text-xs">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
                    <div className="space-y-1">
                      <div className="text-sm text-foreground">No Android SDK detected</div>
                      <p className="text-muted-foreground">
                        Either run the quick setup below, or install Android Studio and set{' '}
                        <span className="font-mono">ANDROID_HOME</span> manually.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <SdkSetupCard />
            </SettingsPanel>
          )}

          {activeSection === 'about' && (
            <div className="space-y-5">
              <SettingsPanel title="Storage" description="Local app data and cached tooling paths.">
                <div className="rounded-lg border border-border bg-surface/40 p-4">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface">
                      <HardDrive className="h-4 w-4 text-primary" />
                    </span>
                    <div className="min-w-0 space-y-1">
                      <div className="text-sm font-medium">Application data</div>
                      <div className="break-all font-mono text-xs text-muted-foreground">
                        {info?.userData ?? '--'}
                      </div>
                    </div>
                  </div>
                </div>
              </SettingsPanel>

              <SettingsPanel title="About" description="Build information and release channel.">
                <div className="rounded-lg border border-border bg-surface/40 p-6">
                  <div className="flex items-center gap-4">
                    <MobSecLogo size={52} />
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold tracking-tight">
                          MobSec Studio
                        </span>
                        <span className="rounded border border-warning/40 bg-warning/10 px-1.5 py-px font-mono text-2xs text-warning">
                          beta
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          v{info?.version ?? '0.1.0'}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Production-grade Android penetration testing platform. Intercept traffic,
                        bypass security controls, and instrument apps entirely locally.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-surface/40 p-4 text-xs text-muted-foreground">
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[9rem_1fr]">
                    <dt className="text-muted-foreground/70">Version</dt>
                    <dd className="font-mono text-foreground">{info?.version ?? '--'}</dd>

                    <dt className="text-muted-foreground/70">Channel</dt>
                    <dd>
                      <span className="rounded border border-warning/40 bg-warning/10 px-1.5 py-px font-mono text-2xs text-warning">
                        Public Beta
                      </span>
                    </dd>

                    <dt className="text-muted-foreground/70">Platform</dt>
                    <dd className="font-mono text-foreground">
                      {info ? `${info.platform} / ${info.arch}` : '--'}
                    </dd>

                    <dt className="text-muted-foreground/70">Electron</dt>
                    <dd className="font-mono text-foreground">
                      {info?.isPackaged ? 'packaged' : 'development'}
                    </dd>

                    <dt className="text-muted-foreground/70">Data directory</dt>
                    <dd className="break-all font-mono text-foreground/80">
                      {info?.userData ?? '--'}
                    </dd>
                  </dl>
                </div>

                <div className="rounded-lg border border-warning/20 bg-warning/5 px-4 py-3 text-xs leading-relaxed text-warning/80">
                  <span className="font-semibold text-warning">Beta software.</span> Features are
                  under active development. Workflows, data formats, and APIs may change between
                  releases. Use on dedicated test devices only.
                </div>
              </SettingsPanel>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface ToolRowProps {
  tool: ToolInfo
  progress: ToolInstallProgress | undefined
  first: boolean
  onInstall: () => Promise<void>
}

type HealthTone = 'success' | 'danger' | 'muted'

function SettingsNavButton({
  section,
  active,
  onClick
}: {
  section: (typeof SETTINGS_SECTIONS)[number]
  active: boolean
  onClick: () => void
}): JSX.Element {
  const Icon = section.icon
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-md border px-3 text-xs font-medium transition-colors ${
        active
          ? 'border-primary/50 bg-primary/10 text-primary'
          : 'border-border bg-surface/50 text-muted-foreground hover:bg-surface-raised hover:text-foreground'
      }`}
      aria-pressed={active}
    >
      <Icon className="h-3.5 w-3.5" />
      {section.label}
    </button>
  )
}

function MiniStatus({
  label,
  value,
  tone
}: {
  label: string
  value: string
  tone: HealthTone
}): JSX.Element {
  const toneClass =
    tone === 'success'
      ? 'border-success/30 bg-success/10 text-success'
      : tone === 'danger'
        ? 'border-destructive/30 bg-destructive/10 text-destructive'
        : 'border-border bg-surface text-muted-foreground'

  return (
    <div className={`rounded-md border px-3 py-2 ${toneClass}`}>
      <div className="uppercase tracking-[0.16em] opacity-70">{label}</div>
      <div className="mt-1 font-mono text-xs font-medium">{value}</div>
    </div>
  )
}

function SettingsPanel({
  title,
  description,
  action,
  children
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
  children: ReactNode
}): JSX.Element {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-medium">{title}</h2>
          {description && (
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function OverviewCard({
  icon: Icon,
  title,
  detail,
  onClick
}: {
  icon: LucideIcon
  title: string
  detail: string
  onClick: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-w-0 rounded-lg border border-border bg-surface/40 p-4 text-left transition-colors hover:bg-surface-raised"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{detail}</p>
    </button>
  )
}

function HealthCell({
  icon: Icon,
  label,
  value,
  detail,
  tone
}: {
  icon: LucideIcon
  label: string
  value: string
  detail: string
  tone: HealthTone
}): JSX.Element {
  const toneClass =
    tone === 'success'
      ? 'border-success/30 bg-success/10 text-success'
      : tone === 'danger'
        ? 'border-destructive/30 bg-destructive/10 text-destructive'
        : 'border-border bg-surface text-muted-foreground'

  return (
    <div className="min-w-0 rounded-lg border border-border bg-surface/40 p-3">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${toneClass}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <div className="text-2xs uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
          <div className="truncate text-sm font-medium text-foreground">{value}</div>
        </div>
      </div>
      <div className="mt-2 truncate font-mono text-2xs text-muted-foreground">{detail}</div>
    </div>
  )
}

function ToolRow({ tool, progress, first, onInstall }: ToolRowProps): JSX.Element {
  const isBusy =
    tool.state === 'queued' ||
    tool.state === 'downloading' ||
    tool.state === 'extracting' ||
    progress?.phase === 'queued' ||
    progress?.phase === 'downloading' ||
    progress?.phase === 'extracting'

  const installed = tool.state === 'installed'
  const unavailable = tool.state === 'unavailable'

  return (
    <div
      className={`flex flex-col gap-3 bg-surface/40 px-4 py-3 ${first ? '' : 'border-t border-border'}`}
    >
      <div className="flex items-center gap-3">
        <Box className={`h-4 w-4 ${installed ? 'text-success' : 'text-muted-foreground'}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{tool.label}</span>
            <ToolStateBadge state={tool.state} />
            {installed && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
            {tool.state === 'error' && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
          </div>
          <div className="truncate text-xs text-muted-foreground">{tool.description}</div>
          {tool.installPath && (
            <div className="mt-1 truncate font-mono text-2xs text-muted-foreground/70">
              {tool.installPath}
            </div>
          )}
          {unavailable && (
            <div className="mt-1 truncate text-2xs text-muted-foreground/80">{tool.source}</div>
          )}
          {tool.errorMessage && (
            <div className="mt-1 truncate text-2xs text-destructive">{tool.errorMessage}</div>
          )}
        </div>
        <Button
          variant={installed ? 'ghost' : 'outline'}
          size="sm"
          disabled={isBusy || unavailable}
          onClick={() => void onInstall()}
        >
          {isBusy ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Installing...
            </>
          ) : unavailable ? (
            <>
              <AlertTriangle className="h-3.5 w-3.5" /> Manual
            </>
          ) : installed ? (
            <>
              <Download className="h-3.5 w-3.5" /> Reinstall
            </>
          ) : (
            <>
              <Download className="h-3.5 w-3.5" /> Install
            </>
          )}
        </Button>
      </div>

      {(isBusy || progress?.phase === 'downloading' || progress?.phase === 'extracting') &&
        progress && (
          <div className="space-y-1.5 pl-7">
            <div className="flex items-center justify-between text-2xs text-muted-foreground">
              <span className="uppercase tracking-wider">{progress.phase}</span>
              <span>
                {progress.bytesTotal > 0
                  ? `${formatBytes(progress.bytesReceived)} / ${formatBytes(progress.bytesTotal)}`
                  : formatBytes(progress.bytesReceived)}
              </span>
            </div>
            <Progress
              value={
                progress.bytesTotal > 0 ? (progress.bytesReceived / progress.bytesTotal) * 100 : 0
              }
              indeterminate={progress.phase === 'extracting' || progress.bytesTotal === 0}
            />
          </div>
        )}
    </div>
  )
}

function ToolStateBadge({ state }: { state: ToolInfo['state'] }): JSX.Element {
  const className =
    state === 'installed'
      ? 'border-success/30 bg-success/10 text-success'
      : state === 'error'
        ? 'border-destructive/30 bg-destructive/10 text-destructive'
        : state === 'unavailable'
          ? 'border-warning/30 bg-warning/10 text-warning'
          : 'border-border bg-surface text-muted-foreground'

  return (
    <span className={`rounded border px-1.5 py-px font-mono text-2xs ${className}`}>{state}</span>
  )
}

function SdkBadge({ ok, label }: { ok: boolean; label: string }): JSX.Element {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-2xs ${
        ok
          ? 'border-success/30 bg-success/10 text-success'
          : 'border-border bg-surface text-muted-foreground'
      }`}
    >
      {ok ? <CheckCircle2 className="h-2.5 w-2.5" /> : null}
      <span className="font-mono">{label}</span>
    </span>
  )
}
