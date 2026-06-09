import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  HardDrive,
  Loader2,
  Smartphone,
  Sparkles,
  X,
  Zap
} from 'lucide-react'
import { toast } from 'sonner'
import { useEmulatorStore } from '@/stores/useEmulatorStore'
import { useAppStore } from '@/stores/useAppStore'
import { useSdkSetupStore } from '@/stores/useSdkSetupStore'
import { cn } from '@/lib/utils'
import { getRecommendedEmulatorAbi, isEmulatorAbiCompatible } from '@shared/sdk-compat'
import type { SdkSetupPhase } from '@shared/types'
import { Button } from './ui/button'
import { Progress } from './ui/progress'

const STEPS: { phase: SdkSetupPhase; label: string }[] = [
  { phase: 'downloading-cmdline-tools', label: 'Download command-line tools' },
  { phase: 'accepting-licenses', label: 'Accept SDK licenses' },
  { phase: 'installing-platform-tools', label: 'Install platform-tools (adb)' },
  { phase: 'installing-emulator', label: 'Install emulator runtime' },
  { phase: 'installing-platform', label: 'Install platform' },
  { phase: 'installing-system-image', label: 'Download system image (~1.4 GB)' },
  { phase: 'creating-avd', label: 'Create AVD' },
  { phase: 'configuring-avd', label: 'Tune AVD config' }
]

function stepIndex(phase: SdkSetupPhase): number {
  return STEPS.findIndex((s) => s.phase === phase)
}

export function SdkSetupCard(): JSX.Element {
  const progress = useSdkSetupStore((s) => s.progress)
  const options = useSdkSetupStore((s) => s.options)
  const setOptions = useSdkSetupStore((s) => s.setOptions)
  const info = useAppStore((s) => s.info)
  const isRunning = useSdkSetupStore((s) => s.isRunning)
  const startSetup = useSdkSetupStore((s) => s.start)
  const cancelSetup = useSdkSetupStore((s) => s.cancel)
  const hydrateEmulator = useEmulatorStore((s) => s.hydrate)
  const refreshAvds = useEmulatorStore((s) => s.refreshAvds)
  const hostPlatform = info?.platform
  const hostArch = info?.arch
  const recommendedAbi =
    hostPlatform && hostArch ? getRecommendedEmulatorAbi(hostPlatform, hostArch) : 'x86_64'
  const canUseArm64 = recommendedAbi === 'arm64-v8a'

  const currentIdx = isRunning ? stepIndex(progress.phase) : -1
  const isDone = progress.phase === 'done'
  const isError = progress.phase === 'error'

  useEffect(() => {
    if (!hostPlatform || !hostArch) return
    if (!isEmulatorAbiCompatible(options.abi, hostPlatform, hostArch)) {
      const nextAbi = getRecommendedEmulatorAbi(hostPlatform, hostArch)
      const next: Partial<typeof options> = { abi: nextAbi }
      if (nextAbi === 'arm64-v8a' && options.avdName === 'MobSec_Pixel5_API33') {
        next.avdName = 'MobSec_Pixel5_API33_ARM64'
      }
      if (nextAbi === 'x86_64' && options.avdName === 'MobSec_Pixel5_API33_ARM64') {
        next.avdName = 'MobSec_Pixel5_API33'
      }
      setOptions(next)
    }
  }, [hostArch, hostPlatform, options.abi, options.avdName, setOptions])

  const handleStart = async (): Promise<void> => {
    try {
      await startSetup()
      toast.success(`AVD "${options.avdName}" is ready`)
      await hydrateEmulator()
      await refreshAvds()
    } catch (err) {
      toast.error('SDK setup failed', {
        description: err instanceof Error ? err.message : String(err)
      })
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface/40">
      <div className="relative">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-primary/80">
                <Sparkles className="h-3.5 w-3.5" />
                Quick setup
              </div>
              <h3 className="text-base font-semibold tracking-tight">
                Install Android SDK + create your first AVD
              </h3>
              <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
                Downloads the command-line tools, accepts SDK licenses non-interactively, installs
                the emulator + a pre-rooted <span className="font-mono">google_apis</span> system
                image, and creates a tuned Pixel-class AVD ready for pentesting.
                <br />
                Total: <span className="text-foreground">~2 GB on disk</span>, typically 10-20
                minutes on a decent connection.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isRunning && (
                <Button variant="ghost" size="sm" onClick={() => void cancelSetup()}>
                  <X className="h-3.5 w-3.5" /> Cancel
                </Button>
              )}
              <Button onClick={() => void handleStart()} disabled={isRunning}>
                {isRunning ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Installing...
                  </>
                ) : isDone ? (
                  <>
                    <Zap className="h-3.5 w-3.5" />
                    Re-run setup
                  </>
                ) : (
                  <>
                    <Zap className="h-3.5 w-3.5" />
                    Run setup
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-2xs sm:grid-cols-4">
            <FormField label="AVD name" icon={<Smartphone className="h-3 w-3" />}>
              <input
                value={options.avdName}
                onChange={(e) => setOptions({ avdName: e.target.value })}
                disabled={isRunning}
                className="w-full bg-transparent font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/60"
              />
            </FormField>
            <FormField label="Device profile" icon={<Smartphone className="h-3 w-3" />}>
              <select
                value={options.deviceProfile}
                onChange={(e) => setOptions({ deviceProfile: e.target.value })}
                disabled={isRunning}
                className="w-full bg-transparent font-mono text-xs text-foreground outline-none"
              >
                <option className="bg-background" value="pixel_5">
                  pixel_5
                </option>
                <option className="bg-background" value="pixel_6">
                  pixel_6
                </option>
                <option className="bg-background" value="pixel_3a">
                  pixel_3a
                </option>
                <option className="bg-background" value="pixel_tablet">
                  pixel_tablet
                </option>
              </select>
            </FormField>
            <FormField label="API / ABI" icon={<Cpu className="h-3 w-3" />}>
              <select
                value={`${options.apiLevel}/${options.abi}`}
                onChange={(e) => {
                  const [apiStr, abi] = (e.target.value || '').split('/')
                  setOptions({
                    apiLevel: Number(apiStr),
                    abi: (abi as 'x86_64' | 'arm64-v8a') ?? 'x86_64'
                  })
                }}
                disabled={isRunning}
                className="w-full bg-transparent font-mono text-xs text-foreground outline-none"
              >
                <option className="bg-background" value="33/x86_64">
                  33 / x86_64
                </option>
                <option className="bg-background" value="33/arm64-v8a" disabled={!canUseArm64}>
                  33 / arm64-v8a{canUseArm64 ? '' : ' (ARM host only)'}
                </option>
                <option className="bg-background" value="34/x86_64">
                  34 / x86_64
                </option>
                <option className="bg-background" value="30/x86_64">
                  30 / x86_64
                </option>
              </select>
            </FormField>
            <FormField label="RAM / disk" icon={<HardDrive className="h-3 w-3" />}>
              <div className="flex items-center gap-1 font-mono text-xs">
                <input
                  type="number"
                  value={options.ramMb}
                  min={1024}
                  step={512}
                  onChange={(e) => setOptions({ ramMb: Number(e.target.value) })}
                  disabled={isRunning}
                  className="w-16 bg-transparent text-foreground outline-none"
                />
                <span className="text-muted-foreground">MB</span>
                <span className="px-1 text-muted-foreground/40">/</span>
                <input
                  type="number"
                  value={options.diskGb}
                  min={2}
                  step={1}
                  onChange={(e) => setOptions({ diskGb: Number(e.target.value) })}
                  disabled={isRunning}
                  className="w-10 bg-transparent text-foreground outline-none"
                />
                <span className="text-muted-foreground">GB</span>
              </div>
            </FormField>
          </div>

          <AnimatePresence initial={false}>
            {(isRunning || isDone || isError) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between text-2xs uppercase tracking-wider text-muted-foreground">
                    <span>{progress.message || 'Working...'}</span>
                    <span>{Math.round(progress.overallPercent)}%</span>
                  </div>
                  <Progress
                    value={progress.overallPercent}
                    indeterminate={isRunning && progress.overallPercent === 0}
                  />

                  <ol className="space-y-1.5">
                    {STEPS.map((step, i) => {
                      const idx = currentIdx
                      const state: 'done' | 'active' | 'pending' =
                        isDone || (idx >= 0 && i < idx) ? 'done' : idx === i ? 'active' : 'pending'
                      return (
                        <li key={step.phase} className="flex items-center gap-2 text-xs">
                          <StepIcon state={state} error={isError && i === idx} />
                          <span
                            className={cn(
                              'flex-1',
                              state === 'pending' && 'text-muted-foreground/60',
                              state === 'active' && 'text-foreground',
                              state === 'done' && 'text-muted-foreground'
                            )}
                          >
                            {step.label}
                          </span>
                          {state === 'active' && progress.stepPercent > 0 && (
                            <span className="font-mono text-2xs text-muted-foreground">
                              {Math.round(progress.stepPercent)}%
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ol>

                  {isError && progress.errorMessage && (
                    <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                      <span className="text-destructive">{progress.errorMessage}</span>
                    </div>
                  )}

                  {isDone && (
                    <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 p-3 text-xs text-success">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      AVD <span className="font-mono">{options.avdName}</span> is ready - open the
                      Emulator panel and press Start.
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

interface FormFieldProps {
  label: string
  icon: React.ReactNode
  children: React.ReactNode
}

function FormField({ label, icon, children }: FormFieldProps): JSX.Element {
  return (
    <label className="block rounded-md border border-border bg-surface/40 px-2.5 py-1.5">
      <span className="flex items-center gap-1 text-2xs uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

interface StepIconProps {
  state: 'done' | 'active' | 'pending'
  error: boolean
}

function StepIcon({ state, error }: StepIconProps): JSX.Element {
  if (error) {
    return (
      <span className="flex h-4 w-4 items-center justify-center">
        <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
      </span>
    )
  }
  if (state === 'done') {
    return (
      <span className="flex h-4 w-4 items-center justify-center">
        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
      </span>
    )
  }
  if (state === 'active') {
    return (
      <span className="flex h-4 w-4 items-center justify-center">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
      </span>
    )
  }
  return (
    <span className="flex h-4 w-4 items-center justify-center">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
    </span>
  )
}
