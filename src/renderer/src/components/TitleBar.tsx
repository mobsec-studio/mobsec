import { Minus, Square, X } from 'lucide-react'
import { useEffect } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { ProjectPicker } from './ProjectPicker'
import { DevicePicker } from './DevicePicker'
import { ThemeToggle } from './ThemeToggle'
import { MobSecIcon } from './MobSecLogo'

export function TitleBar(): JSX.Element {
  const isMaximized = useAppStore((s) => s.isMaximized)
  const setMaximized = useAppStore((s) => s.setMaximized)

  useEffect(() => {
    return window.api.on.onWindowMaximizedChanged((max) => setMaximized(max))
  }, [setMaximized])

  return (
    <header
      className={cn(
        'titlebar-drag relative flex h-10 shrink-0 items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl'
      )}
    >
      <div className="titlebar-no-drag flex items-center gap-2 pl-3">
        <MobSecIcon size={22} />
        <span className="font-semibold tracking-tight text-foreground">MobSec Studio</span>
        <span className="rounded border border-warning/40 bg-warning/10 px-1.5 py-px font-mono text-2xs text-warning">
          beta
        </span>
      </div>

      <div className="titlebar-no-drag absolute inset-x-1/2 top-1/2 flex min-w-0 max-w-[calc(100vw-25rem)] -translate-x-1/2 -translate-y-1/2 items-center gap-2">
        <ProjectPicker />
        <div className="h-4 w-px bg-border" />
        <DevicePicker />
      </div>

      <div className="titlebar-no-drag flex h-full items-center">
        <div className="px-2">
          <ThemeToggle />
        </div>
        <div className="flex h-full items-stretch">
          <TitleBarButton
            aria-label="Minimize"
            tooltip="Minimize"
            onClick={() => window.api.app.minimizeWindow()}
          >
            <Minus className="h-3.5 w-3.5" strokeWidth={1.5} />
          </TitleBarButton>
          <TitleBarButton
            aria-label={isMaximized ? 'Restore' : 'Maximize'}
            tooltip={isMaximized ? 'Restore' : 'Maximize'}
            onClick={() => window.api.app.maximizeWindow()}
          >
            {isMaximized ? <RestoreIcon /> : <Square className="h-3 w-3" strokeWidth={1.5} />}
          </TitleBarButton>
          <TitleBarButton
            aria-label="Close"
            tooltip="Close"
            danger
            onClick={() => window.api.app.closeWindow()}
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
          </TitleBarButton>
        </div>
      </div>
    </header>
  )
}

function RestoreIcon(): JSX.Element {
  return (
    <svg
      viewBox="0 0 12 12"
      width={12}
      height={12}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
    >
      <rect x="3" y="1" width="8" height="8" rx="0.5" />
      <rect x="1" y="3" width="8" height="8" rx="0.5" fill="hsl(var(--background))" />
    </svg>
  )
}

interface TitleBarButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tooltip: string
  danger?: boolean
}

function TitleBarButton({
  tooltip,
  danger = false,
  className,
  children,
  ...props
}: TitleBarButtonProps): JSX.Element {
  return (
    <Tooltip delayDuration={400}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-full w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground',
            danger && 'hover:bg-destructive hover:text-destructive-foreground',
            className
          )}
          {...props}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  )
}
