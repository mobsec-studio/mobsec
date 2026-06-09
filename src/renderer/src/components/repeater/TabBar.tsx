import { Plus, X } from 'lucide-react'
import type { RepeaterTab } from '@shared/types'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { methodTone } from '../proxy/methodColor'

interface TabBarProps {
  tabs: RepeaterTab[]
  activeId: string | null
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onNew: () => void
}

/**
 * Numbered tab strip for managing multiple concurrent requests. Each tab shows:
 *   - A 1-based ordinal so the analyst can jump between tabs by number.
 *   - The HTTP method, color-coded for instant recognition
 *     (GET blue, POST green, DELETE red, etc.).
 *   - A truncated label — host preferred, falls back to the saved name.
 *   - A close button that appears on hover to keep the strip uncluttered.
 */
export function TabBar({ tabs, activeId, onSelect, onClose, onNew }: TabBarProps): JSX.Element {
  return (
    <div className="flex h-9 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border bg-surface/40 px-2">
      {tabs.map((tab, idx) => {
        const active = tab.id === activeId
        const label = labelFor(tab)
        return (
          <div
            key={tab.id}
            className={cn(
              'group flex h-7 max-w-[18rem] shrink-0 items-center gap-1.5 rounded-t-md border-b-2 px-2.5 text-xs transition-colors',
              active
                ? 'border-primary bg-surface-raised text-foreground'
                : 'border-transparent text-muted-foreground hover:bg-surface-raised/60 hover:text-foreground'
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(tab.id)}
              className="flex min-w-0 items-center gap-1.5"
              title={`${tab.method} ${tab.url}`}
            >
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground/80">
                {idx + 1}
              </span>
              <span className={cn('shrink-0 font-mono text-[10px] font-semibold', methodTone(tab.method))}>
                {tab.method.toUpperCase()}
              </span>
              <span className="truncate font-mono text-2xs">{label}</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onClose(tab.id)
              }}
              className="ml-auto rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-surface-overlay hover:text-foreground group-hover:opacity-100"
              aria-label="Close tab"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )
      })}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onNew}
            className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-raised hover:text-foreground"
            aria-label="New tab"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">New request</TooltipContent>
      </Tooltip>
    </div>
  )
}

function labelFor(tab: RepeaterTab): string {
  // Prefer the URL host for the label; fall back to the saved
  // user-friendly name when the URL is blank (freshly created tab).
  try {
    const u = new URL(tab.url)
    return u.host + (u.pathname && u.pathname !== '/' ? u.pathname : '')
  } catch {
    return tab.name || 'untitled'
  }
}
