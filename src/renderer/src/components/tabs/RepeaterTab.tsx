import {
  AlertTriangle,
  Copy,
  Eraser,
  Loader2,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Repeat,
  Send,
  Trash2
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Button } from '../ui/button'
import { useRepeaterStore } from '@/stores/useRepeaterStore'
import { TabBar } from '../repeater/TabBar'
import { RequestEditor } from '../repeater/RequestEditor'
import { ResponseViewer } from '../repeater/ResponseViewer'
import { HistoryNav } from '../repeater/HistoryNav'
import { InspectorPanel } from '../repeater/InspectorPanel'
import { toCurl } from '../repeater/toCurl'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { EmptyState } from '../EmptyState'

export function RepeaterTab(): JSX.Element {
  const tabs = useRepeaterStore((s) => s.tabs)
  const activeId = useRepeaterStore((s) => s.activeTabId)
  const sending = useRepeaterStore((s) => s.sending)
  const hydrate = useRepeaterStore((s) => s.hydrate)
  const createTab = useRepeaterStore((s) => s.createTab)
  const deleteTab = useRepeaterStore((s) => s.deleteTab)
  const sendTab = useRepeaterStore((s) => s.sendTab)
  const selectTab = useRepeaterStore((s) => s.selectTab)
  const patchTab = useRepeaterStore((s) => s.patchTab)
  const updateTab = useRepeaterStore((s) => s.updateTab)
  const deleteAllTabs = useRepeaterStore((s) => s.deleteAllTabs)

  // Per-tab "which history snapshot am I viewing?" — null means the live
  // editable draft. We keep this in component state (not the store) so the
  // selection survives tab switches but resets after a reload (intentional).
  const [viewingByTab, setViewingByTab] = useState<Record<string, number | null>>({})
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const importFromUrl = useRepeaterStore((s) => s.importFromUrl)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  // Listen for cross-tab "send to repeater" events. The APK Analyzer's
  // SendToRepeaterButton dispatches via the store directly now, but we
  // keep this window-event handler too because it's a stable contract
  // any future surface (proxy row → repeater, exported flow file → ...)
  // can hook into without reaching into the store from afar.
  useEffect(() => {
    const handler = (e: Event): void => {
      const detail = (e as CustomEvent<{ url?: string; method?: string; headers?: string; body?: string }>)
        .detail
      if (!detail?.url) return
      void importFromUrl({
        url: detail.url,
        method: detail.method,
        headers: detail.headers,
        body: detail.body
      }).catch((err) => {
        toast.error('Import failed', {
          description: err instanceof Error ? err.message : String(err)
        })
      })
    }
    window.addEventListener('mobsec.repeater.import', handler as EventListener)
    return () => window.removeEventListener('mobsec.repeater.import', handler as EventListener)
  }, [importFromUrl])

  const active = useMemo(() => tabs.find((t) => t.id === activeId), [tabs, activeId])
  const viewing = active ? (viewingByTab[active.id] ?? null) : null
  const viewingSnapshot =
    active && viewing !== null ? (active.history[viewing] ?? null) : null

  const setViewing = (idx: number | null): void => {
    if (!active) return
    setViewingByTab((prev) => ({ ...prev, [active.id]: idx }))
  }

  // Debounced autosave: persist any edit ~600ms after the last keystroke.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleSave = (id: string): void => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const tab = useRepeaterStore.getState().tabs.find((t) => t.id === id)
      if (tab) void updateTab(tab).catch(() => undefined)
    }, 600)
  }

  const handleNew = async (): Promise<void> => {
    try {
      await createTab()
    } catch (err) {
      toast.error('Failed to create tab', {
        description: err instanceof Error ? err.message : String(err)
      })
    }
  }

  const handleSend = async (): Promise<void> => {
    if (!active) return
    const problem = validateHttpUrl(active.url)
    if (problem) {
      toast.warning('Cannot send request', { description: problem })
      return
    }
    try {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        saveTimer.current = null
      }
      await updateTab(active)
      const sent = await sendTab(active)
      // After a send, jump back to the live draft view so the new result is
      // what the user sees (otherwise they'd still be looking at an older
      // snapshot if they were browsing).
      if (sent) setViewing(null)
      const failed = sent?.history.at(-1)?.error
      if (failed) toast.error('Network error', { description: failed })
    } catch (err) {
      toast.error('Send failed', {
        description: err instanceof Error ? err.message : String(err)
      })
    }
  }

  const handleDelete = async (id: string): Promise<void> => {
    try {
      await deleteTab(id)
    } catch (err) {
      toast.error('Failed to delete tab', {
        description: err instanceof Error ? err.message : String(err)
      })
    }
  }

  const handleCopyCurl = async (): Promise<void> => {
    if (!active) return
    try {
      await navigator.clipboard.writeText(toCurl(active))
      toast.success('Copied as cURL')
    } catch (err) {
      toast.error('Copy failed', {
        description: err instanceof Error ? err.message : String(err)
      })
    }
  }

  const restoreSnapshot = (): void => {
    if (!active || viewing === null) return
    const snap = active.history[viewing]
    if (!snap) return
    patchTab(active.id, {
      method: snap.request.method,
      url: snap.request.url,
      headers: snap.request.headers,
      body: snap.request.body
    })
    scheduleSave(active.id)
    setViewing(null)
    toast.success('Snapshot restored to editor')
  }

  if (tabs.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-surface/30 px-4">
          <Repeat className="h-4 w-4 text-primary" />
          <h1 className="text-sm font-semibold tracking-tight">Repeater</h1>
        </header>
        <div className="flex-1">
          <EmptyState
            icon={Repeat}
            title="Resend and tamper with requests"
            description="Create a blank request, or use Send to Repeater from a captured proxy row. Every send is recorded so you can step back through history with the ← → arrows."
            action={
              <Button onClick={() => void handleNew()}>
                <Repeat className="h-3.5 w-3.5" /> New blank request
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  const isPending = active ? sending.has(active.id) : false
  const settings = active?.settings ?? {
    autoContentLength: true,
    followRedirects: false,
    repeatCount: 1
  }
  const urlProblem = active ? validateHttpUrl(active.url) : 'Select a request tab.'

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-surface/30 px-4">
        <Repeat className="h-4 w-4 text-primary" />
        <h1 className="text-sm font-semibold tracking-tight">Repeater</h1>
        <span className="ml-2 font-mono text-2xs text-muted-foreground">
          {tabs.length} {tabs.length === 1 ? 'tab' : 'tabs'}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" disabled={!active} onClick={() => void handleCopyCurl()}>
                <Copy className="h-3.5 w-3.5" /> Copy as cURL
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Copy this request as a shell-ready curl command</TooltipContent>
          </Tooltip>
          {active && (
            <SettingsDropdown
              settings={settings}
              onChange={(next) => {
                patchTab(active.id, { settings: { ...settings, ...next } })
                scheduleSave(active.id)
              }}
            />
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" disabled={tabs.length === 0} onClick={() => void deleteAllTabs()}>
                <Eraser className="h-3.5 w-3.5" /> Reset all
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Delete every saved repeater tab in this project</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" disabled={!active} onClick={() => active && void handleDelete(active.id)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete tab
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Delete the active tab</TooltipContent>
          </Tooltip>
          {/* Header used to host the Send button too — moved down to a
              prominent action bar above the request/response split so it
              never gets lost among the secondary actions. */}
        </div>
      </header>
      <TabBar
        tabs={tabs}
        activeId={activeId}
        onSelect={(id) => {
          selectTab(id)
        }}
        onClose={(id) => void handleDelete(id)}
        onNew={() => void handleNew()}
      />
      {active ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Action bar: a big primary Send sits above the split so it's
              the user's primary muscle-memory action. Inspector toggle
              lives here too — keeps the right panel easy to find
              without burying it in a settings menu. */}
          <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-surface/40 px-3">
            <Button
              size="sm"
              disabled={!active || isPending || !!urlProblem}
              onClick={() => void handleSend()}
              className="h-8 px-4 font-semibold"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending&hellip;
                </>
              ) : settings.repeatCount > 1 ? (
                <>
                  <Play className="h-4 w-4" /> Send &times; {settings.repeatCount}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Send
                </>
              )}
            </Button>
            {urlProblem ? (
              <span className="flex min-w-0 items-center gap-1 font-mono text-2xs text-warning">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                <span className="truncate">{urlProblem}</span>
              </span>
            ) : (
              <span className="font-mono text-2xs text-muted-foreground">
                Ctrl+Enter from the editor sends too
              </span>
            )}
            <div className="ml-auto">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setInspectorOpen(!inspectorOpen)}
                  >
                    {inspectorOpen ? (
                      <PanelRightClose className="h-3.5 w-3.5" />
                    ) : (
                      <PanelRightOpen className="h-3.5 w-3.5" />
                    )}
                    Inspector
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Show parsed query params, headers, cookies, and form fields.
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          <HistoryNav
            tab={active}
            viewing={viewing}
            onSelect={setViewing}
            onRestore={restoreSnapshot}
          />
          <ResizablePanelGroup
            direction="horizontal"
            autoSaveId="mobsec.repeater-split"
            className="flex-1"
          >
            <ResizablePanel defaultSize={45} minSize={20}>
              <RequestEditor
                tab={active}
                readOnly={viewing !== null}
                snapshot={viewingSnapshot?.request}
                onSubmit={() => void handleSend()}
                onChange={(patch) => {
                  if (viewing !== null) return // shouldn't fire while read-only
                  patchTab(active.id, patch)
                  scheduleSave(active.id)
                }}
              />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={inspectorOpen ? 35 : 55} minSize={20}>
              <ResponseViewer
                tab={active}
                pending={isPending}
                overrideResponse={
                  viewing !== null ? (viewingSnapshot?.response ?? null) : undefined
                }
                errorMessage={viewing !== null ? viewingSnapshot?.error : undefined}
              />
            </ResizablePanel>
            {inspectorOpen && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={20} minSize={15} maxSize={35}>
                  <InspectorPanel
                    tab={active}
                    responseOverride={
                      viewing !== null ? (viewingSnapshot?.response ?? null) : undefined
                    }
                  />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
          Select a tab to edit.
        </div>
      )}
    </div>
  )
}

interface SettingsDropdownProps {
  settings: { autoContentLength: boolean; followRedirects: boolean; repeatCount: number }
  onChange: (next: Partial<SettingsDropdownProps['settings']>) => void
}

function SettingsDropdown({ settings, onChange }: SettingsDropdownProps): JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost">
          <MoreHorizontal className="h-3.5 w-3.5" /> Options
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[240px]">
        <DropdownMenuLabel>Tab settings</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={settings.autoContentLength}
          onCheckedChange={(v) => onChange({ autoContentLength: !!v })}
        >
          Auto Content-Length
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={settings.followRedirects}
          onCheckedChange={(v) => onChange({ followRedirects: !!v })}
        >
          Follow 3xx redirects
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>
          Send count
          <span className="ml-2 font-normal text-muted-foreground/70">
            (for race tests / replay)
          </span>
        </DropdownMenuLabel>
        <div className="px-2 pb-2 pt-1">
          <input
            type="number"
            min={1}
            max={100}
            value={settings.repeatCount}
            onChange={(e) => {
              const n = Math.max(1, Math.min(100, Number(e.target.value) || 1))
              onChange({ repeatCount: n })
            }}
            className="h-8 w-full rounded-md border border-border bg-surface px-2 font-mono text-xs text-foreground outline-none focus:border-primary"
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function validateHttpUrl(raw: string): string | null {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return 'Use an absolute http:// or https:// URL.'
    }
    return null
  } catch {
    return 'Enter an absolute http:// or https:// URL.'
  }
}
