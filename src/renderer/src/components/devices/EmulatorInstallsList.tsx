import {
  ChevronRight,
  Cpu,
  Loader2,
  Plug,
  Play,
  RefreshCw,
  Smartphone
} from 'lucide-react'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { cn } from '@/lib/utils'
import { useEmulatorInstallsStore } from '@/stores/useEmulatorInstallsStore'
import { useDeviceStore } from '@/stores/useDeviceStore'
import type { EmulatorInstall, EmulatorVendor } from '@shared/types'

/**
 * Renders the "Other emulators on this machine" section in
 * Settings → Devices. Detected installs come from the main-process
 * detector; each row has Launch (spawn the vendor's launcher) and
 * Connect (adb-connect every default port of that install). Once an
 * emulator is connected, it ALSO appears in the device cards above —
 * we don't dedupe, because the two views serve different jobs: this
 * section is "what's installed", the cards are "what's online".
 */
export function EmulatorInstallsList(): JSX.Element {
  const installs = useEmulatorInstallsStore((s) => s.installs)
  const loading = useEmulatorInstallsStore((s) => s.loading)
  const launching = useEmulatorInstallsStore((s) => s.launching)
  const connecting = useEmulatorInstallsStore((s) => s.connecting)
  const hydrate = useEmulatorInstallsStore((s) => s.hydrate)
  const refresh = useEmulatorInstallsStore((s) => s.refresh)
  const launch = useEmulatorInstallsStore((s) => s.launch)
  const connectAll = useEmulatorInstallsStore((s) => s.connectAll)
  const refreshDevices = useDeviceStore((s) => s.refresh)
  const devices = useDeviceStore((s) => s.devices)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  const doRefresh = async (): Promise<void> => {
    await refresh()
    toast.success('Re-scanned for emulators')
  }

  const doLaunch = async (install: EmulatorInstall): Promise<void> => {
    try {
      await launch(install.id)
      toast.success(`Launched ${install.name}`, {
        description: 'Polling for adb device — this can take 10–60 s for a cold boot.'
      })
      // Best-effort: re-probe a few times so the device picker fills in
      // as soon as the emulator's adb daemon is reachable.
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 5000))
        const result = await connectAll(install.id)
        if (result.connected.length > 0) {
          toast.success(`${install.name} connected`, { description: result.connected.join(', ') })
          void refreshDevices()
          return
        }
      }
      toast.info(`${install.name} didn't come online`, {
        description: 'Boot may have failed, or the adb port is non-default. Use "Connect by IP".'
      })
    } catch (err) {
      toast.error('Launch failed', {
        description: err instanceof Error ? err.message : String(err)
      })
    }
  }

  const doConnect = async (install: EmulatorInstall): Promise<void> => {
    try {
      const result = await connectAll(install.id)
      if (result.connected.length > 0) {
        toast.success(`Connected ${install.name}`, { description: result.connected.join(', ') })
        void refreshDevices()
      } else {
        toast.info(`${install.name} isn't running on its default ports`, {
          description: `Tried: ${install.defaultPorts.map((p) => install.defaultHost + ':' + p).join(', ')}. Launch it first, or use "Connect by IP".`
        })
      }
    } catch (err) {
      toast.error('Connect failed', {
        description: err instanceof Error ? err.message : String(err)
      })
    }
  }

  // A row is "live" when any of its candidate adb targets already
  // appears in the deviceService's list — that tells the user this
  // install is currently usable from the device picker.
  const isLive = (install: EmulatorInstall): boolean => {
    const targets = new Set<string>()
    install.defaultPorts.forEach((p) => targets.add(`${install.defaultHost}:${p}`))
    install.instances.forEach((i) => targets.add(i.adbTarget))
    return devices.some((d) => targets.has(d.serial) && d.state === 'online')
  }

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-sm font-medium">Other emulators on this machine</h2>
          <p className="text-xs text-muted-foreground">
            Detected third-party emulators (LDPlayer, BlueStacks, NoxPlayer, MEmu, Genymotion).
            Launch one or connect it over adb to add it to the picker above.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void doRefresh()} disabled={loading}>
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Rescan
        </Button>
      </div>

      {installs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/30 px-4 py-6 text-center text-xs text-muted-foreground">
          {loading ? (
            <>
              <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
              Scanning for installed emulators…
            </>
          ) : (
            <>
              <Smartphone className="mx-auto mb-2 h-5 w-5 opacity-40" />
              No third-party emulators found. Standard paths checked: LDPlayer,
              BlueStacks, NoxPlayer, MEmu, Genymotion.
            </>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {installs.map((install) => (
            <li
              key={install.id}
              className={cn(
                'rounded-xl border border-border bg-surface/40 px-4 py-3 transition-colors',
                isLive(install) && 'border-success/40 bg-success/5'
              )}
            >
              <div className="flex items-start gap-3">
                <VendorIcon vendor={install.vendor} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{install.name}</span>
                    {isLive(install) && (
                      <span className="rounded-md border border-success/40 bg-success/15 px-1.5 py-0.5 text-2xs font-medium text-success">
                        Connected
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-2xs text-muted-foreground">
                    {install.installPath}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-2xs text-muted-foreground/80">
                    <span>
                      adb ports: {install.defaultPorts.slice(0, 4).join(', ')}
                      {install.defaultPorts.length > 4 ? '…' : ''}
                    </span>
                    {install.instances.length > 0 && (
                      <span>
                        instances: {install.instances.length}{' '}
                        ({install.instances.filter((i) => i.running).length} running)
                      </span>
                    )}
                  </div>
                  {install.instances.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {install.instances.map((inst) => (
                        <li
                          key={inst.adbTarget}
                          className="flex items-center gap-2 text-2xs"
                        >
                          <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
                          <span className="font-mono">{inst.name}</span>
                          <span className="font-mono text-muted-foreground">
                            {inst.adbTarget}
                          </span>
                          <span
                            className={cn(
                              'ml-auto rounded px-1.5 py-0.5 text-[10px] uppercase',
                              inst.running
                                ? 'bg-success/15 text-success'
                                : 'bg-surface text-muted-foreground'
                            )}
                          >
                            {inst.running ? 'running' : 'stopped'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={launching.has(install.id)}
                    onClick={() => void doLaunch(install)}
                  >
                    {launching.has(install.id) ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Launching…
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5" /> Launch
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={connecting.has(install.id)}
                    onClick={() => void doConnect(install)}
                  >
                    {connecting.has(install.id) ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Connecting…
                      </>
                    ) : (
                      <>
                        <Plug className="h-3.5 w-3.5" /> Connect adb
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function VendorIcon({ vendor }: { vendor: EmulatorVendor }): JSX.Element {
  // Vendor color mapping. We don't have brand-licensed icons (and
  // wouldn't ship them anyway), so a Cpu glyph + a coloured rounded
  // chip with the vendor's initials reads as a clear visual anchor.
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
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-semibold',
        bg,
        text
      )}
    >
      {initials}
    </div>
  )
  void Cpu
}
