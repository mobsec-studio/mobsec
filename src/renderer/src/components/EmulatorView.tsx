import {
  ArrowLeft,
  Check,
  ChevronDown,
  Circle,
  MoreVertical,
  Power,
  RefreshCw,
  RotateCw,
  Smartphone,
  Square,
  Usb,
  Volume2,
  VolumeX,
  Wifi
} from 'lucide-react'
import type { Device } from '@shared/types'
import { motion } from 'framer-motion'
import { useEmulatorStore } from '@/stores/useEmulatorStore'
import { useUIStore } from '@/stores/useUIStore'
import { useMirrorStore } from '@/stores/useMirrorStore'
import { selectActiveDevice, useDeviceStore } from '@/stores/useDeviceStore'
import { EmulatorMirror } from './EmulatorMirror'
import { Button } from './ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { cn } from '@/lib/utils'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './ui/dropdown-menu'
import { toast } from 'sonner'

export function EmulatorView(): JSX.Element {
  const status = useEmulatorStore((s) => s.status)
  const avds = useEmulatorStore((s) => s.avds)
  const selectedAvd = useEmulatorStore((s) => s.selectedAvd)
  const sdk = useEmulatorStore((s) => s.sdk)
  const bootProgress = useEmulatorStore((s) => s.bootProgress)
  const start = useEmulatorStore((s) => s.start)
  const restart = useEmulatorStore((s) => s.restart)
  const stop = useEmulatorStore((s) => s.stop)
  const selectAvd = useEmulatorStore((s) => s.selectAvd)
  const refreshAvds = useEmulatorStore((s) => s.refreshAvds)

  const mirror = useMirrorStore((s) => s.status)
  const mirrorState = mirror.state
  const activeDevice = useDeviceStore(selectActiveDevice)
  const allDevices = useDeviceStore((s) => s.devices)
  const setActiveDevice = useDeviceStore((s) => s.setActive)
  const onlineDevices = allDevices.filter((d) => d.state === 'online')
  const showSwitcher = onlineDevices.length > 1

  // We render this view for *any* online active device — the embedded
  // emulator is just one transport. When a USB/WiFi device is the active
  // target we surface its mirror here too, and the emulator-specific
  // controls (Start/Restart/Stop AVD, AVD picker) disable themselves.
  const isLive = status.state === 'running'
  const deviceOnline = !!activeDevice && activeDevice.state === 'online'
  const realDeviceActive = deviceOnline && activeDevice?.transport !== 'emulator'
  const isBusy =
    status.state === 'starting' || status.state === 'booting' || status.state === 'stopping'
  const sdkMissing = !sdk || (!sdk.hasPlatformTools && !sdk.hasEmulator)
  // Show the mirror whenever the active device is online — independent of
  // whether the *emulator* is up. Mirror state may be 'connecting' for a
  // few seconds during the scrcpy handshake; we render the canvas through
  // that too so the user sees something happening.
  const showMirror =
    (isLive || realDeviceActive) && (mirrorState === 'running' || mirrorState === 'connecting')

  const handleStart = async (): Promise<void> => {
    try {
      await start()
    } catch (err) {
      toast.error('Failed to start emulator', {
        description: err instanceof Error ? err.message : String(err)
      })
    }
  }

  const handleKey = async (key: string, label: string): Promise<void> => {
    const res = await window.api.device.sendKey(key)
    if (!res.ok) {
      toast.error(`${label} failed`, {
        description: res.error
      })
    }
  }

  return (
    <section className="flex h-full flex-col bg-surface/30">
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex min-w-0 items-center gap-2">
          {/* Transport-aware icon + label. When more than one device is online
              we render the label as a dropdown so the user can switch what
              this panel is mirroring without going up to the title bar. */}
          <DeviceHeaderLabel
            activeDevice={activeDevice}
            emulatorState={status.state}
            online={onlineDevices}
            showSwitcher={showSwitcher}
            onPick={(serial) => void setActiveDevice(serial)}
          />
          {realDeviceActive ? (
            <Badge variant="success">Live</Badge>
          ) : (
            <EmulatorBadge state={status.state} />
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Emulator-specific controls only when the active device IS the
              emulator (or no device active yet, so we're still in
              "boot the emulator" mode). Real devices hide these entirely
              since "Start emulator" or "Pick AVD" don't apply to them. */}
          {!realDeviceActive && (
            <>
              <AvdPicker
                avds={avds.map((a) => a.name)}
                selected={selectedAvd}
                onSelect={async (name) => {
                  try {
                    await selectAvd(name)
                  } catch (err) {
                    toast.error('Failed to select AVD', {
                      description: err instanceof Error ? err.message : String(err)
                    })
                  }
                }}
                onRefresh={refreshAvds}
                disabled={isBusy || isLive}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    disabled={isBusy}
                    onClick={() => (isLive ? void restart() : void handleStart())}
                  >
                    {isLive ? (
                      <RotateCw className="h-3.5 w-3.5" />
                    ) : (
                      <Power className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {isLive ? 'Restart' : 'Start emulator'}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    disabled={!isLive && !isBusy}
                    onClick={() => void stop()}
                  >
                    <Square className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Stop emulator</TooltipContent>
              </Tooltip>
            </>
          )}
          {realDeviceActive && (
            // For real devices the only inline action we expose here is a
            // mirror restart — the device itself is the user's job.
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={async () => {
                    await window.api.mirror.stop()
                    const res = await window.api.mirror.start()
                    if (!res.ok) {
                      toast.error('Failed to restart mirror', { description: res.error })
                    }
                  }}
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Restart mirror</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon-sm" variant="ghost">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">More actions</TooltipContent>
          </Tooltip>
        </div>
      </header>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-3">
        {showMirror ? (
          <div className="relative h-full max-h-full w-full">
            <EmulatorMirror />
          </div>
        ) : isLive || realDeviceActive ? (
          // Either the embedded emulator is up but its mirror handshake hasn't
          // finished yet, or a real device is active and we're waiting for
          // scrcpy-server to bind. Same retry affordance either way.
          <MirrorTroubleCard mirrorState={mirrorState} errorMessage={mirror.errorMessage} />
        ) : (
          <div
            className={cn(
              'relative aspect-[9/19] h-full max-h-full w-full max-w-full overflow-hidden rounded-[28px] border border-border bg-gradient-to-b from-surface-raised via-surface to-surface-raised shadow-[0_25px_60px_-15px_hsl(0_0%_0%/0.6)]'
            )}
          >
            <div className="absolute inset-2 rounded-[22px] bg-background/60">
              <EmulatorViewPlaceholder
                state={status.state}
                sdkMissing={sdkMissing}
                avdCount={avds.length}
                selectedAvd={selectedAvd}
                errorMessage={status.errorMessage}
                bootMessage={bootProgress?.message ?? null}
                bootPercent={bootProgress?.percent ?? null}
              />
            </div>
            <div className="pointer-events-none absolute inset-x-12 top-2 h-4 rounded-b-2xl bg-background/80" />
          </div>
        )}
      </div>

      <footer className="flex h-12 shrink-0 items-center justify-center gap-1 border-t border-border bg-background/40 px-3">
        <KeyButton
          tooltip="Back"
          onClick={() => void handleKey('BACK', 'Back')}
          disabled={!deviceOnline}
          icon={<ArrowLeft className="h-4 w-4" />}
        />
        <KeyButton
          tooltip="Home"
          onClick={() => void handleKey('HOME', 'Home')}
          disabled={!deviceOnline}
          icon={<Circle className="h-3.5 w-3.5" />}
        />
        <KeyButton
          tooltip="Recent apps"
          onClick={() => void handleKey('APP_SWITCH', 'Recent apps')}
          disabled={!deviceOnline}
          icon={<Square className="h-3.5 w-3.5" />}
        />
        <div className="mx-2 h-5 w-px bg-border" />
        <KeyButton
          tooltip="Volume up"
          onClick={() => void handleKey('VOLUME_UP', 'Volume up')}
          disabled={!deviceOnline}
          icon={<Volume2 className="h-3.5 w-3.5" />}
        />
        <KeyButton
          tooltip="Volume down"
          onClick={() => void handleKey('VOLUME_DOWN', 'Volume down')}
          disabled={!deviceOnline}
          icon={<VolumeX className="h-3.5 w-3.5" />}
        />
        <KeyButton
          tooltip="Power"
          onClick={() => void handleKey('POWER', 'Power')}
          disabled={!deviceOnline}
          icon={<Power className="h-3.5 w-3.5" />}
        />
      </footer>
    </section>
  )
}

interface KeyButtonProps {
  tooltip: string
  icon: React.ReactNode
  disabled: boolean
  onClick: () => void
}

function KeyButton({ tooltip, icon, disabled, onClick }: KeyButtonProps): JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon" variant="ghost" disabled={disabled} onClick={onClick}>
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{tooltip}</TooltipContent>
    </Tooltip>
  )
}

interface DeviceHeaderLabelProps {
  activeDevice: Device | null
  emulatorState: string
  online: Device[]
  showSwitcher: boolean
  onPick: (serial: string) => void
}

/**
 * Header label for the device panel. Renders the active device's transport
 * icon and human-readable name; when more than one device is online it
 * upgrades to a dropdown trigger so the user can switch what this panel
 * is mirroring without leaving the panel. When nothing is active we fall
 * back to the emulator placeholder text.
 */
function DeviceHeaderLabel({
  activeDevice,
  emulatorState,
  online,
  showSwitcher,
  onPick
}: DeviceHeaderLabelProps): JSX.Element {
  const labelText = activeDevice
    ? activeDevice.label
    : emulatorState === 'running'
      ? 'Emulator'
      : 'No device'

  if (!showSwitcher) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <TransportIconFor device={activeDevice} />
        <span className="truncate text-xs font-medium">{labelText}</span>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-0.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-raised"
        >
          <TransportIconFor device={activeDevice} />
          <span className="truncate">{labelText}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[260px]">
        <DropdownMenuLabel>Mirroring this device</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {online.map((d) => (
          <DropdownMenuItem
            key={d.serial}
            onSelect={() => onPick(d.serial)}
            className="flex items-start gap-2"
          >
            <div className="mt-0.5">
              <TransportIconFor device={d} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-xs font-medium">{d.label}</span>
                {activeDevice?.serial === d.serial && (
                  <Check className="h-3 w-3 shrink-0 text-success" />
                )}
              </div>
              <div className="mt-0.5 font-mono text-2xs text-muted-foreground">
                {d.transport === 'emulator'
                  ? 'Embedded emulator'
                  : d.transport === 'usb'
                    ? 'USB'
                    : 'WiFi'}
                {d.androidVersion ? ` · Android ${d.androidVersion}` : ''}
                {d.capabilities.rooted ? ' · rooted' : ''}
              </div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function TransportIconFor({ device }: { device: Device | null }): JSX.Element {
  if (!device) return <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
  if (device.transport === 'wifi') return <Wifi className="h-3.5 w-3.5 text-primary" />
  if (device.transport === 'usb') return <Usb className="h-3.5 w-3.5 text-primary" />
  return <Smartphone className="h-3.5 w-3.5 text-primary" />
}

interface AvdPickerProps {
  avds: string[]
  selected: string | null
  onSelect: (name: string) => Promise<void>
  onRefresh: () => Promise<void>
  disabled: boolean
}

function AvdPicker({ avds, selected, onSelect, onRefresh, disabled }: AvdPickerProps): JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-7 max-w-[160px] gap-2 px-2 text-2xs"
        >
          <span className="truncate font-mono">{selected ?? 'No AVD'}</span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px]">
        <DropdownMenuLabel>Android Virtual Device</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {avds.length === 0 ? (
          <DropdownMenuItem disabled className="text-xs text-muted-foreground">
            No AVDs detected
          </DropdownMenuItem>
        ) : (
          <DropdownMenuRadioGroup value={selected ?? ''} onValueChange={(v) => void onSelect(v)}>
            {avds.map((name) => (
              <DropdownMenuRadioItem key={name} value={name} className="font-mono text-xs">
                {name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void onRefresh()}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh list
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface MirrorTroubleCardProps {
  mirrorState: 'idle' | 'connecting' | 'running' | 'stopping' | 'error'
  errorMessage?: string
}

function MirrorTroubleCard({ mirrorState, errorMessage }: MirrorTroubleCardProps): JSX.Element {
  const isError = mirrorState === 'error'
  const isIdle = mirrorState === 'idle'
  const isStopping = mirrorState === 'stopping'
  const retry = async (): Promise<void> => {
    const res = await window.api.mirror.start()
    if (!res.ok) {
      toast.error('Failed to start mirror', { description: res.error })
    }
  }
  return (
    <div className="flex h-full w-full max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <div
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-2xl border bg-surface-raised',
          isError ? 'border-destructive/40 text-destructive' : 'border-border text-primary'
        )}
      >
        <Smartphone className="h-7 w-7" strokeWidth={1.25} />
      </div>
      <div className="space-y-1">
        <div className="text-sm font-semibold tracking-tight">
          {isError
            ? 'Screen mirror failed'
            : isStopping
              ? 'Stopping mirror…'
              : isIdle
                ? 'Screen mirror is not running'
                : 'Connecting to scrcpy-server…'}
        </div>
        <p className="max-w-[20rem] whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
          {isError
            ? (errorMessage ??
              'scrcpy-server failed to come up. Check the dev console for [scrcpy-server] log lines.')
            : isIdle
              ? "Device is connected but the embedded mirror isn't running. Click retry to push scrcpy-server."
              : 'Hold tight — scrcpy-server takes a moment to come up on a fresh connection.'}
        </p>
      </div>
      {(isError || isIdle) && (
        <Button size="sm" onClick={() => void retry()}>
          <RotateCw className="h-3.5 w-3.5" />
          Retry mirror
        </Button>
      )}
    </div>
  )
}

function EmulatorBadge({ state }: { state: string }): JSX.Element {
  if (state === 'running') return <Badge variant="success">Live</Badge>
  if (state === 'starting' || state === 'booting')
    return <Badge variant="warning">{state === 'starting' ? 'Starting' : 'Booting'}</Badge>
  if (state === 'error') return <Badge variant="destructive">Error</Badge>
  if (state === 'missing-dependencies') return <Badge variant="outline">Setup required</Badge>
  return <Badge variant="muted">Idle</Badge>
}

interface PlaceholderProps {
  state: string
  sdkMissing: boolean
  avdCount: number
  selectedAvd: string | null
  errorMessage?: string
  bootMessage: string | null
  bootPercent: number | null
}

function EmulatorViewPlaceholder(props: PlaceholderProps): JSX.Element {
  const { state, sdkMissing, avdCount, selectedAvd, errorMessage, bootMessage, bootPercent } = props
  const openSettingsSection = useUIStore((s) => s.openSettingsSection)
  const canRepairFromSdk =
    !!errorMessage &&
    /(quick setup|system image|cannot run on this machine|requires a .* image)/i.test(errorMessage)

  if (state === 'starting' || state === 'booting') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary/30 border-t-primary"
        />
        <div className="space-y-1">
          <div className="font-mono text-xs uppercase tracking-wider text-primary">Booting…</div>
          <p className="max-w-[14rem] text-xs leading-relaxed text-muted-foreground">
            {bootMessage ?? 'Bringing up Android…'}
          </p>
        </div>
        {bootPercent !== null && <Progress value={bootPercent} className="w-44" />}
      </div>
    )
  }

  if (state === 'running') {
    // The mirror canvas takes over once it's connected — this only shows
    // during the brief window between emulator boot and mirror handshake.
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="relative">
          <Smartphone className="h-12 w-12 text-success/80" strokeWidth={1.25} />
          <span className="absolute -right-1 -top-1 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-success" />
          </span>
        </div>
        <div className="space-y-1.5">
          <div className="text-sm font-semibold tracking-tight">Emulator live</div>
          <p className="max-w-[16rem] text-xs leading-relaxed text-muted-foreground">
            Handshaking with scrcpy-server…
          </p>
        </div>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <Smartphone className="h-12 w-12 text-destructive/70" strokeWidth={1.25} />
        <div className="space-y-1">
          <div className="text-sm font-semibold tracking-tight text-destructive">
            Emulator error
          </div>
          <p className="max-w-[16rem] text-xs leading-relaxed text-muted-foreground">
            {errorMessage ?? 'Something went wrong. Check the logs.'}
          </p>
        </div>
        {canRepairFromSdk && (
          <Button size="sm" onClick={() => openSettingsSection('sdk')}>
            <Check className="h-3.5 w-3.5" />
            Open Android SDK setup
          </Button>
        )}
      </div>
    )
  }

  if (sdkMissing || avdCount === 0) {
    return <NoAvdCta sdkMissing={sdkMissing} />
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <Smartphone className="h-12 w-12 text-muted-foreground/50" strokeWidth={1.25} />
      <div className="space-y-1.5">
        <div className="text-sm font-semibold tracking-tight">Ready to boot</div>
        <p className="max-w-[16rem] text-xs leading-relaxed text-muted-foreground">
          {selectedAvd
            ? `${selectedAvd} selected. Press Start to launch.`
            : 'Pick an AVD from the dropdown above, then press Start.'}
        </p>
      </div>
    </div>
  )
}

function NoAvdCta({ sdkMissing }: { sdkMissing: boolean }): JSX.Element {
  const openSettingsSection = useUIStore((s) => s.openSettingsSection)
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="relative">
        <div className="absolute inset-0 -z-10 m-auto h-16 w-16 rounded-full bg-primary/20 blur-2xl" />
        <Smartphone className="h-12 w-12 text-muted-foreground/60" strokeWidth={1.25} />
      </div>
      <div className="space-y-1.5">
        <div className="text-sm font-semibold tracking-tight">
          {sdkMissing ? 'No Android SDK yet' : 'No AVDs found'}
        </div>
        <p className="max-w-[16rem] text-xs leading-relaxed text-muted-foreground">
          {sdkMissing
            ? 'MobSec can download the SDK and create a tuned, pre-rooted AVD for you in one go.'
            : 'Create a tuned pentesting AVD with one click — uses sdkmanager + avdmanager under the hood.'}
        </p>
      </div>
      <Button size="sm" onClick={() => openSettingsSection('sdk')}>
        <Check className="h-3.5 w-3.5" /> Open quick setup
      </Button>
      <p className="max-w-[16rem] text-2xs leading-relaxed text-muted-foreground/70">
        Already have an AVD elsewhere? Set <span className="font-mono">ANDROID_HOME</span> and
        relaunch the app.
      </p>
    </div>
  )
}
