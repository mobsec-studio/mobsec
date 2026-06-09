import { Monitor, Moon, Sun } from 'lucide-react'
import type { ThemeMode } from '@/lib/theme'
import { useThemeStore } from '@/stores/useThemeStore'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

const OPTIONS: { mode: ThemeMode; icon: typeof Sun; label: string }[] = [
  { mode: 'light', icon: Sun, label: 'Light' },
  { mode: 'system', icon: Monitor, label: 'System' },
  { mode: 'dark', icon: Moon, label: 'Dark' }
]

/** Compact Light / System / Dark segmented control. */
export function ThemeToggle(): JSX.Element {
  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)

  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border bg-surface/60 p-0.5">
      {OPTIONS.map(({ mode: m, icon: Icon, label }) => (
        <Tooltip key={m} delayDuration={400}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setMode(m)}
              aria-label={`${label} theme`}
              aria-pressed={mode === m}
              className={cn(
                'flex h-6 w-7 items-center justify-center rounded-[5px] transition-colors',
                mode === m
                  ? 'bg-surface-raised text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{label} theme</TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}
