import {
  ArrowUpRight,
  Cpu,
  FileCode2,
  FileSearch,
  Layers,
  Network,
  Repeat,
  ScrollText,
  ShieldCheck,
  Smartphone,
  Wrench
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useUIStore, type ToolId } from '@/stores/useUIStore'
import { useAppStore } from '@/stores/useAppStore'
import { useEmulatorStore } from '@/stores/useEmulatorStore'
import { useProxyStore } from '@/stores/useProxyStore'
import { cn, formatBytes } from '@/lib/utils'
import { Button } from '../ui/button'

interface QuickAction {
  id: ToolId
  title: string
  description: string
  icon: typeof Network
  accent: string
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'proxy',
    title: 'HTTP Proxy',
    description: 'Intercept and inspect every request leaving the emulator on localhost:8080.',
    icon: Network,
    accent: 'from-primary/15 to-transparent'
  },
  {
    id: 'repeater',
    title: 'Request Repeater',
    description: 'Replay and tamper with captured requests in a Monaco-powered editor.',
    icon: Repeat,
    accent: 'from-accent/15 to-transparent'
  },
  {
    id: 'frida',
    title: 'Frida Runtime',
    description: 'Hook live processes — bypass SSL pinning, root detection, and more.',
    icon: Cpu,
    accent: 'from-warning/15 to-transparent'
  },
  {
    id: 'apk',
    title: 'APK Analyzer',
    description: 'Inspect manifests, attack surface, endpoints, and hard-coded secrets statically.',
    icon: FileSearch,
    accent: 'from-success/15 to-transparent'
  },
  {
    id: 'jadx',
    title: 'JADX Workbench',
    description: 'Decompile packages into browsable Java and run code-review intelligence.',
    icon: FileCode2,
    accent: 'from-accent/15 to-transparent'
  },
  {
    id: 'logcat',
    title: 'Logcat Stream',
    description: 'Filter and tail Android logs in real-time with level and tag filters.',
    icon: ScrollText,
    accent: 'from-primary/10 to-transparent'
  },
  {
    id: 'tools',
    title: 'Other Tools',
    description: 'Check root capability and run focused Android device utilities.',
    icon: Wrench,
    accent: 'from-warning/10 to-transparent'
  }
]

export function DashboardTab(): JSX.Element {
  const setActiveTool = useUIStore((s) => s.setActiveTool)
  const project = useAppStore((s) => s.activeProject)
  const emu = useEmulatorStore((s) => s.status)
  const proxy = useProxyStore((s) => s.status)
  const requestCount = useProxyStore((s) => s.requests.length)
  const latestSize = useProxyStore((s) => s.requests[0]?.size ?? 0)

  return (
    <div className="h-full overflow-auto">
      <div className="grid-bg mx-auto max-w-6xl px-8 py-10">
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span>{project?.name ?? 'Untitled project'}</span>
          </div>
          <h1 className="text-gradient text-3xl font-semibold tracking-tight">
            Welcome back to MobSec Studio.
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            A unified workbench for pentesting Android apps — emulator, proxy, instrumentation, and
            static analysis in a single workspace. Everything runs locally; nothing leaves your
            machine.
          </p>
        </motion.header>

        <section className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-3">
          <StatCard
            icon={<Smartphone className="h-4 w-4" />}
            title="Emulator"
            value={emu.state}
            hint={emu.avdName ?? 'No AVD selected'}
          />
          <StatCard
            icon={<Network className="h-4 w-4" />}
            title="Proxy"
            value={proxy.state}
            hint={`Listening on :${proxy.port}`}
          />
          <StatCard
            icon={<Layers className="h-4 w-4" />}
            title="Captured Requests"
            value={String(proxy.state === 'running' ? requestCount : 0)}
            hint={
              proxy.state === 'running'
                ? requestCount === 0
                  ? 'Run an app to start collecting traffic'
                  : `Most recent: ${formatBytes(latestSize)}`
                : 'Start the Proxy to begin capturing'
            }
          />
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Quick start</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK_ACTIONS.map((action, i) => (
              <motion.button
                key={action.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.04 * i }}
                onClick={() => setActiveTool(action.id)}
                className={cn(
                  'group relative overflow-hidden rounded-xl border border-border bg-surface/60 p-4 text-left transition-all duration-200',
                  'hover:-translate-y-0.5 hover:border-primary/40 hover:bg-surface-raised hover:shadow-[0_10px_30px_-15px_hsl(var(--primary)/0.4)]'
                )}
              >
                <div
                  className={cn(
                    'absolute inset-0 -z-10 bg-gradient-to-br opacity-0 transition-opacity group-hover:opacity-100',
                    action.accent
                  )}
                />
                <div className="flex items-start justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-raised text-primary">
                    <action.icon className="h-4 w-4" strokeWidth={1.5} />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
                </div>
                <h3 className="mt-3 text-sm font-medium tracking-tight">{action.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {action.description}
                </p>
              </motion.button>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-surface/40 p-6">
          <div className="flex items-start justify-between gap-6">
            <div className="max-w-xl space-y-2">
              <h2 className="text-base font-semibold tracking-tight">First-run setup</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                MobSec Studio downloads its toolchain (Android SDK, scrcpy, mitmproxy, frida-server,
                apktool, jadx) on first launch so the installer stays small. Setup runs in the
                background and only fetches what&apos;s missing.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setActiveTool('settings')}>
              Review setup
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}

interface StatCardProps {
  icon: React.ReactNode
  title: string
  value: string
  hint: string
}

function StatCard({ icon, title, value, hint }: StatCardProps): JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-surface/60 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}
        <span>{title}</span>
      </div>
      <div className="mt-2 text-lg font-semibold capitalize text-foreground">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
    </div>
  )
}
