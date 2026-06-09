import { ChevronLeft, ChevronRight, RotateCcw, Square } from 'lucide-react'
import type { RepeaterTab } from '@shared/types'
import { cn, formatDuration } from '@/lib/utils'
import { statusTone } from '../proxy/methodColor'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { Button } from '../ui/button'

interface HistoryNavProps {
  tab: RepeaterTab
  /** Index into tab.history, or null when editing the live draft. */
  viewing: number | null
  onSelect: (index: number | null) => void
  onRestore: () => void
}

export function HistoryNav({ tab, viewing, onSelect, onRestore }: HistoryNavProps): JSX.Element {
  const total = tab.history.length
  const current = viewing === null ? null : tab.history[viewing]
  const status = current?.response?.status ?? (current?.error ? -1 : null)
  const sentAt = current?.sentAt ? new Date(current.sentAt) : null

  const canPrev = total > 0 && (viewing === null || viewing > 0)
  const canNext = viewing !== null && viewing < total - 1

  return (
    <div className="flex h-7 shrink-0 items-center gap-2 border-b border-border bg-surface/30 px-3 text-2xs">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => {
              if (viewing === null) onSelect(total - 1)
              else if (viewing > 0) onSelect(viewing - 1)
            }}
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground transition-colors',
              canPrev
                ? 'hover:bg-surface-raised hover:text-foreground'
                : 'cursor-not-allowed opacity-30'
            )}
            aria-label="Previous send"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Previous send</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={!canNext}
            onClick={() => {
              if (viewing !== null && viewing < total - 1) onSelect(viewing + 1)
            }}
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground transition-colors',
              canNext
                ? 'hover:bg-surface-raised hover:text-foreground'
                : 'cursor-not-allowed opacity-30'
            )}
            aria-label="Next send"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Next send</TooltipContent>
      </Tooltip>

      <span className="font-mono text-muted-foreground">
        {viewing === null ? (
          <>
            Draft <span className="text-muted-foreground/60">·</span>{' '}
            {total === 0 ? 'no sends yet' : `${total} send${total === 1 ? '' : 's'} in history`}
          </>
        ) : (
          <>
            Send {viewing + 1}/{total}
            {sentAt && (
              <>
                {' '}
                <span className="text-muted-foreground/60">·</span>{' '}
                {sentAt.toLocaleTimeString()}
              </>
            )}
            {status !== null && status >= 0 && (
              <>
                {' '}
                <span className="text-muted-foreground/60">·</span>{' '}
                <span className={cn('font-semibold', statusTone(status))}>{status}</span>
              </>
            )}
            {current?.response?.durationMs !== undefined && (
              <>
                {' '}
                <span className="text-muted-foreground/60">·</span>{' '}
                {formatDuration(current.response.durationMs)}
              </>
            )}
            {current?.error && (
              <>
                {' '}
                <span className="text-muted-foreground/60">·</span>{' '}
                <span className="text-destructive">{current.error}</span>
              </>
            )}
          </>
        )}
      </span>

      <div className="ml-auto flex items-center gap-1">
        {viewing !== null && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" className="h-5 px-2" onClick={onRestore}>
                <RotateCcw className="h-3 w-3" /> Restore to editor
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Copy this snapshot back into the editor so you can resend with edits
            </TooltipContent>
          </Tooltip>
        )}
        {viewing !== null && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-5 px-2"
                onClick={() => onSelect(null)}
              >
                <Square className="h-3 w-3" /> Back to draft
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Show the live editable draft</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
