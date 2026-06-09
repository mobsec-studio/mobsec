import Editor from '@monaco-editor/react'
import {
  AlertTriangle,
  Braces,
  CheckCircle2,
  ChevronRight,
  Code2,
  Download,
  FileCode2,
  FolderOpen,
  Loader2,
  PackageOpen,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Search,
  ShieldAlert,
  Trash2,
  Upload
} from 'lucide-react'
import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Progress } from '../ui/progress'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../ui/resizable'
import { cn } from '@/lib/utils'
import { useJadxStore } from '@/stores/useJadxStore'
import { useToolchainStore } from '@/stores/useToolchainStore'
import type { JadxCodeFinding, JadxFileEntry, JadxProgress, JadxReadFileResult, SecretFinding } from '@shared/types'

const INPUT_EXTENSIONS = ['apk', 'xapk', 'apks', 'apkm', 'aab', 'dex', 'jar', 'aar', 'zip']

export function JadxTab(): JSX.Element {
  const status = useJadxStore((s) => s.status)
  const project = useJadxStore((s) => s.project)
  const tree = useJadxStore((s) => s.tree)
  const inputPath = useJadxStore((s) => s.inputPath)
  const options = useJadxStore((s) => s.options)
  const selectedPath = useJadxStore((s) => s.selectedPath)
  const selectedContent = useJadxStore((s) => s.selectedContent)
  const selectedFile = useJadxStore((s) => s.selectedFile)
  const searchQuery = useJadxStore((s) => s.searchQuery)
  const searchResults = useJadxStore((s) => s.searchResults)
  const progress = useJadxStore((s) => s.progress)
  const error = useJadxStore((s) => s.error)
  const decompiling = useJadxStore((s) => s.decompiling)
  const reading = useJadxStore((s) => s.reading)
  const searching = useJadxStore((s) => s.searching)
  const refreshStatus = useJadxStore((s) => s.refreshStatus)
  const setInputPath = useJadxStore((s) => s.setInputPath)
  const patchOptions = useJadxStore((s) => s.patchOptions)
  const decompile = useJadxStore((s) => s.decompile)
  const selectFile = useJadxStore((s) => s.selectFile)
  const search = useJadxStore((s) => s.search)
  const revealOutput = useJadxStore((s) => s.revealOutput)
  const deleteProject = useJadxStore((s) => s.deleteProject)
  const installTool = useToolchainStore((s) => s.install)
  const toolProgress = useToolchainStore((s) => s.progress['jadx'])
  const hydrateTools = useToolchainStore((s) => s.hydrate)
  const [installing, setInstalling] = useState(false)
  const [setupOpen, setSetupOpen] = useState(true)
  const [filesOpen, setFilesOpen] = useState(true)
  const [insightsOpen, setInsightsOpen] = useState(true)

  const showSetup = setupOpen || !project
  const showFiles = !!project && filesOpen
  const showInsights = !!project && insightsOpen

  useEffect(() => {
    void refreshStatus()
    void hydrateTools()
  }, [hydrateTools, refreshStatus])

  const pickInput = async (): Promise<void> => {
    const res = await window.api.dialog.showOpen({
      title: 'Select file for JADX',
      filters: [
        { name: 'Android / Java package', extensions: INPUT_EXTENSIONS },
        { name: 'All files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })
    if (res.ok && res.value[0]) setInputPath(res.value[0])
  }

  const installJadx = async (): Promise<void> => {
    setInstalling(true)
    try {
      await installTool('jadx')
      await refreshStatus()
      toast.success('JADX installed')
    } catch (err) {
      toast.error('JADX install failed', {
        description: err instanceof Error ? err.message : String(err)
      })
    } finally {
      setInstalling(false)
    }
  }

  const onDrop = (event: DragEvent): void => {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0]
    if (!file) return
    const path = window.api.app.getFilePath(file)
    if (!path) {
      toast.error("Couldn't resolve the dropped file path.")
      return
    }
    setInputPath(path)
  }

  const openSearchHit = async (path: string): Promise<void> => {
    await selectFile(path)
  }

  return (
    <div className="flex h-full flex-col" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-surface/30 px-4">
        <FileCode2 className="h-4 w-4 text-primary" />
        <h1 className="text-sm font-semibold tracking-tight">JADX Workbench</h1>
        {project && (
          <Badge variant="muted" className="font-mono">
            {project.packageName ?? project.id}
          </Badge>
        )}
        {project?.completedWithErrors && <Badge variant="warning">JADX warnings</Badge>}
        <div className="ml-auto flex items-center gap-1">
          {project && (
            <>
              <div className="mr-1 flex items-center gap-1 rounded-md border border-border bg-surface/30 p-0.5">
                <PanelToggleButton
                  active={setupOpen}
                  title={setupOpen ? 'Collapse setup' : 'Show setup'}
                  onClick={() => setSetupOpen((open) => !open)}
                >
                  {setupOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
                </PanelToggleButton>
                <PanelToggleButton
                  active={filesOpen}
                  title={filesOpen ? 'Collapse files' : 'Show files'}
                  onClick={() => setFilesOpen((open) => !open)}
                >
                  <FolderOpen />
                </PanelToggleButton>
                <PanelToggleButton
                  active={insightsOpen}
                  title={insightsOpen ? 'Collapse intelligence' : 'Show intelligence'}
                  onClick={() => setInsightsOpen((open) => !open)}
                >
                  {insightsOpen ? <PanelRightClose /> : <PanelRightOpen />}
                </PanelToggleButton>
              </div>
              <Button variant="ghost" size="sm" onClick={() => void revealOutput()}>
                <FolderOpen className="h-3.5 w-3.5" /> Output
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void deleteProject()}>
                <Trash2 className="h-3.5 w-3.5" /> Clear
              </Button>
            </>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <ResizablePanelGroup direction="horizontal" autoSaveId="mobsec.jadx-root">
          {showSetup && (
            <>
              <ResizablePanel defaultSize={28} minSize={22} maxSize={38}>
                <aside className="flex h-full flex-col border-r border-border bg-surface/20">
                  <div className="space-y-3 overflow-auto p-3">
                    <ToolStatusCard
                      installed={!!status?.installed}
                      version={status?.version}
                      binaryPath={status?.binaryPath}
                      progressMessage={toolProgress?.message}
                      installing={installing}
                      onInstall={() => void installJadx()}
                    />

                    <div className="rounded-xl border border-border bg-surface/40 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-medium">
                          <PackageOpen className="h-3.5 w-3.5 text-primary" />
                          Input
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => void pickInput()}>
                          <Upload className="h-3.5 w-3.5" /> Choose
                        </Button>
                      </div>
                      <div className="min-h-16 rounded-md border border-dashed border-border bg-background/30 px-3 py-2">
                        {inputPath ? (
                          <div className="break-all font-mono text-2xs text-foreground">{inputPath}</div>
                        ) : (
                          <div className="flex h-12 items-center text-2xs text-muted-foreground">
                            Drop or choose APK, XAPK, APKS, APKM, AAB, DEX, JAR, AAR, or ZIP.
                          </div>
                        )}
                      </div>
                    </div>

                    <DecompileOptions options={options} onPatch={patchOptions} />

                    <Button
                      className="w-full"
                      disabled={!status?.installed || !inputPath || decompiling}
                      onClick={() => void decompile()}
                    >
                      {decompiling ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Decompiling...
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5" /> Decompile
                        </>
                      )}
                    </Button>

                    <DecompileProgressCard progress={progress} decompiling={decompiling} />

                    {toolProgress && toolProgress.phase !== 'done' && (
                      <div className="space-y-1 rounded-md border border-border bg-surface/40 px-3 py-2 text-2xs text-muted-foreground">
                        <div>{toolProgress.message}</div>
                        {toolProgress.bytesTotal > 0 && (
                          <Progress value={(toolProgress.bytesReceived / toolProgress.bytesTotal) * 100} />
                        )}
                      </div>
                    )}

                    {error && (
                      <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-2xs text-destructive">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}
                  </div>
                </aside>
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}

          <ResizablePanel defaultSize={showSetup ? 72 : 100} minSize={45}>
            {project ? (
              <ResizablePanelGroup direction="horizontal" autoSaveId="mobsec.jadx-workbench">
                {showFiles && (
                  <>
                    <ResizablePanel defaultSize={26} minSize={18} maxSize={36}>
                      <FileTreePanel
                        tree={tree}
                        selectedPath={selectedPath}
                        onSelect={(path) => void selectFile(path)}
                      />
                    </ResizablePanel>
                    <ResizableHandle withHandle />
                  </>
                )}
                <ResizablePanel defaultSize={showFiles && showInsights ? 48 : 72} minSize={30}>
                  <SourcePanel
                    path={selectedPath}
                    content={selectedContent}
                    file={selectedFile}
                    reading={reading}
                  />
                </ResizablePanel>
                {showInsights && (
                  <>
                    <ResizableHandle withHandle />
                    <ResizablePanel defaultSize={26} minSize={20} maxSize={40}>
                      <InsightsPanel
                        searchQuery={searchQuery}
                        searching={searching}
                        searchResults={searchResults}
                        onSearch={(query) => void search(query)}
                        onOpenHit={(path) => void openSearchHit(path)}
                      />
                    </ResizablePanel>
                  </>
                )}
              </ResizablePanelGroup>
            ) : (
              <EmptyWorkbench />
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  )
}

function PanelToggleButton({
  active,
  title,
  onClick,
  children
}: {
  active: boolean
  title: string
  onClick: () => void
  children: ReactNode
}): JSX.Element {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="icon-sm"
      title={title}
      aria-label={title}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

function DecompileProgressCard({
  progress,
  decompiling
}: {
  progress: JadxProgress | null
  decompiling: boolean
}): JSX.Element | null {
  if (!progress) return null
  if (!decompiling && progress.phase === 'done') return null
  const failed = progress.phase === 'error'
  const value = failed ? 100 : progress.percent
  return (
    <div
      className={cn(
        'space-y-2 rounded-md border bg-surface/40 px-3 py-2 text-2xs',
        failed ? 'border-destructive/35 text-destructive' : 'border-border text-muted-foreground'
      )}
    >
      <div className="flex items-center gap-2">
        {failed ? (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
        )}
        <span className="min-w-0 flex-1 truncate">{progress.message}</span>
        <span className="font-mono">{value}%</span>
      </div>
      <Progress value={value} />
      {progress.detail && <div className="line-clamp-3 font-mono text-[10px] opacity-80">{progress.detail}</div>}
    </div>
  )
}

function ToolStatusCard({
  installed,
  version,
  binaryPath,
  progressMessage,
  installing,
  onInstall
}: {
  installed: boolean
  version: string | null | undefined
  binaryPath: string | null | undefined
  progressMessage: string | undefined
  installing: boolean
  onInstall: () => void
}): JSX.Element {
  return (
    <div
      className={cn(
        'rounded-xl border bg-surface/40 p-3',
        installed ? 'border-success/30' : 'border-warning/35'
      )}
    >
      <div className="flex items-start gap-3">
        {installed ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
        ) : (
          <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium">{installed ? 'JADX ready' : 'JADX not installed'}</div>
          <div className="mt-0.5 truncate font-mono text-2xs text-muted-foreground">
            {installed ? version ?? binaryPath ?? 'installed' : progressMessage ?? 'Managed install available'}
          </div>
        </div>
        {!installed && (
          <Button size="sm" variant="outline" disabled={installing} onClick={onInstall}>
            {installing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Install
          </Button>
        )}
      </div>
    </div>
  )
}

function DecompileOptions({
  options,
  onPatch
}: {
  options: ReturnType<typeof useJadxStore.getState>['options']
  onPatch: (patch: Partial<ReturnType<typeof useJadxStore.getState>['options']>) => void
}): JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-surface/40 p-3">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium">
        <Braces className="h-3.5 w-3.5 text-primary" />
        Decode settings
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-1 rounded-md border border-border bg-background/30 p-1">
          {(['auto', 'restructure', 'simple', 'fallback'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onPatch({ mode })}
              className={cn(
                'rounded px-2 py-1.5 text-2xs capitalize transition-colors',
                options.mode === mode
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground'
              )}
            >
              {mode}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <CheckRow label="Deobfuscate" checked={options.deobfuscate} onChange={(deobfuscate) => onPatch({ deobfuscate })} />
          <CheckRow label="Bad code" checked={options.showBadCode} onChange={(showBadCode) => onPatch({ showBadCode })} />
          <CheckRow label="No resources" checked={options.noResources} onChange={(noResources) => onPatch({ noResources })} />
          <CheckRow label="Gradle export" checked={options.exportGradle} onChange={(exportGradle) => onPatch({ exportGradle })} />
        </div>
        <label className="flex items-center justify-between gap-3 text-2xs">
          <span className="text-muted-foreground">Threads</span>
          <input
            type="number"
            min={1}
            max={16}
            value={options.threads}
            onChange={(e) => onPatch({ threads: Number(e.target.value) })}
            className="h-7 w-20 rounded-md border border-border bg-background/40 px-2 font-mono text-2xs outline-none focus:border-primary"
          />
        </label>
      </div>
    </div>
  )
}

function CheckRow({
  label,
  checked,
  onChange
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}): JSX.Element {
  return (
    <label className="flex items-center gap-2 rounded-md border border-border bg-background/30 px-2 py-1.5 text-2xs">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 accent-primary"
      />
      <span className="truncate">{label}</span>
    </label>
  )
}

function EmptyWorkbench(): JSX.Element {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-surface/40 text-primary">
          <FileCode2 className="h-7 w-7" strokeWidth={1.4} />
        </div>
        <div className="mt-4 text-sm font-medium">No JADX project loaded</div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Choose a package on the left and decompile it to browse source, resources, entry points,
          endpoints, secrets, and high-signal review findings.
        </p>
      </div>
    </div>
  )
}

function FileTreePanel({
  tree,
  selectedPath,
  onSelect
}: {
  tree: JadxFileEntry[]
  selectedPath: string | null
  onSelect: (path: string) => void
}): JSX.Element {
  return (
    <div className="flex h-full flex-col border-r border-border bg-surface/20">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3 text-2xs uppercase tracking-wider text-muted-foreground">
        <FolderOpen className="h-3.5 w-3.5" />
        Files
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {tree.map((node) => (
          <TreeNode key={node.path} node={node} selectedPath={selectedPath} onSelect={onSelect} />
        ))}
      </div>
    </div>
  )
}

function TreeNode({
  node,
  selectedPath,
  onSelect,
  depth = 0
}: {
  node: JadxFileEntry
  selectedPath: string | null
  onSelect: (path: string) => void
  depth?: number
}): JSX.Element {
  const [open, setOpen] = useState(depth < 2)
  const isFile = node.kind === 'file'
  const active = selectedPath === node.path
  return (
    <div>
      <button
        type="button"
        onClick={() => (isFile ? onSelect(node.path) : setOpen(!open))}
        className={cn(
          'flex h-7 w-full items-center gap-1.5 rounded px-2 text-left font-mono text-2xs transition-colors',
          active
            ? 'bg-primary/15 text-primary'
            : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground'
        )}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        {!isFile && (
          <ChevronRight className={cn('h-3 w-3 transition-transform', open && 'rotate-90')} />
        )}
        {isFile ? <Code2 className="h-3 w-3 shrink-0" /> : <FolderOpen className="h-3 w-3 shrink-0" />}
        <span className="truncate">{node.name}</span>
      </button>
      {!isFile && open && node.children?.map((child) => (
        <TreeNode
          key={child.path}
          node={child}
          selectedPath={selectedPath}
          onSelect={onSelect}
          depth={depth + 1}
        />
      ))}
    </div>
  )
}

function SourcePanel({
  path,
  content,
  file,
  reading
}: {
  path: string | null
  content: string
  file: JadxReadFileResult | null
  reading: boolean
}): JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-surface/20 px-3">
        <FileCode2 className="h-3.5 w-3.5 text-primary" />
        <span className="truncate font-mono text-2xs text-muted-foreground">
          {path ?? 'Select a file'}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {file?.binary && <Badge variant="outline">hex</Badge>}
          {file?.truncated && (
            <Badge variant="warning">
              {formatBytes(file.bytesRead)} / {formatBytes(file.size)}
            </Badge>
          )}
          {reading && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {path ? (
          <Editor
            key={path}
            language={file?.binary ? 'plaintext' : languageFromPath(path)}
            value={content}
            theme="vs-dark"
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 12,
              lineNumbersMinChars: 4,
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              wordWrap: 'off'
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Select a decompiled source or resource file.
          </div>
        )}
      </div>
    </div>
  )
}

function InsightsPanel({
  searchQuery,
  searching,
  searchResults,
  onSearch,
  onOpenHit
}: {
  searchQuery: string
  searching: boolean
  searchResults: ReturnType<typeof useJadxStore.getState>['searchResults']
  onSearch: (query: string) => void
  onOpenHit: (path: string) => void
}): JSX.Element {
  const project = useJadxStore((s) => s.project)
  const groupedFindings = useMemo(() => groupFindings(project?.findings ?? []), [project?.findings])
  if (!project) return <></>
  return (
    <div className="flex h-full flex-col bg-surface/20">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3 text-2xs uppercase tracking-wider text-muted-foreground">
        <ShieldAlert className="h-3.5 w-3.5" />
        Intelligence
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {project.completedWithErrors && (
          <div className="mb-3 flex items-start gap-2 rounded-md border border-warning/35 bg-warning/10 px-3 py-2 text-2xs text-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              JADX produced usable output but reported recoverable decode errors. Some classes or
              resources may be incomplete.
            </span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Files" value={project.fileCount} />
          <Metric label="Source" value={project.sourceFileCount} />
          <Metric label="Findings" value={project.findings.length} heat={project.findings.length > 0} />
          <Metric label="Secrets" value={project.secrets.length} heat={project.secrets.length > 0} />
          <Metric label="Endpoints" value={project.endpoints.length} />
          <Metric label="Resources" value={project.resourceFileCount} />
        </div>

        <section className="mt-3 rounded-xl border border-border bg-surface/40 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium">
            <Search className="h-3.5 w-3.5 text-primary" />
            Search
            {searching && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-primary" />}
          </div>
          <input
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="class, method, token, URL..."
            className="h-8 w-full rounded-md border border-border bg-background/40 px-2 font-mono text-2xs outline-none focus:border-primary"
          />
          {searchResults.length > 0 && (
            <ul className="mt-2 max-h-48 space-y-1 overflow-auto">
              {searchResults.map((hit) => (
                <li key={`${hit.file}:${hit.line}:${hit.column}`}>
                  <button
                    type="button"
                    className="w-full rounded-md px-2 py-1 text-left hover:bg-surface-raised/70"
                    onClick={() => onOpenHit(hit.file)}
                  >
                    <div className="truncate font-mono text-[10px] text-primary">
                      {hit.file}:{hit.line}
                    </div>
                    <div className="truncate font-mono text-[10px] text-muted-foreground">
                      {hit.preview}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-3 rounded-xl border border-border bg-surface/40 p-3">
          <div className="mb-2 text-xs font-medium">Entry points</div>
          <ul className="space-y-1">
            {project.entryPoints.slice(0, 10).map((entry) => (
              <li
                key={`${entry.type}:${entry.component}`}
                className="min-w-0 rounded-md border border-border bg-background/30 px-2 py-1.5"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Badge variant={entry.exported ? 'warning' : 'muted'}>{entry.type}</Badge>
                  <span
                    className="block min-w-0 flex-1 truncate font-mono text-[10px]"
                    title={entry.component}
                  >
                    {entry.component}
                  </span>
                </div>
                {entry.file && (
                  <button
                    type="button"
                    className="mt-1 block max-w-full truncate font-mono text-[10px] text-primary hover:underline"
                    title={entry.file}
                    onClick={() => onOpenHit(entry.file!)}
                  >
                    {entry.file}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-3 rounded-xl border border-border bg-surface/40 p-3">
          <div className="mb-2 text-xs font-medium">Review findings</div>
          {project.findings.length === 0 ? (
            <div className="text-2xs text-muted-foreground">No high-signal code review hits.</div>
          ) : (
            <div className="space-y-2">
              {[...groupedFindings.entries()].map(([title, findings]) => (
                <FindingCluster
                  key={title}
                  title={title}
                  findings={findings}
                  onOpen={onOpenHit}
                />
              ))}
            </div>
          )}
        </section>

        {(project.secrets.length > 0 || project.endpoints.length > 0) && (
          <section className="mt-3 rounded-xl border border-border bg-surface/40 p-3">
            <div className="mb-2 text-xs font-medium">Extracted signals</div>
            {project.secrets.slice(0, 5).map((secret, i) => (
              <SignalRow key={`secret-${i}`} severity={secret.severity} label={secret.patternLabel} value={secret.value} />
            ))}
            {project.endpoints.slice(0, 8).map((endpoint) => (
              <SignalRow
                key={endpoint.url}
                severity={endpoint.insecure ? 'medium' : 'info'}
                label={endpoint.host}
                value={endpoint.url}
              />
            ))}
          </section>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value, heat = false }: { label: string; value: number; heat?: boolean }): JSX.Element {
  return (
    <div className={cn('rounded-md border bg-surface/40 px-3 py-2', heat ? 'border-warning/40' : 'border-border')}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-semibold">{value}</div>
    </div>
  )
}

function FindingCluster({
  title,
  findings,
  onOpen
}: {
  title: string
  findings: JadxCodeFinding[]
  onOpen: (path: string) => void
}): JSX.Element {
  const top = findings[0]!
  return (
    <div className="rounded-md border border-border bg-background/30 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-2xs font-medium">{title}</span>
        <SeverityChip severity={top.severity} />
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground">{top.detail}</div>
      <ul className="mt-1 space-y-0.5">
        {findings.slice(0, 4).map((finding) => (
          <li key={finding.id}>
            <button
              type="button"
              onClick={() => onOpen(finding.file)}
              className="w-full truncate text-left font-mono text-[10px] text-primary hover:underline"
            >
              {finding.file}:{finding.line}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SignalRow({
  severity,
  label,
  value
}: {
  severity: SecretFinding['severity']
  label: string
  value: string
}): JSX.Element {
  return (
    <div className="mb-1 rounded-md border border-border bg-background/30 px-2 py-1.5">
      <div className="flex items-center gap-2">
        <SeverityChip severity={severity} />
        <span className="truncate text-[10px]">{label}</span>
      </div>
      <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{value}</div>
    </div>
  )
}

function SeverityChip({ severity }: { severity: SecretFinding['severity'] }): JSX.Element {
  const cls =
    severity === 'critical' || severity === 'high'
      ? 'border-destructive/40 bg-destructive/10 text-destructive'
      : severity === 'medium'
        ? 'border-warning/40 bg-warning/15 text-warning'
        : 'border-border bg-surface text-muted-foreground'
  return (
    <span className={cn('rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase', cls)}>
      {severity}
    </span>
  )
}

function groupFindings(findings: JadxCodeFinding[]): Map<string, JadxCodeFinding[]> {
  const out = new Map<string, JadxCodeFinding[]>()
  for (const finding of findings) {
    const list = out.get(finding.title) ?? []
    list.push(finding)
    out.set(finding.title, list)
  }
  return out
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = units[0]!
  for (let i = 1; value >= 1024 && i < units.length; i++) {
    value /= 1024
    unit = units[i]!
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${unit}`
}

function languageFromPath(path: string): string {
  const lower = path.toLowerCase()
  if (lower.endsWith('.java')) return 'java'
  if (lower.endsWith('.kt')) return 'kotlin'
  if (lower.endsWith('.xml')) return 'xml'
  if (lower.endsWith('.json')) return 'json'
  if (lower.endsWith('.properties') || lower.endsWith('.ini')) return 'ini'
  if (lower.endsWith('.gradle')) return 'groovy'
  if (lower.endsWith('.js')) return 'javascript'
  if (lower.endsWith('.css')) return 'css'
  if (lower.endsWith('.html')) return 'html'
  if (lower.endsWith('.yml') || lower.endsWith('.yaml')) return 'yaml'
  return 'plaintext'
}
