import { Check, FolderKanban, Plus, Settings2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useProjectsStore } from '@/stores/useProjectsStore'
import { useUIStore } from '@/stores/useUIStore'
import { Kbd } from './ui/kbd'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog'
import { Button } from './ui/button'

export function ProjectPicker(): JSX.Element {
  const projects = useProjectsStore((s) => s.projects)
  const active = useProjectsStore((s) => s.active)
  const hydrate = useProjectsStore((s) => s.hydrate)
  const setActive = useProjectsStore((s) => s.setActive)
  const create = useProjectsStore((s) => s.create)
  const openSettingsSection = useUIStore((s) => s.openSettingsSection)

  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  const submitNew = async (): Promise<void> => {
    const name = newName.trim()
    if (!name) return
    try {
      const created = await create(name)
      await setActive(created.id)
      toast.success('Project created', { description: name })
      setCreating(false)
      setNewName('')
    } catch (err) {
      toast.error('Failed to create project', {
        description: err instanceof Error ? err.message : String(err)
      })
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="titlebar-no-drag group flex h-7 min-w-[10rem] max-w-[22vw] items-center gap-2 rounded-md border border-border/60 bg-surface/60 px-2.5 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-surface-raised xl:w-80"
          >
            <FolderKanban className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">
              <span className="text-foreground">{active?.name ?? 'No project'}</span>
              <span className="hidden sm:inline">
                <span className="px-1 text-muted-foreground/50">-</span>
                <span>Switch project or search...</span>
              </span>
            </span>
            <Kbd className="ml-1 h-5 min-w-[3rem] shrink-0 whitespace-nowrap rounded-md border-border/70 bg-background/70 px-1.5 text-[10px] font-semibold leading-none text-muted-foreground/80 shadow-none">
              Ctrl+K
            </Kbd>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="min-w-[260px]">
          <DropdownMenuLabel>Projects ({projects.length})</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {projects.length === 0 ? (
            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
              No projects yet
            </DropdownMenuItem>
          ) : (
            projects.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onSelect={() => {
                  void setActive(p.id).catch((err) =>
                    toast.error('Failed to switch project', {
                      description: err instanceof Error ? err.message : String(err)
                    })
                  )
                }}
              >
                <span className="flex h-4 w-4 items-center justify-center">
                  {active?.id === p.id ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                </span>
                <span className="flex-1 truncate">{p.name}</span>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5" /> New project
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openSettingsSection('projects')}>
            <Settings2 className="h-3.5 w-3.5" /> Manage projects
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>
              Projects scope captured proxy traffic, repeater tabs, and saved Frida scripts. Each
              one is independent - switch between them any time.
            </DialogDescription>
          </DialogHeader>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submitNew()
              if (e.key === 'Escape') setCreating(false)
            }}
            placeholder="e.g. Acme Bank - May 2026"
            className="h-9 rounded-md border border-border bg-surface px-3 font-mono text-sm text-foreground outline-none focus:border-primary"
          />
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={!newName.trim()} onClick={() => void submitNew()}>
              Create &amp; switch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
