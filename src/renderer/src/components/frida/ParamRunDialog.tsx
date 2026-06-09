import { Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../ui/dialog'
import { Button } from '../ui/button'
import { cn } from '@/lib/utils'
import type { FridaParam } from './params'

interface ParamRunDialogProps {
  open: boolean
  title: string
  params: FridaParam[]
  initialValues: Record<string, string>
  /** Label on the primary button — "Attach", "Reload", "Spawn". */
  runLabel: string
  onCancel: () => void
  onRun: (values: Record<string, string>) => void
}

/**
 * Collects values for a parameterized Frida script before it runs.
 * Renders one control per `@param`: a text box for strings, a number
 * box for numbers, a toggle for booleans. Pre-filled with the user's
 * last-used values (or the script's declared defaults).
 *
 * This is what makes the generic built-ins (hook-method, trace-class,
 * native-trace) reusable across targets without touching their code —
 * the analyst fills the form, MobSec injects the values, the script
 * runs.
 */
export function ParamRunDialog({
  open,
  title,
  params,
  initialValues,
  runLabel,
  onCancel,
  onRun
}: ParamRunDialogProps): JSX.Element {
  const [values, setValues] = useState<Record<string, string>>({})

  // Seed each open with last-used-or-default values.
  useEffect(() => {
    if (!open) return
    const seeded: Record<string, string> = {}
    for (const p of params) {
      seeded[p.name] = initialValues[p.name] ?? p.defaultValue
    }
    setValues(seeded)
  }, [open, params, initialValues])

  const set = (name: string, value: string): void => {
    setValues((v) => ({ ...v, [name]: value }))
  }

  const canRun = params.every((p) => {
    if (p.type === 'string') return (values[p.name] ?? '').trim().length > 0
    return true
  })

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onCancel() : null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            This script declares parameters. Fill them in — the values are injected as
            constants at the top of the script before it runs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {params.map((p) => (
            <div key={p.name} className="space-y-1">
              <label className="flex items-center justify-between text-xs font-medium">
                <span>{p.label}</span>
                <span className="font-mono text-2xs text-muted-foreground">{p.name}</span>
              </label>
              {p.type === 'boolean' ? (
                <button
                  type="button"
                  onClick={() => set(p.name, values[p.name] === 'true' ? 'false' : 'true')}
                  className={cn(
                    'flex h-8 w-full items-center justify-between rounded-md border px-3 text-xs transition-colors',
                    values[p.name] === 'true'
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border bg-surface text-muted-foreground'
                  )}
                >
                  <span className="font-mono">{values[p.name] === 'true' ? 'true' : 'false'}</span>
                  <span
                    className={cn(
                      'h-4 w-7 rounded-full border transition-colors',
                      values[p.name] === 'true'
                        ? 'border-primary bg-primary/30'
                        : 'border-border bg-surface-raised'
                    )}
                  >
                    <span
                      className={cn(
                        'block h-3 w-3 translate-y-[1px] rounded-full bg-foreground transition-transform',
                        values[p.name] === 'true' ? 'translate-x-[14px]' : 'translate-x-[2px]'
                      )}
                    />
                  </span>
                </button>
              ) : (
                <input
                  type={p.type === 'number' ? 'number' : 'text'}
                  value={values[p.name] ?? ''}
                  onChange={(e) => set(p.name, e.target.value)}
                  spellCheck={false}
                  className="h-8 w-full rounded-md border border-border bg-surface px-2.5 font-mono text-xs text-foreground outline-none focus:border-primary"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canRun) onRun(values)
                  }}
                />
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" disabled={!canRun} onClick={() => onRun(values)}>
            <Play className="h-3.5 w-3.5" /> {runLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
