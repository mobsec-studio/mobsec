import { cn } from '@/lib/utils'

interface ProgressProps {
  value: number
  max?: number
  className?: string
  indeterminate?: boolean
}

export function Progress({
  value,
  max = 100,
  className,
  indeterminate = false
}: ProgressProps): JSX.Element {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-surface-raised', className)}>
      {indeterminate ? (
        <div className="absolute inset-y-0 left-0 w-1/3 animate-[shimmer_1.4s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-primary/0 via-primary to-primary/0" />
      ) : (
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      )}
    </div>
  )
}
