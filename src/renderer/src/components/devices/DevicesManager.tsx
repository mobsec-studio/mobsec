import {
  Activity,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  Smartphone,
  Unplug,
  Usb,
  Wifi,
  X,
  Zap
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { selectActiveDevice, useDeviceStore } from '@/stores/useDeviceStore'
import { cn } from '@/lib/utils'
import type { Device } from '@shared/types'
import { WirelessConnectDialog } from './WirelessConnectDialog'
import { EmulatorInstallsList } from './EmulatorInstallsList'

/**
 * Settings tab section listing every adb-visible device with its
 * capability matrix, plus actions to connect new ones over WiFi or
 * disconnect existing wireless rows. Lives alongside the title-bar
 * device picker — same data, more detail.
 */
export function DevicesManager(): JSX.Element {
  const devices = useDeviceStore((s) => s.devices)
  const activeSerial = useDeviceStore((s) => s.activeSerial)
  const hydrate = useDeviceStore((s) => s.hydrate)
  const refresh = useDeviceStore((s) => s.refresh)
  const setActive = useDeviceStore((s) => s.setActive)
  const applyList = useDeviceStore((s) => s.applyList)
  const active = useDeviceStore(selectActiveDevice)
  const [refreshing, setRefreshing] = useState(false)
  const [connectOpen, setConnectOpen] = useState(false)
  // Seed the connect dialog with a known USB device when the user clicks
  // "Promote to WiFi" on a row — saves them retyping the serial.
  const [promoteFromSerial, setPromoteFromSerial] = useState<string | null>(null)

  useEffect(() => {
    void hydrate()
    const off = window.api.on.onDeviceListChanged((list) => applyList(list))
    return () => off()
  }, [hydrate, applyList])

  const doRefresh = async (): Promise<void> => {
    setRefreshing(true)
    try {
      await refresh()
      toast.success('Devices refreshed')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-sm font-medium">Devices</h2>
          <p className="text-xs text-muted-foreground">
            Every adb-visible target. The active one (highlighted) is what mirror, proxy,
            Frida, and the repeater route against. The embedded emulator shows up here once
            it boots.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setConnectOpen(true)}>
            <Wifi className="h-3.5 w-3.5" /> Connect over WiFi
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void doRefresh()}>
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} /> Refresh
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {devices.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface/30 px-4 py-8 text-center text-xs text-muted-foreground">
            <Smartphone className="mx-auto mb-2 h-5 w-5 opacity-40" />
            No devices connected. Plug in a phone with USB debugging enabled, or boot the
            embedded emulator from the dashboard.
          </div>
        ) : (
          devices.map((d) => (
            <DeviceCard
              key={d.serial}
              device={d}
              isActive={d.serial === activeSerial}
              onActivate={() => void setActive(d.serial)}
              onPromoteToWifi={() => {
                setPromoteFromSerial(d.serial)
                setConnectOpen(true)
              }}
              onDisconnect={async () => {
                try {
                  await window.api.device.disconnect(d.serial)
                  toast.success(`Disconnected ${d.label}`)
                } catch (err) {
                  toast.error('Disconnect failed', {
                    description: err instanceof Error ? err.message : String(err)
                  })
                }
              }}
            />
          ))
        )}
      </div>

      <WirelessConnectDialog
        open={connectOpen}
        onClose={() => {
          setConnectOpen(false)
          setPromoteFromSerial(null)
        }}
        promoteFromSerial={promoteFromSerial}
      />

      {active && <CapabilityMatrix device={active} />}

      <EmulatorInstallsList />
    </section>
  )
}

interface DeviceCardProps {
  device: Device
  isActive: boolean
  onActivate: () => void
  onPromoteToWifi: () => void
  onDisconnect: () => Promise<void>
}

function DeviceCard({
  device,
  isActive,
  onActivate,
  onPromoteToWifi,
  onDisconnect
}: DeviceCardProps): JSX.Element {
  const isOnline = device.state === 'online'
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-surface/40 p-4 transition-colors',
        isActive && 'border-primary/40 bg-primary/5 ring-1 ring-primary/30'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {device.transport === 'wifi' ? (
            <Wifi className="h-4 w-4 text-primary" />
          ) : device.transport === 'emulator' ? (
            <Smartphone className="h-4 w-4 text-primary" />
          ) : (
            <Usb className="h-4 w-4 text-primary" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{device.label}</span>
            {isActive && (
              <span className="rounded-md border border-primary/40 bg-primary/15 px-1.5 py-0.5 text-2xs font-medium text-primary">
                Active
              </span>
            )}
            <DeviceStatePill state={device.state} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-2xs text-muted-foreground">
            <span>{device.serial}</span>
            {device.androidVersion && <span>Android {device.androidVersion}</span>}
            {device.sdkLevel != null && <span>SDK {device.sdkLevel}</span>}
            {device.abi && <span>{device.abi}</span>}
          </div>
          {(device.brand || device.model) && (
            <div className="mt-0.5 text-2xs text-muted-foreground/80">
              {device.brand} · {device.model}
            </div>
          )}
          {device.capabilities.warnings.length > 0 && isOnline && (
            <div className="mt-2 space-y-1">
              {device.capabilities.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-1.5 text-2xs text-warning">
                  <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" />
                  <span className="leading-relaxed">{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {!isActive && isOnline && (
            <Button size="sm" variant="outline" onClick={onActivate}>
              <Zap className="h-3.5 w-3.5" /> Set active
            </Button>
          )}
          {device.transport === 'usb' && isOnline && (
            <Button size="sm" variant="ghost" onClick={onPromoteToWifi}>
              <Wifi className="h-3.5 w-3.5" /> Use over WiFi
            </Button>
          )}
          {device.transport === 'wifi' && (
            <Button size="sm" variant="ghost" onClick={() => void onDisconnect()}>
              <Unplug className="h-3.5 w-3.5" /> Disconnect
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function DeviceStatePill({ state }: { state: Device['state'] }): JSX.Element {
  if (state === 'online') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-success/30 bg-success/10 px-1.5 py-0.5 text-2xs text-success">
        <span className="h-1.5 w-1.5 rounded-full bg-success" /> online
      </span>
    )
  }
  if (state === 'unauthorized') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-2xs text-warning">
        unauthorized
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-1.5 py-0.5 text-2xs text-muted-foreground">
      offline
    </span>
  )
}

function CapabilityMatrix({ device }: { device: Device }): JSX.Element {
  const caps = device.capabilities
  const rows: { key: string; label: string; ok: boolean; note?: string }[] = [
    { key: 'mirror', label: 'Screen mirror & control', ok: caps.canMirror },
    { key: 'logcat', label: 'Logcat streaming', ok: caps.canLogcat },
    {
      key: 'frida',
      label: 'Frida server',
      ok: caps.canRunFridaServer,
      note: caps.canRunFridaServer
        ? undefined
        : 'Requires root. Use Frida Gadget injection for non-rooted devices.'
    },
    {
      key: 'caSys',
      label: 'CA → system trust store',
      ok: caps.canInstallSystemCa,
      note: caps.canInstallSystemCa ? undefined : 'Requires root.'
    },
    {
      key: 'caMagisk',
      label: 'CA → persistent Magisk module',
      ok: caps.canInstallMagiskCa,
      note: caps.canInstallMagiskCa
        ? undefined
        : caps.rooted
          ? 'Install Magisk to persist the CA across /system remounts.'
          : 'Requires Magisk-rooted device.'
    },
    {
      key: 'caUser',
      label: 'CA → user store (NSC-aware apps only)',
      ok: caps.canInstallUserCa,
      note: 'Works on any device, but most production apps ignore user-store certs.'
    }
  ]
  return (
    <div className="rounded-xl border border-border bg-surface/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Activity className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-sm font-medium">What this device can do</h3>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.key} className="flex items-start gap-2 text-xs">
            {r.ok ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
            ) : (
              <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            )}
            <div className="min-w-0 flex-1">
              <div className={cn('text-foreground', !r.ok && 'text-muted-foreground')}>
                {r.label}
              </div>
              {r.note && (
                <div className="mt-0.5 text-2xs leading-relaxed text-muted-foreground/80">
                  {r.note}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

