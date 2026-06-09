import { Check, FolderKanban, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { Project } from '@shared/types'
import { useProjectsStore } from '@/stores/useProjectsStore'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog'

/**
 * Full project management surface for the Settings tab. The title-bar
 * picker handles quick-switch + create; this is where the user goes to
 * rename or delete projects without leaving the app.
 */
export function ProjectsManager(): JSX.Element {
  const projects = useProjectsStore((s) => s.projects)
  const active = useProjectsStore((s) => s.active)
  const hydrate = useProjectsStore((s) => s.hydrate)
  const setActive = useProjectsStore((s) => s.setActive)
  const rename = useProjectsStore((s) => s.rename)
  const remove = useProjectsStore((s) => s.remove)
  const create = useProjectsStore((s) => s.create)

  const [renameTarget, setRenameTarget] = useState<Project | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  const handleCreate = async (): Promise<void> => {
    const name = newName.trim()
    if (!name) return
    try {
      await create(name)
      setNewName('')
      setCreating(false)
      toast.success('Project created', { description: name })
    } catch (err) {
      toast.error('Create failed', {
        description: err instanceof Error ? err.message : String(err)
      })
    }
  }

  const handleRename = async (): Promise<void> => {
    if (!renameTarget) return
    const name = renameValue.trim()
    if (!name) return
    try {
      await rename(renameTarget.id, name)
      setRenameTarget(null)
      toast.success('Project renamed')
    } catch (err) {
      toast.error('Rename failed', {
        description: err instanceof Error ? err.message : String(err)
      })
    }
  }

  const handleDelete = async (): Promise<void> => {
    if (!deleteTarget) return
    try {
      await remove(deleteTarget.id)
      setDeleteTarget(null)
      toast.success('Project deleted', { description: deleteTarget.name })
    } catch (err) {
      toast.error('Delete failed', {
        description: err instanceof Error ? err.message : String(err)
      })
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-sm font-medium">Projects</h2>
          <p className="text-xs text-muted-foreground">
            Each project keeps its own proxy traffic, repeater tabs, and saved scripts. Switch any
            time — the active project is what the rest of the app reads from.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
          <Plus className="h-3.5 w-3.5" /> New project
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        {projects.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">
            No projects yet
          </div>
        ) : (
          projects.map((p, i) => {
            const isActive = active?.id === p.id
            return (
              <div
                key={p.id}
                className={cn(
                  'flex items-center gap-3 bg-surface/40 px-4 py-3 text-sm',
                  i > 0 && 'border-t border-border'
                )}
              >
                <FolderKanban
                  className={cn(
                    'h-4 w-4 shrink-0',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-foreground">{p.name}</span>
                    {isActive && (
                      <span className="inline-flex h-4 items-center rounded-md bg-primary/15 px-1.5 text-2xs font-medium uppercase tracking-wider text-primary">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-2xs text-muted-foreground">
                    Created {new Date(p.createdAt).toLocaleString()}
                  </div>
                </div>
                {!isActive && (
                  <Button size="sm" variant="ghost" onClick={() => void setActive(p.id)}>
                    <Check className="h-3.5 w-3.5" /> Set active
                  </Button>
                )}
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => {
                    setRenameValue(p.name)
                    setRenameTarget(p)
                  }}
                  aria-label="Rename project"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => setDeleteTarget(p)}
                  aria-label="Delete project"
                  disabled={projects.length <= 1}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )
          })
        )}
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>
              The new project starts empty. Switching to it doesn&apos;t affect other projects.
            </DialogDescription>
          </DialogHeader>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreate()
              if (e.key === 'Escape') setCreating(false)
            }}
            placeholder="e.g. ACME Banking — May 2026"
            className="h-9 rounded-md border border-border bg-surface px-3 font-mono text-sm text-foreground outline-none focus:border-primary"
          />
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={!newName.trim()} onClick={() => void handleCreate()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
            <DialogDescription>
              All captured traffic and saved tabs stay attached to this project.
            </DialogDescription>
          </DialogHeader>
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleRename()
              if (e.key === 'Escape') setRenameTarget(null)
            }}
            className="h-9 rounded-md border border-border bg-surface px-3 font-mono text-sm text-foreground outline-none focus:border-primary"
          />
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button size="sm" disabled={!renameValue.trim()} onClick={() => void handleRename()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete project</DialogTitle>
            <DialogDescription>
              This deletes <span className="font-semibold text-foreground">{deleteTarget?.name}</span>{' '}
              along with all its captured requests and repeater tabs. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={() => void handleDelete()}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
