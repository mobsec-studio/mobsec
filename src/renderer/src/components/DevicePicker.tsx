import {
  Check,
  ChevronDown,
  Globe,
  Loader2,
  Play,
  Plug,
  Power,
  RefreshCw,
  Settings as SettingsIcon,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  Usb,
  Wifi
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { cn } from '@/lib/utils'
import { selectActiveDevice, useDeviceStore } from '@/stores/useDeviceStore'
import { useEmulatorStore } from '@/stores/useEmulatorStore'
import { useEmulatorInstallsStore } from '@/stores/useEmulatorInstallsStore'
import { useUIStore } from '@/stores/useUIStore'
import type { Device, EmulatorInstall, EmulatorVendor } from '@shared/types'

/**
 * Title-bar device picker. Re-designed from "list of adb-visible
 * targets" into a small command center so users can switch the active
 * target AND act on every reachable possibility (connect a detected
 * third-party emulator, boot the embedded AVD, or type a host:port
 * directly) without bouncing through Settings → Devices for the common
 * cases. The full management surface still lives there for everything
 * else.
 *
 * Sections render in priority order:
 *
 *   1. Connected — every adb-online device. Click to set active.
 *   2. Detected emulators — installs the host has on disk that aren't
 *      currently online. Per-row Launch + Connect actions.
 *   3. Quick actions — start the embedded AVD, connect by IP inline,
 *      jump to Settings → Devices for the long form.
 *
 * Each section is collapsed gracefully when empty so the dropdown
 * doesn't show empty headers.
 */
export function DevicePicker(): JSX.Element {
  const devices = useDeviceStore((s) => s.devices)
  const activeSerial = useDeviceStore((s) => s.activeSerial)
  const hydrate = useDeviceStore((s) => s.hydrate)
  const refresh = useDeviceStore((s) => s.refresh)
  const setActive = useDeviceStore((s) => s.setActive)
  const applyList = useDeviceStore((s) => s.applyList)
  const active = useDeviceStore(selectActiveDevice)
  const [refreshing, setRefreshing] = useState(false)

  // Third-party emulators (LDPlayer/BlueStacks/etc.) — surfaces in the
  // picker so users can connect them right from the title bar.
  const installs = useEmulatorInstallsStore((s) => s.installs)
  const hydrateInstalls = useEmulatorInstallsStore((s) => s.hydrate)
  const refreshInstalls = useEmulatorInstallsStore((s) => s.refresh)
  const connectAllInstall = useEmulatorInstallsStore((s) => s.connectAll)
  const launchInstall = useEmulatorInstallsStore((s) => s.launch)
  const launchingSet = useEmulatorInstallsStore((s) => s.launching)
  const connectingSet = useEmulatorInstallsStore((s) => s.connecting)

  // Embedded emulator state — drives the "Start embedded emulator"
  // quick action.
  const emulatorState = useEmulatorStore((s) => s.status.state)
  const startEmulator = useEmulatorStore((s) => s.start)
  const openSettingsSection = useUIStore((s) => s.openSettingsSection)

  const [ipInput, setIpInput] = useState('')
  const [connectingIp, setConnectingIp] = useState(false)

  useEffect(() => {
    void hydrate()
    void hydrateInstalls()
    const offList = window.api.on.onDeviceListChanged((list) => applyList(list))
    const offActive = window.api.on.onDeviceActiveChanged(() => {
      void hydrate()
    })
    return () => {
      offList()
      offActive()
    }
  }, [hydrate, hydrateInstalls, applyList])

  const onlineDevices = useMemo(() => devices.filter((d) => d.state === 'online'), [devices])
  const offlineOrUnauthorized = useMemo(
    () => devices.filter((d) => d.state !== 'online'),
    [devices]
  )

  // An install is "live" when at least one of its adb targets is
  // already in the device list as online. Such installs don't get
  // their own row in the Other-emulators section — they're already
  // listed under Connected above.
  const installLive = useCallback(
    (install: EmulatorInstall): boolean => {
      const targets = new Set<string>()
      install.defaultPorts.forEach((p) => targets.add(`${install.defaultHost}:${p}`))
      install.instances.forEach((i) => targets.add(i.adbTarget))
      return onlineDevices.some((d) => targets.has(d.serial))
    },
    [onlineDevices]
  )
  const dormantInstalls = useMemo(
    () => installs.filter((i) => !installLive(i)),
    [installs, installLive]
  )

  const doRefresh = async (): Promise<void> => {
    setRefreshing(true)
    try {
      await Promise.all([refresh(), refreshInstalls()])
    } finally {
      setRefreshing(false)
    }
  }

  const pickActive = async (serial: string): Promise<void> => {
    try {
      await setActive(serial)
    } catch (err) {
      toast.error('Could not switch active device', {
        description: err instanceof Error ? err.message : String(err)
      })
    }
  }

  const handleStartEmulator = async (): Promise<void> => {
    try {
      await startEmulator()
      toast.success('Booting the embedded emulator...')
    } catch (err) {
      toast.error('Failed to start emulator', {
        description: err instanceof Error ? err.message : String(err)
      })
    }
  }

  const handleConnectInstall = async (install: EmulatorInstall): Promise<void> => {
    try {
      const result = await connectAllInstall(install.id)
      if (result.connected.length > 0) {
        toast.success(`Connected ${install.name}`, { description: result.connected.join(', ') })
        void refresh()
      } else {
        toast.info(`${install.name} isn't responding on its default ports`, {
          description:
            'Launch it first from this dropdown, or use Connect by IP if it runs on a custom port.'
        })
      }
    } catch (err) {
      toast.error('Connect failed', {
        description: err instanceof Error ? err.message : String(err)
      })
    }
  }

  const handleLaunchInstall = async (install: EmulatorInstall): Promise<void> => {
    try {
      await launchInstall(install.id)
      toast.success(`Launched ${install.name}`, {
        description: 'Auto-connecting as soon as adb sees it (10-60 s).'
      })
      // Poll-connect a few times after launch — same loop the Settings
      // page uses, but we don't block the dropdown on it.
      void (async () => {
        for (let i = 0; i < 12; i++) {
          await new Promise((r) => setTimeout(r, 5000))
          const r = await connectAllInstall(install.id).catch(() => null)
          if (r && r.connected.length > 0) {
            toast.success(`${install.name} connected`, { description: r.connected.join(', ') })
            void refresh()
            return
          }
        }
      })()
    } catch (err) {
      toast.error('Launch failed', {
        description: err instanceof Error ? err.message : String(err)
      })
    }
  }

  const handleConnectByIp = async (): Promise<void> => {
    const value = ipInput.trim()
    if (!value) return
    setConnectingIp(true)
    try {
      const res = await window.api.device.connect(value)
      if (res.ok) {
        toast.success(`Connected ${res.value.serial}`)
        setIpInput('')
        void refresh()
      } else {
        toast.error('Connect failed', { description: res.error })
      }
    } catch (err) {
      toast.error('Connect failed', {
        description: err instanceof Error ? err.message : String(err)
      })
    } finally {
      setConnectingIp(false)
    }
  }

  const triggerLabel = active
    ? active.label
    : onlineDevices.length > 0
      ? 'Pick a device'
      : 'No device'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={active ? `${active.label} (${active.serial})` : triggerLabel}
          className="titlebar-no-drag flex h-7 min-w-[7.25rem] max-w-[34vw] items-center gap-1.5 rounded-md border border-border bg-surface/60 px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-raised lg:min-w-[9rem] lg:max-w-[320px]"
        >
          <TransportIcon device={active} />
          <span className="min-w-0 flex-1 truncate">{triggerLabel}</span>
          {active?.androidVersion && (
            <span className="hidden shrink-0 font-mono text-2xs text-muted-foreground xl:inline">
              API {active.sdkLevel ?? active.androidVersion}
            </span>
          )}
          {active && <RootDot device={active} />}
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[420px] max-w-[calc(100vw-2rem)]"
        // Prevent the dropdown from closing when the user types into
        // the Connect-by-IP input — the radix default would dismiss on
        // every keystroke that focuses a non-item element.
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Devices &amp; emulators</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  void doRefresh()
                }}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
                aria-label="Refresh"
              >
                <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Re-scan adb + emulator installs</TooltipContent>
          </Tooltip>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {active && (
          <div className="mx-2 mb-1 rounded-md border border-border bg-surface/40 p-3">
            <div className="flex items-start gap-2">
              <div className="mt-0.5">
                <TransportIcon device={active} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-foreground">{active.label}</div>
                <div className="mt-0.5 truncate font-mono text-2xs text-muted-foreground">
                  {active.serial}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <CapabilityChip label={active.transport} ok />
                  {active.androidVersion && (
                    <CapabilityChip
                      label={`Android ${active.androidVersion}${active.sdkLevel ? ` / API ${active.sdkLevel}` : ''}`}
                      ok
                    />
                  )}
                  {active.abi && <CapabilityChip label={active.abi} ok />}
                  <CapabilityChip label="Root" ok={active.capabilities.rooted} />
                  <CapabilityChip label="Frida" ok={active.capabilities.canRunFridaServer} />
                  <CapabilityChip
                    label="System CA"
                    ok={
                      active.capabilities.canInstallSystemCa ||
                      active.capabilities.canInstallMagiskCa
                    }
                  />
                  <CapabilityChip label="Mirror" ok={active.capabilities.canMirror} />
                  <CapabilityChip label="Logcat" ok={active.capabilities.canLogcat} />
                </div>
                {active.capabilities.warnings.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {active.capabilities.warnings.slice(0, 2).map((warning) => (
                      <div
                        key={warning}
                        className="line-clamp-2 text-2xs leading-relaxed text-warning"
                      >
                        {warning}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ---- Connected section --------------------------------------- */}
        {onlineDevices.length > 0 ? (
          <SectionLabel>Connected ({onlineDevices.length})</SectionLabel>
        ) : (
          <div className="px-3 py-3 text-2xs leading-relaxed text-muted-foreground">
            <Smartphone className="float-left mr-2 h-4 w-4 opacity-60" />
            Nothing&apos;s wired up yet. Use any of the actions below - plug in a phone with USB
            debugging, boot the embedded emulator, launch / connect one of your installed emulators,
            or paste a host:port.
          </div>
        )}
        {onlineDevices.map((d) => (
          <DropdownMenuItem
            key={d.serial}
            onSelect={() => void pickActive(d.serial)}
            className="flex items-start gap-2"
          >
            <div className="mt-0.5">
              <TransportIcon device={d} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-xs font-medium">{d.label}</span>
                {d.serial === activeSerial && <Check className="h-3 w-3 shrink-0 text-success" />}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-muted-foreground">
                <DeviceStateChip device={d} />
                {d.androidVersion && <span>Android {d.androidVersion}</span>}
                {d.abi && <span className="font-mono">{d.abi}</span>}
              </div>
            </div>
          </DropdownMenuItem>
        ))}
        {offlineOrUnauthorized.length > 0 && (
          <>
            <SectionLabel>Offline / unauthorized ({offlineOrUnauthorized.length})</SectionLabel>
            {offlineOrUnauthorized.map((d) => (
              <div key={d.serial} className="flex items-start gap-2 px-3 py-1.5 opacity-70">
                <div className="mt-0.5">
                  <TransportIcon device={d} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{d.label}</div>
                  <div className="mt-0.5 text-2xs text-muted-foreground">
                    <DeviceStateChip device={d} />
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ---- Dormant detected emulators ------------------------------ */}
        {dormantInstalls.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <SectionLabel>Installed on this machine ({dormantInstalls.length})</SectionLabel>
            {dormantInstalls.map((install) => (
              <div key={install.id} className="flex items-start gap-2 px-3 py-2">
                <VendorChip vendor={install.vendor} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{install.name}</div>
                  <div className="mt-0.5 truncate font-mono text-2xs text-muted-foreground">
                    {install.installPath}
                  </div>
                  {install.instances.length > 0 && (
                    <div className="mt-0.5 text-2xs text-muted-foreground">
                      {install.instances.filter((i) => i.running).length}/{install.instances.length}{' '}
                      instances running
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      void handleConnectInstall(install)
                    }}
                    disabled={connectingSet.has(install.id)}
                    className="inline-flex h-6 items-center gap-1 rounded-md border border-border bg-surface px-2 text-2xs text-foreground hover:bg-surface-raised disabled:opacity-50"
                  >
                    {connectingSet.has(install.id) ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Plug className="h-3 w-3" />
                    )}
                    Connect
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      void handleLaunchInstall(install)
                    }}
                    disabled={launchingSet.has(install.id)}
                    className="inline-flex h-6 items-center gap-1 rounded-md text-2xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    {launchingSet.has(install.id) ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                    Launch
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ---- Quick actions ----------------------------------------- */}
        <DropdownMenuSeparator />
        <SectionLabel>Quick actions</SectionLabel>
        {emulatorState !== 'running' &&
          emulatorState !== 'starting' &&
          emulatorState !== 'booting' && (
            <DropdownMenuItem onSelect={() => void handleStartEmulator()}>
              <Power className="h-3.5 w-3.5" />
              <span>Start embedded emulator</span>
            </DropdownMenuItem>
          )}
        {(emulatorState === 'starting' || emulatorState === 'booting') && (
          <div className="flex items-center gap-2 px-3 py-1.5 text-2xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Embedded emulator booting...
          </div>
        )}

        {/* Connect-by-IP inline form. Stays open while typing — the
            dropdown's onCloseAutoFocus handler prevents radix from
            yanking focus on every keystroke. */}
        <div
          className="flex min-w-0 items-center gap-1.5 px-3 py-1.5"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            value={ipInput}
            onChange={(e) => setIpInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleConnectByIp()
              }
            }}
            placeholder="host:port"
            spellCheck={false}
            className="h-6 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 font-mono text-2xs text-foreground outline-none focus:border-primary"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-6 shrink-0 px-2"
            disabled={connectingIp || !ipInput.trim()}
            onClick={() => void handleConnectByIp()}
          >
            {connectingIp ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Go'}
          </Button>
        </div>

        <DropdownMenuItem
          onSelect={() => {
            openSettingsSection('devices')
          }}
        >
          <SettingsIcon className="h-3.5 w-3.5" />
          <span>Open device settings...</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/80">
      {children}
    </div>
  )
}

function TransportIcon({ device }: { device: Device | null }): JSX.Element {
  if (!device) return <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
  if (device.transport === 'emulator') return <Smartphone className="h-3.5 w-3.5 text-primary" />
  if (device.transport === 'wifi') return <Wifi className="h-3.5 w-3.5 text-primary" />
  return <Usb className="h-3.5 w-3.5 text-primary" />
}

function VendorChip({ vendor }: { vendor: EmulatorVendor }): JSX.Element {
  const palette: Record<EmulatorVendor, { bg: string; text: string; initials: string }> = {
    ldplayer: { bg: 'bg-blue-500/15', text: 'text-blue-400', initials: 'LD' },
    bluestacks: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', initials: 'BS' },
    nox: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', initials: 'NX' },
    memu: { bg: 'bg-amber-500/15', text: 'text-amber-400', initials: 'ME' },
    genymotion: { bg: 'bg-purple-500/15', text: 'text-purple-400', initials: 'GM' }
  }
  const { bg, text, initials } = palette[vendor]
  return (
    <div
      className={cn(
        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-semibold',
        bg,
        text
      )}
    >
      {initials}
    </div>
  )
}

function RootDot({ device }: { device: Device }): JSX.Element {
  if (device.capabilities.rooted) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <ShieldCheck className="h-3 w-3 text-success" />
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Rooted - Frida &amp; system-CA install available.
        </TooltipContent>
      </Tooltip>
    )
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <ShieldOff className="h-3 w-3 text-warning" />
      </TooltipTrigger>
      <TooltipContent side="bottom">
        Not rooted. Frida and system trust store are unavailable. The proxy CA falls back to the
        user store.
      </TooltipContent>
    </Tooltip>
  )
}

function DeviceStateChip({ device }: { device: Device }): JSX.Element {
  if (device.state === 'online') {
    return <span className="text-success">online</span>
  }
  if (device.state === 'unauthorized') {
    return (
      <span className="text-warning">unauthorized - accept the debug prompt on the device</span>
    )
  }
  return <span className="text-muted-foreground">offline</span>
}

function CapabilityChip({ label, ok }: { label: string; ok: boolean }): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded border px-1.5 py-0.5 font-mono text-[10px]',
        ok
          ? 'border-success/30 bg-success/10 text-success'
          : 'border-border bg-background/40 text-muted-foreground'
      )}
      title={label}
    >
      <span className="truncate">{label}</span>
    </span>
  )
}

/** Inline loading skeleton - used while the first hydrate is in flight. */
export function DevicePickerSkeleton(): JSX.Element {
  return (
    <Button variant="outline" size="sm" disabled className="titlebar-no-drag h-7">
      <Loader2 className="h-3 w-3 animate-spin" /> Devices...
    </Button>
  )
}
