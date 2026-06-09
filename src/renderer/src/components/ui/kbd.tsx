import { cn } from '@/lib/utils'

interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode
}

export function Kbd({ className, children, ...props }: KbdProps): JSX.Element {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-surface-raised px-1.5 font-mono text-2xs text-muted-foreground shadow-[inset_0_-1px_0_0_hsl(var(--border))]',
        className
      )}
      {...props}
    >
      {children}
    </kbd>
  )
}
