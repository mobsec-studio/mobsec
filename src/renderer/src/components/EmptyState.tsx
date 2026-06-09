import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className
}: EmptyStateProps): JSX.Element {
  return (
    <div
      className={cn(
        'flex h-full flex-col items-center justify-center gap-4 px-8 text-center',
        className
      )}
    >
      <div className="relative">
        <div className="absolute inset-0 -z-10 m-auto h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface-raised shadow-inner">
          <Icon className="h-6 w-6 text-primary" strokeWidth={1.5} />
        </div>
      </div>
      <div className="max-w-md space-y-1.5">
        <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
