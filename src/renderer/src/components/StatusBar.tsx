import { Activity, FolderKanban, Network, Cpu, ScrollText, Smartphone } from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import { useEmulatorStore } from '@/stores/useEmulatorStore'
import { useProxyStore } from '@/stores/useProxyStore'
import { useLogcatStore } from '@/stores/useLogcatStore'
import { cn } from '@/lib/utils'
import type { EmulatorState, ProxyState } from '@shared/types'

function emulatorTone(state: EmulatorState): { label: string; tone: string } {
  switch (state) {
    case 'running':
      return { label: 'Running', tone: 'bg-success/70 shadow-[0_0_8px_0_hsl(var(--success)/0.6)]' }
    case 'starting':
    case 'booting':
      return {
        label: state === 'starting' ? 'Starting' : 'Booting',
        tone: 'bg-warning/80 animate-pulse'
      }
    case 'stopping':
      return { label: 'Stopping', tone: 'bg-warning/60 animate-pulse' }
    case 'error':
      return { label: 'Error', tone: 'bg-destructive/80' }
    case 'missing-dependencies':
      return { label: 'Setup required', tone: 'bg-muted-foreground/40' }
    default:
      return { label: 'Idle', tone: 'bg-muted-foreground/30' }
  }
}

function proxyTone(state: ProxyState): { label: string; tone: string } {
  switch (state) {
    case 'running':
      return {
        label: 'Listening',
        tone: 'bg-success/70 shadow-[0_0_8px_0_hsl(var(--success)/0.6)]'
      }
    case 'starting':
    case 'stopping':
      return {
        label: state === 'starting' ? 'Starting' : 'Stopping',
        tone: 'bg-warning/70 animate-pulse'
      }
    case 'error':
      return { label: 'Error', tone: 'bg-destructive/80' }
    default:
      return { label: 'Stopped', tone: 'bg-muted-foreground/30' }
  }
}

function logcatTone(running: boolean, error?: string): { label: string; tone: string } {
  if (error) return { label: 'Error', tone: 'bg-destructive/80' }
  if (running)
    return { label: 'Streaming', tone: 'bg-success/70 shadow-[0_0_8px_0_hsl(var(--success)/0.6)]' }
  return { label: 'Stopped', tone: 'bg-muted-foreground/30' }
}

export function StatusBar(): JSX.Element {
  const project = useAppStore((s) => s.activeProject)
  const info = useAppStore((s) => s.info)
  const emulator = useEmulatorStore((s) => s.status)
  const proxy = useProxyStore((s) => s.status)
  const logcat = useLogcatStore((s) => s.status)

  const emu = emulatorTone(emulator.state)
  const px = proxyTone(proxy.state)
  const lc = logcatTone(logcat.running, logcat.errorMessage)

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between gap-4 border-t border-border bg-background/80 px-3 text-2xs text-muted-foreground backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <StatusItem icon={<FolderKanban className="h-3 w-3" />} label={project?.name ?? '—'} />
        <StatusItem
          icon={<Smartphone className="h-3 w-3" />}
          label={
            <span className="flex items-center gap-1.5">
              Emulator
              <span className={cn('inline-block h-1.5 w-1.5 rounded-full', emu.tone)} />
              <span className="text-foreground/80">{emu.label}</span>
            </span>
          }
        />
        <StatusItem
          icon={<Network className="h-3 w-3" />}
          label={
            <span className="flex items-center gap-1.5">
              Proxy
              <span className={cn('inline-block h-1.5 w-1.5 rounded-full', px.tone)} />
              <span className="text-foreground/80">
                {px.label} <span className="text-muted-foreground">:{proxy.port}</span>
              </span>
            </span>
          }
        />
        <StatusItem
          icon={<ScrollText className="h-3 w-3" />}
          label={
            <span className="flex items-center gap-1.5">
              Logcat
              <span className={cn('inline-block h-1.5 w-1.5 rounded-full', lc.tone)} />
              <span className="text-foreground/80">
                {lc.label}
                {logcat.pid ? (
                  <span className="text-muted-foreground"> pid {logcat.pid}</span>
                ) : null}
              </span>
            </span>
          }
        />
        <StatusItem
          icon={<Cpu className="h-3 w-3" />}
          label={
            <span className="flex items-center gap-1.5">
              Frida
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
              <span className="text-foreground/80">Disconnected</span>
            </span>
          }
        />
      </div>

      <div className="flex items-center gap-3 text-2xs">
        <span className="flex items-center gap-1.5">
          <Activity className="h-3 w-3" />
          {info ? `${info.platform} · ${info.arch}` : '—'}
        </span>
        <span className="text-muted-foreground/60">v{info?.version ?? '0.0.0'}</span>
      </div>
    </footer>
  )
}

function StatusItem({
  icon,
  label
}: {
  icon: React.ReactNode
  label: React.ReactNode
}): JSX.Element {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground/70">{icon}</span>
      <span>{label}</span>
    </div>
  )
}
