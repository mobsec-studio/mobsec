import { AlertTriangle, FolderKanban, Network, Save, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { CloseConfirmAction, ProjectSummary } from '@shared/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog'
import { Button } from './ui/button'

/**
 * Wired to the `window.on.onWindowCloseRequested` event. The main process
 * intercepts the close, sends the current project's session summary, and we
 * present the user with three actions:
 *   - Save & close  → just close; the data persists in the current project
 *   - Discard       → wipe captured requests + repeater tabs, then close
 *   - Cancel        → don't close
 *
 * A "Don't ask again" checkbox writes a setting so future closes go through
 * without prompting.
 */
export function CloseConfirmDialog(): JSX.Element {
  const [open, setOpen] = useState(false)
  const [summary, setSummary] = useState<ProjectSummary | null>(null)
  const [dontAskAgain, setDontAskAgain] = useState(false)
  const [busy, setBusy] = useState<CloseConfirmAction | null>(null)

  useEffect(() => {
    return window.api.on.onWindowCloseRequested((s) => {
      setSummary(s)
      setDontAskAgain(false)
      setOpen(true)
    })
  }, [])

  const respond = async (action: CloseConfirmAction): Promise<void> => {
    setBusy(action)
    const res = await window.api.app.confirmClose(action, dontAskAgain)
    setBusy(null)
    if (!res.ok) {
      toast.error('Close failed', { description: res.error })
      return
    }
    if (action === 'cancel') setOpen(false)
    // 'save'/'discard' close the window — no further UI work needed.
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) void respond('cancel')
      }}
    >
      <DialogContent showClose={false} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Save this session?</DialogTitle>
          <DialogDescription>
            Your work below stays in the active project so you can pick it up next time. Discard
            it if you&apos;d rather start fresh on the next launch.
          </DialogDescription>
        </DialogHeader>

        {summary && (
          <div className="rounded-lg border border-border bg-surface/60 p-4 text-sm">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <FolderKanban className="h-3.5 w-3.5" />
              {summary.project.name}
            </div>
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <Stat label="Captured requests" value={summary.capturedRequests} />
              <Stat label="Repeater tabs" value={summary.repeaterTabs} />
            </dl>
          </div>
        )}

        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={dontAskAgain}
            onChange={(e) => setDontAskAgain(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-border bg-surface accent-primary"
          />
          Don&apos;t ask again — always save
        </label>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            variant="ghost"
            disabled={busy !== null}
            onClick={() => void respond('cancel')}
          >
            Cancel
          </Button>
          {summary && summary.capturedRequests > 0 && summary.repeaterTabs > 0 && (
            <Button
              variant="outline"
              disabled={busy !== null}
              onClick={() => void respond('discard-proxy')}
              title="Wipe the noisy proxy capture but keep your curated repeater tabs"
            >
              <Network className="h-3.5 w-3.5" />
              {busy === 'discard-proxy' ? 'Clearing…' : 'Keep repeater only'}
            </Button>
          )}
          <Button
            variant="destructive"
            disabled={busy !== null}
            onClick={() => void respond('discard')}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {busy === 'discard' ? 'Discarding…' : 'Discard all'}
          </Button>
          <Button disabled={busy !== null} onClick={() => void respond('save')}>
            <Save className="h-3.5 w-3.5" />
            {busy === 'save' ? 'Saving…' : 'Save & close'}
          </Button>
        </DialogFooter>

        {summary && summary.capturedRequests > 5000 && (
          <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-2.5 text-2xs text-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Large session ({summary.capturedRequests.toLocaleString()} requests) — startup may take
            a moment when you reopen this project.
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Stat({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div>
      <dt className="text-2xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="font-mono text-base text-foreground">{value.toLocaleString()}</dd>
    </div>
  )
}
