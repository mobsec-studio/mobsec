import Editor from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Copy,
  Cpu,
  Download,
  Eraser,
  FileCode2,
  FilePlus2,
  Globe,
  Loader2,
  Pencil,
  Play,
  Plus,
  PowerOff,
  Radar,
  Radio,
  RefreshCw,
  RotateCw,
  Save,
  Search,
  ShieldCheck,
  Smartphone,
  Square,
  Terminal,
  Trash2,
  Zap
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { cn } from '@/lib/utils'
import { isSameTarget, useFridaStore, type FridaTarget } from '@/stores/useFridaStore'
import { selectActiveDevice, useDeviceStore } from '@/stores/useDeviceStore'
import { useResolvedTheme } from '@/stores/useThemeStore'
import { applyParams, parseScriptParams, type FridaParam } from '../frida/params'
import { ParamRunDialog } from '../frida/ParamRunDialog'
import { IntelligencePanel } from '../frida/panels/IntelligencePanel'
import { BypassPanel } from '../frida/panels/BypassPanel'
import { TracePanel } from '../frida/panels/TracePanel'
import { LiveEventsPanel } from '../frida/panels/LiveEventsPanel'
import { ConsoleREPL } from '../frida/panels/ConsoleREPL'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../ui/dropdown-menu'

/** Minimal scaffold for "New" — a blank-ish canvas with the one helper
 *  almost every Android hook needs. Users delete it freely. */
const BLANK_SCRIPT_TEMPLATE = `// New Frida script.
//   Ctrl+Enter / Ctrl+S to run or hot-reload.
//   Declare inputs with:  // @param NAME string "Label" default
//   and MobSec will prompt for them before running.

function whenJavaReady(cb) {
  if (typeof Java !== 'undefined' && Java.available) Java.perform(cb)
  else setTimeout(function () { whenJavaReady(cb) }, 50)
}

whenJavaReady(function () {
  send('hello from pid ' + Process.id + ' (' + Process.arch + ')')
})
`

// Register a Frida-API completion provider for the editor once. Offers the
// core gum/Java surface plus a few ready-made hook snippets so authoring a
// script doesn't mean memorising the API.
let fridaCompletionsRegistered = false
function registerFridaCompletions(monaco: typeof Monaco): void {
  if (fridaCompletionsRegistered) return
  fridaCompletionsRegistered = true
  const K = monaco.languages.CompletionItemKind
  const SNIPPET = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
  type Base = Omit<Monaco.languages.CompletionItem, 'range'>
  const items: Base[] = [
    {
      label: 'Java.perform',
      kind: K.Method,
      detail: 'Run a callback on the VM thread',
      insertText: 'Java.perform(function () {\n\t$0\n})',
      insertTextRules: SNIPPET
    },
    {
      label: 'Java.use',
      kind: K.Method,
      detail: 'Get a class wrapper',
      insertText: "Java.use('${1:com.example.Class}')",
      insertTextRules: SNIPPET
    },
    {
      label: 'Java.choose',
      kind: K.Method,
      detail: 'Enumerate live instances',
      insertText:
        "Java.choose('${1:com.example.Class}', {\n\tonMatch: function (instance) {\n\t\t$0\n\t},\n\tonComplete: function () {}\n})",
      insertTextRules: SNIPPET
    },
    {
      label: 'Java.cast',
      kind: K.Method,
      detail: 'Cast a handle to a class',
      insertText: 'Java.cast(${1:handle}, ${2:Klass})',
      insertTextRules: SNIPPET
    },
    {
      label: 'Java.registerClass',
      kind: K.Method,
      detail: 'Define a new Java class',
      insertText:
        "Java.registerClass({\n\tname: '${1:com.example.New}',\n\timplements: [${2:Iface}],\n\tmethods: {\n\t\t$0\n\t}\n})",
      insertTextRules: SNIPPET
    },
    {
      label: 'Java.enumerateLoadedClassesSync',
      kind: K.Method,
      detail: 'All loaded class names',
      insertText: 'Java.enumerateLoadedClassesSync()'
    },
    {
      label: 'Java.available',
      kind: K.Property,
      detail: 'Is the VM up?',
      insertText: 'Java.available'
    },
    {
      label: 'Interceptor.attach',
      kind: K.Method,
      detail: 'Attach onEnter/onLeave to a native fn',
      insertText:
        'Interceptor.attach(${1:address}, {\n\tonEnter: function (args) {\n\t\t$0\n\t},\n\tonLeave: function (retval) {}\n})',
      insertTextRules: SNIPPET
    },
    {
      label: 'Interceptor.replace',
      kind: K.Method,
      detail: 'Replace a native function',
      insertText:
        "Interceptor.replace(${1:address}, new NativeCallback(function () {\n\t$0\n}, ${2:'int'}, [${3}]))",
      insertTextRules: SNIPPET
    },
    {
      label: 'Module.findExportByName',
      kind: K.Method,
      detail: 'Resolve an export address',
      insertText: "Module.findExportByName(${1:null}, '${2:open}')",
      insertTextRules: SNIPPET
    },
    {
      label: 'Module.getBaseAddress',
      kind: K.Method,
      detail: 'Module base address',
      insertText: "Module.getBaseAddress('${1:libnative.so}')",
      insertTextRules: SNIPPET
    },
    { label: 'Process.id', kind: K.Property, detail: 'Current pid', insertText: 'Process.id' },
    {
      label: 'Process.arch',
      kind: K.Property,
      detail: 'arm64 / arm / x64 / ia32',
      insertText: 'Process.arch'
    },
    {
      label: 'Process.enumerateModules',
      kind: K.Method,
      detail: 'Loaded native modules',
      insertText: 'Process.enumerateModules()'
    },
    {
      label: 'Memory.alloc',
      kind: K.Method,
      detail: 'Allocate process memory',
      insertText: 'Memory.alloc(${1:size})',
      insertTextRules: SNIPPET
    },
    {
      label: 'Memory.scanSync',
      kind: K.Method,
      detail: 'Scan memory for a pattern',
      insertText: "Memory.scanSync(${1:address}, ${2:size}, '${3:00 11 22}')",
      insertTextRules: SNIPPET
    },
    {
      label: 'NativeFunction',
      kind: K.Class,
      detail: 'Wrap a native function',
      insertText: "new NativeFunction(${1:address}, '${2:int}', [${3}])",
      insertTextRules: SNIPPET
    },
    {
      label: 'NativeCallback',
      kind: K.Class,
      detail: 'Create a native callback',
      insertText: "new NativeCallback(function () {\n\t$0\n}, '${1:int}', [${2}])",
      insertTextRules: SNIPPET
    },
    {
      label: 'ptr',
      kind: K.Function,
      detail: 'Make a NativePointer',
      insertText: 'ptr(${1:0})',
      insertTextRules: SNIPPET
    },
    {
      label: 'send',
      kind: K.Function,
      detail: 'Send a message to the host',
      insertText: 'send(${1:message})',
      insertTextRules: SNIPPET
    },
    {
      label: 'recv',
      kind: K.Function,
      detail: 'Receive a message from the host',
      insertText: "recv('${1:type}', function (message) {\n\t$0\n})",
      insertTextRules: SNIPPET
    },
    {
      label: 'rpc.exports',
      kind: K.Property,
      detail: 'Expose functions to the host',
      insertText: 'rpc.exports = {\n\t$0\n}',
      insertTextRules: SNIPPET
    },
    {
      label: 'hookMethod',
      kind: K.Snippet,
      detail: 'Snippet: hook a Java method',
      insertText:
        "Java.perform(function () {\n\tvar ${1:Klass} = Java.use('${2:com.example.Class}');\n\t${1:Klass}.${3:method}.implementation = function (${4:args}) {\n\t\tvar ret = this.${3:method}(${4:args});\n\t\tsend('${3:method} -> ' + ret);\n\t\treturn ret;\n\t};\n})",
      insertTextRules: SNIPPET
    },
    {
      label: 'whenJavaReady',
      kind: K.Snippet,
      detail: 'Snippet: wait for ART then run',
      insertText:
        "function whenJavaReady(cb) {\n\tif (typeof Java !== 'undefined' && Java.available) Java.perform(cb);\n\telse setTimeout(function () { whenJavaReady(cb); }, 50);\n}\nwhenJavaReady(function () {\n\t$0\n});",
      insertTextRules: SNIPPET
    }
  ]
  monaco.languages.registerCompletionItemProvider('javascript', {
    triggerCharacters: ['.'],
    provideCompletionItems(model, position) {
      const w = model.getWordUntilPosition(position)
      const range: Monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: w.startColumn,
        endColumn: w.endColumn
      }
      return { suggestions: items.map((b) => ({ ...b, range })) }
    }
  })
}

export function FridaTab(): JSX.Element {
  const status = useFridaStore((s) => s.status)
  const processes = useFridaStore((s) => s.processes)
  const processFilter = useFridaStore((s) => s.processFilter)
  const appsOnly = useFridaStore((s) => s.appsOnly)
  const selectedTarget = useFridaStore((s) => s.selectedTarget)
  const builtinScripts = useFridaStore((s) => s.builtinScripts)
  const userScripts = useFridaStore((s) => s.userScripts)
  const draftScript = useFridaStore((s) => s.draftScript)
  const draftSourceId = useFridaStore((s) => s.draftSourceId)
  const activeSessionId = useFridaStore((s) => s.activeSessionId)
  const consoleEntries = useFridaStore((s) => s.console)
  const setStatus = useFridaStore((s) => s.setStatus)
  const setProcesses = useFridaStore((s) => s.setProcesses)
  const setProcessFilter = useFridaStore((s) => s.setProcessFilter)
  const setAppsOnly = useFridaStore((s) => s.setAppsOnly)
  const selectTarget = useFridaStore((s) => s.selectTarget)
  const setDraftScript = useFridaStore((s) => s.setDraftScript)
  const setDraftSourceId = useFridaStore((s) => s.setDraftSourceId)
  const appendConsole = useFridaStore((s) => s.appendConsole)
  const clearConsole = useFridaStore((s) => s.clearConsole)
  const hydrate = useFridaStore((s) => s.hydrate)
  const refreshScripts = useFridaStore((s) => s.refreshScripts)
  const lastReport = useFridaStore((s) => s.lastReport)
  const reconBusy = useFridaStore((s) => s.reconBusy)
  const setLastReport = useFridaStore((s) => s.setLastReport)
  const setReconBusy = useFridaStore((s) => s.setReconBusy)
  const lastStrategyResults = useFridaStore((s) => s.lastStrategyResults)
  const autoPwnBusy = useFridaStore((s) => s.autoPwnBusy)
  const setStrategyResults = useFridaStore((s) => s.setStrategyResults)
  const setAutoPwnBusy = useFridaStore((s) => s.setAutoPwnBusy)
  const agentSessionId = useFridaStore((s) => s.agentSessionId)
  const setAgentSessionId = useFridaStore((s) => s.setAgentSessionId)
  const events = useFridaStore((s) => s.events)
  const eventsPaused = useFridaStore((s) => s.eventsPaused)
  const eventsPausedCount = useFridaStore((s) => s.eventsPausedCount)
  const appendEvent = useFridaStore((s) => s.appendEvent)
  const clearEvents = useFridaStore((s) => s.clearEvents)
  const setEventsPaused = useFridaStore((s) => s.setEventsPaused)

  // Frida works against ANY online device — embedded emulator, a USB
  // phone, a WiFi device, or a third-party emulator like LDPlayer. Gate
  // the server controls on "is there an online active device" rather
  // than the embedded-emulator-only check this used to do.
  const activeDevice = useDeviceStore(selectActiveDevice)
  const deviceOnline = !!activeDevice && activeDevice.state === 'online'
  const editorTheme = useResolvedTheme() === 'dark' ? 'vs-dark' : 'vs'
  const appProcessCount = processes.filter((p) => p.identifier).length
  const selectedTargetLabel = selectedTarget
    ? (selectedTarget.identifier ?? `pid ${selectedTarget.pid}`)
    : 'No target selected'
  const selectedTargetDetail = selectedTarget
    ? selectedTarget.pid > 0
      ? `pid ${selectedTarget.pid}`
      : 'ready to spawn'
    : 'choose a process'

  const [busy, setBusy] = useState<null | 'start' | 'stop' | 'attach' | 'refresh' | 'detach'>(null)
  const [saveDialog, setSaveDialog] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveDescription, setSaveDescription] = useState('')
  // When the draft script declares `// @param`s, we collect values via
  // this dialog before running. The dialog carries the exact run
  // callback so it works uniformly for spawn / launch-attach / attach /
  // reload without the dialog needing to know which path it is.
  const [paramDialog, setParamDialog] = useState<{
    params: FridaParam[]
    title: string
    runLabel: string
    run: (source: string) => void
  } | null>(null)
  // Last-used param values keyed by the script id they belong to, so
  // re-running a script remembers what the analyst typed.
  const [paramValues, setParamValues] = useState<Record<string, Record<string, string>>>({})
  // Workspace tab (center) + bottom dock tab. No modals — everything is
  // a docked panel so the device view is never covered.
  type WorkspaceTab = 'script' | 'intel' | 'bypass' | 'trace' | 'console'
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('script')
  const [bottomTab, setBottomTab] = useState<'events' | 'console'>('events')
  // Bumped by the header "Apply all safe" action to trigger BypassPanel.
  const [bypassApplySignal, setBypassApplySignal] = useState(0)
  // CodeShare import dialog state.
  const [codeshareDialog, setCodeshareDialog] = useState(false)
  const [codeshareHandle, setCodeshareHandle] = useState('')
  const [codeshareBusy, setCodeshareBusy] = useState(false)
  // Edit-metadata dialog for a user script.
  const [editScript, setEditScript] = useState<{
    id: string
    name: string
    description: string
    source: string
  } | null>(null)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    const offStatus = window.api.on.onFridaStatus(setStatus)
    const offConsole = window.api.on.onFridaConsole((msg) => {
      // Frida sometimes emits 'warning' level; squash to 'warn' so we
      // can keep our union type tight.
      const level = msg.level === 'error' ? 'error' : msg.level === 'warn' ? 'warn' : 'info'
      appendConsole({ sessionId: msg.sessionId, level, text: msg.text })
    })
    const offEvent = window.api.on.onFridaEvent((event) => appendEvent(event))
    return () => {
      offStatus()
      offConsole()
      offEvent()
    }
  }, [setStatus, appendConsole, appendEvent])

  // Auto-refresh process list when freshly connected.
  useEffect(() => {
    if (status.state !== 'connected') return
    void refreshProcesses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.state])

  const filtered = useMemo(() => {
    const q = processFilter.trim().toLowerCase()
    return processes.filter((p) => {
      if (appsOnly && !p.identifier) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        p.identifier?.toLowerCase().includes(q) ||
        String(p.pid).includes(q)
      )
    })
  }, [processes, processFilter, appsOnly])

  const startServer = async (): Promise<void> => {
    setBusy('start')
    const res = await window.api.frida.installServer()
    setBusy(null)
    if (res.ok) toast.success('frida-server is running on the active device')
    else
      toast.error('Failed to start frida-server', {
        description: res.error
      })
  }

  const stopServer = async (): Promise<void> => {
    setBusy('stop')
    const res = await window.api.frida.stopServer()
    setBusy(null)
    if (res.ok) toast.success('frida-server stopped')
    else toast.error('Failed to stop frida-server', { description: res.error })
  }

  const refreshProcesses = async (): Promise<void> => {
    setBusy('refresh')
    const res = await window.api.frida.listProcesses()
    setBusy(null)
    if (res.ok) setProcesses(res.value)
    else toast.error('Could not list processes', { description: res.error })
  }

  // Run methods:
  //   'attach'        — attach to an already-running pid (pid > 0)
  //   'spawn'         — Frida-spawn (hooks earliest init; can fail on
  //                     multi-process / anti-tamper / translated apps)
  //   'launch-attach' — launch the app normally, wait for ART, attach
  //                     (more compatible; the fix for "Java never
  //                     available" and CodeShare ReferenceErrors)
  type RunMethod = 'attach' | 'spawn' | 'launch-attach'

  // Entry point for the run buttons / Ctrl+Enter. If the draft declares
  // parameters, route through the collection dialog first; otherwise run.
  const requestRun = (method: RunMethod): void => {
    if (!selectedTarget) {
      toast.warning('Pick a process first')
      return
    }
    const exec = (source: string): void => void doRun(method, source)
    const params = parseScriptParams(draftScript)
    if (params.length > 0) {
      setParamDialog({
        params,
        title: 'Run with parameters',
        runLabel: method === 'attach' ? 'Attach' : method === 'spawn' ? 'Spawn' : 'Launch & attach',
        run: exec
      })
      return
    }
    exec(draftScript)
  }

  const doRun = async (method: RunMethod, source: string): Promise<void> => {
    const target = selectedTarget
    if (!target) return
    setBusy('attach')
    let res
    if (method === 'attach' && target.pid > 0) {
      res = await window.api.frida.attach(target.pid, source)
    } else if (method === 'spawn' && target.identifier) {
      res = await window.api.frida.spawn(target.identifier, source)
    } else if (method === 'launch-attach' && target.identifier) {
      res = await window.api.frida.launchAndAttach(target.identifier, source)
    } else {
      setBusy(null)
      toast.error('Cannot run', { description: 'No live pid and no package id on this row.' })
      return
    }
    setBusy(null)
    if (res.ok) {
      useFridaStore.setState({ activeSessionId: res.value.sessionId })
      const verb =
        method === 'attach' ? 'Attached to' : method === 'spawn' ? 'Spawned' : 'Launched + attached'
      const label = target.pid > 0 ? `pid ${target.pid}` : (target.identifier ?? 'process')
      toast.success(`${verb} ${label}`)
      appendConsole({
        sessionId: res.value.sessionId,
        level: 'info',
        text: `[${verb.toLowerCase()} ${label}]`
      })
      // Spawned / launched apps get a fresh pid; refresh so the row updates.
      if (target.pid === 0) void refreshProcesses()
    } else {
      const verb = method === 'attach' ? 'Attach' : method === 'spawn' ? 'Spawn' : 'Launch & attach'
      toast.error(`${verb} failed`, { description: res.error })
    }
  }

  const requestReload = (): void => {
    if (!activeSessionId) {
      toast.warning('No active session - click Attach first')
      return
    }
    const params = parseScriptParams(draftScript)
    if (params.length > 0) {
      setParamDialog({
        params,
        title: 'Reload with parameters',
        runLabel: 'Reload',
        run: (source) => void doReload(source)
      })
      return
    }
    void doReload(draftScript)
  }

  const doReload = async (source: string): Promise<void> => {
    if (!activeSessionId) return
    setBusy('attach')
    const res = await window.api.frida.loadScript(activeSessionId, source)
    setBusy(null)
    if (res.ok) toast.success('Script reloaded')
    else toast.error('Reload failed', { description: res.error })
  }

  // Resolve the param dialog: build the parameterized source and run it
  // through the callback the dialog was opened with.
  const runWithParams = (values: Record<string, string>): void => {
    if (!paramDialog) return
    if (draftSourceId) {
      setParamValues((prev) => ({ ...prev, [draftSourceId]: values }))
    }
    const finalSource = applyParams(draftScript, paramDialog.params, values)
    const run = paramDialog.run
    setParamDialog(null)
    run(finalSource)
  }

  // Monaco's `addCommand` callbacks capture their closure at mount time,
  // so we route the Enter / Ctrl+S keybindings through a ref that we
  // refresh every render. Without this the shortcuts would fire stale
  // handlers (e.g. attach when a session already exists) after the
  // first interaction. For a not-running app the keyboard default is
  // spawn; users pick Launch & attach from the run dropdown.
  const editorActionRef = useRef<() => void>(() => undefined)
  editorActionRef.current = (): void => {
    if (useFridaStore.getState().activeSessionId) requestReload()
    else if (selectedTarget && selectedTarget.pid > 0) requestRun('attach')
    else requestRun('spawn')
  }

  const detach = async (): Promise<void> => {
    if (!activeSessionId) return
    setBusy('detach')
    const res = await window.api.frida.detach(activeSessionId)
    setBusy(null)
    if (res.ok) {
      if (agentSessionId === activeSessionId) setAgentSessionId(null)
      useFridaStore.setState({ activeSessionId: null })
      toast.success('Detached')
    } else {
      toast.error('Detach failed', { description: res.error })
    }
  }

  const loadFromLibrary = (script: { id: string; name: string; source: string }): void => {
    setDraftScript(script.source)
    setDraftSourceId(script.id)
    toast.success(`Loaded "${script.name}" into editor`)
  }

  // Reset the editor to a near-blank scaffold for writing from scratch.
  // We keep a one-line whenJavaReady helper because almost every Android
  // hook needs it — but the user can delete it and write anything.
  const newBlankScript = (): void => {
    setDraftScript(BLANK_SCRIPT_TEMPLATE)
    setDraftSourceId(null)
  }

  // Run the intelligence agent against the selected target and surface the
  // App Intelligence Report. Reuses attach (running pid) vs launch-attach
  // (not-running app, the most compatible path) just like a normal run.
  const runRecon = async (): Promise<void> => {
    if (!selectedTarget) {
      toast.warning('Pick a process or app first')
      return
    }
    if (status.state !== 'connected') {
      toast.warning('Start frida-server first')
      return
    }
    setReconBusy(true)
    const res = await window.api.frida.reconnaissance({
      pid: selectedTarget.pid > 0 ? selectedTarget.pid : undefined,
      identifier: selectedTarget.identifier ?? undefined,
      method: selectedTarget.pid > 0 ? 'attach' : 'launch-attach'
    })
    setReconBusy(false)
    if (res.ok) {
      useFridaStore.setState({ activeSessionId: res.value.sessionId })
      setAgentSessionId(res.value.sessionId)
      setLastReport(res.value.report)
      // Recon doesn't apply bypasses — clear stale Auto-Pwn results.
      setStrategyResults(null)
      setWorkspaceTab('intel')
      const r = res.value.report
      toast.success('Intelligence ready', {
        description: `${r.framework.label} - ${r.security.length} control(s) - ${r.recommendations.length} suggestion(s)`
      })
      if (selectedTarget.pid === 0) void refreshProcesses()
    } else {
      toast.error('Reconnaissance failed', { description: res.error })
    }
  }

  // One-click Auto-Pwn: profile + apply the full applicable bypass stack.
  // Mirrors the run-method choice (running pid → attach; not-running →
  // launch-attach by default, or spawn for earliest hooks).
  const runAutoPwn = async (method?: RunMethod): Promise<void> => {
    if (!selectedTarget) {
      toast.warning('Pick a process or app first')
      return
    }
    if (status.state !== 'connected') {
      toast.warning('Start frida-server first')
      return
    }
    const chosen: RunMethod = method ?? (selectedTarget.pid > 0 ? 'attach' : 'launch-attach')
    setAutoPwnBusy(true)
    const res = await window.api.frida.autoPwn({
      pid: selectedTarget.pid > 0 ? selectedTarget.pid : undefined,
      identifier: selectedTarget.identifier ?? undefined,
      method: chosen
    })
    setAutoPwnBusy(false)
    if (res.ok) {
      useFridaStore.setState({ activeSessionId: res.value.sessionId })
      setAgentSessionId(res.value.sessionId)
      setLastReport(res.value.report)
      setStrategyResults(res.value.results)
      setWorkspaceTab('bypass')
      const applied = res.value.results.filter((r) => r.applied).length
      const hooks = res.value.results.reduce((n, r) => n + r.hooksInstalled, 0)
      toast.success('Auto-Pwn complete', {
        description: `${applied} bypass(es), ${hooks} hook(s) - ${res.value.report.framework.label}`
      })
      if (selectedTarget.pid === 0) void refreshProcesses()
    } else {
      toast.error('Auto-Pwn failed', { description: res.error })
    }
  }

  // Header "Bypass" dropdown: apply all safe immediately (→ Bypass tab),
  // or just open the panel to pick specific items.
  const bypassApplyAll = (): void => {
    if (!agentSessionId) {
      toast.warning('Run Recon or Auto-Pwn first to load the agent')
      return
    }
    setWorkspaceTab('bypass')
    setBypassApplySignal((n) => n + 1)
  }

  // From a Live Event (a method/crypto row), start tracing the class behind it.
  const traceClassFromEvent = (className: string): void => {
    if (!agentSessionId) return
    void window.api.frida.traceClass(agentSessionId, className)
    setWorkspaceTab('trace')
    toast.success(`Tracing ${className.split('.').pop()}`)
  }

  const openSaveDialog = (): void => {
    setSaveName('')
    setSaveDescription('')
    setSaveDialog(true)
  }

  const submitSave = async (): Promise<void> => {
    if (!saveName.trim()) return
    const res = await window.api.frida.saveUserScript({
      name: saveName.trim(),
      description: saveDescription.trim(),
      source: draftScript
    })
    if (res.ok) {
      toast.success('Saved to library')
      setSaveDialog(false)
      await refreshScripts()
    } else {
      toast.error('Save failed', { description: res.error })
    }
  }

  const deleteUserScript = async (id: string, name: string): Promise<void> => {
    const res = await window.api.frida.deleteUserScript(id)
    if (res.ok) {
      toast.success(`Removed "${name}"`)
      await refreshScripts()
    } else {
      toast.error('Delete failed', { description: res.error })
    }
  }

  const importFiles = async (): Promise<void> => {
    const res = await window.api.frida.importScriptFiles()
    if (!res.ok) {
      toast.error('Import failed', { description: res.error })
      return
    }
    if (res.value.length === 0) return // user cancelled
    toast.success(`Imported ${res.value.length} script${res.value.length === 1 ? '' : 's'}`)
    await refreshScripts()
  }

  const submitCodeshare = async (): Promise<void> => {
    const handle = codeshareHandle.trim()
    if (!handle) return
    setCodeshareBusy(true)
    const res = await window.api.frida.importCodeshare(handle)
    setCodeshareBusy(false)
    if (res.ok) {
      toast.success(`Imported "${res.value.name}"`)
      setCodeshareDialog(false)
      setCodeshareHandle('')
      await refreshScripts()
      // Drop it straight into the editor so the user can run it immediately.
      loadFromLibrary(res.value)
    } else {
      toast.error('CodeShare import failed', { description: res.error })
    }
  }

  const duplicateScript = async (s: {
    name: string
    description: string
    source: string
  }): Promise<void> => {
    const res = await window.api.frida.saveUserScript({
      name: `${s.name} (copy)`,
      description: s.description ?? '',
      source: s.source
    })
    if (res.ok) {
      toast.success('Duplicated to your library')
      await refreshScripts()
    } else {
      toast.error('Duplicate failed', { description: res.error })
    }
  }

  const exportScript = async (id: string): Promise<void> => {
    const res = await window.api.frida.exportScript(id)
    if (!res.ok) {
      toast.error('Export failed', { description: res.error })
      return
    }
    if (res.value) toast.success('Exported', { description: res.value.path })
  }

  const submitEdit = async (): Promise<void> => {
    if (!editScript) return
    const res = await window.api.frida.saveUserScript({
      id: editScript.id,
      name: editScript.name.trim() || 'Untitled script',
      description: editScript.description.trim(),
      source: editScript.source
    })
    if (res.ok) {
      toast.success('Updated')
      setEditScript(null)
      await refreshScripts()
    } else {
      toast.error('Update failed', { description: res.error })
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-border bg-surface/30 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Cpu className="h-4 w-4 text-primary" />
          <h1 className="text-sm font-semibold tracking-tight">Frida</h1>
          <FridaBadge status={status} />
          {status.serverVersion && (
            <span className="ml-2 font-mono text-2xs text-muted-foreground">
              v{status.serverVersion}
            </span>
          )}

          <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
            {status.state === 'connected' ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!deviceOnline || busy !== null}
                      onClick={() => void startServer()}
                    >
                      {busy === 'start' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCw className="h-3.5 w-3.5" />
                      )}
                      Restart
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Kill and respawn frida-server on the active device
                  </TooltipContent>
                </Tooltip>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={busy !== null}
                  onClick={() => void stopServer()}
                >
                  {busy === 'stop' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Square className="h-3.5 w-3.5" />
                  )}
                  Stop
                </Button>
              </>
            ) : status.state === 'connecting' ? (
              <Button size="sm" variant="outline" disabled>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Starting frida-server...
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!deviceOnline || busy !== null}
                    onClick={() => void startServer()}
                  >
                    {busy === 'start' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    Start frida-server
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Pushes the matching frida-server onto the active device and runs it as root
                </TooltipContent>
              </Tooltip>
            )}
            <Button
              size="sm"
              variant="ghost"
              disabled={status.state !== 'connected' || busy !== null}
              onClick={() => void refreshProcesses()}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', busy === 'refresh' && 'animate-spin')} />{' '}
              Refresh
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
                  disabled={
                    status.state !== 'connected' || !selectedTarget || busy !== null || reconBusy
                  }
                  onClick={() => void runRecon()}
                >
                  {reconBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Radar className="h-3.5 w-3.5" />
                  )}
                  Recon
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Profile the selected target - framework, security controls, crypto, storage, native
                libs - and suggest a bypass plan
              </TooltipContent>
            </Tooltip>
            {selectedTarget && selectedTarget.pid === 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-warning/50 text-warning hover:bg-warning/10 hover:text-warning"
                    disabled={status.state !== 'connected' || busy !== null || autoPwnBusy}
                  >
                    {autoPwnBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Zap className="h-3.5 w-3.5" />
                    )}
                    Auto-Pwn
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[320px]">
                  <DropdownMenuLabel>Auto-Pwn not-running app</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void runAutoPwn('launch-attach')}>
                    <Zap className="h-3.5 w-3.5" />
                    <div className="flex flex-col">
                      <span>Launch &amp; attach</span>
                      <span className="text-2xs text-muted-foreground">
                        Most compatible - profile, then apply the bypass stack
                      </span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void runAutoPwn('spawn')}>
                    <RotateCw className="h-3.5 w-3.5" />
                    <div className="flex flex-col">
                      <span>Spawn (earliest hooks)</span>
                      <span className="text-2xs text-muted-foreground">
                        Hooks before startup checks; can fail on hardened apps
                      </span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-warning/50 text-warning hover:bg-warning/10 hover:text-warning"
                    disabled={
                      status.state !== 'connected' ||
                      !selectedTarget ||
                      busy !== null ||
                      autoPwnBusy
                    }
                    onClick={() => void runAutoPwn()}
                  >
                    {autoPwnBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Zap className="h-3.5 w-3.5" />
                    )}
                    Auto-Pwn
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Profile + apply every applicable bypass (SSL pinning, root, debugger, emulator,
                  anti-Frida, biometric, FLAG_SECURE) and verify
                </TooltipContent>
              </Tooltip>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
                  disabled={!agentSessionId || busy !== null}
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> Bypass
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[280px]">
                <DropdownMenuLabel>Bypass detections</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => bypassApplyAll()}>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <div className="flex flex-col">
                    <span>Apply all (safe)</span>
                    <span className="text-2xs text-muted-foreground">
                      SSL pinning, root, debugger, emulator, biometric, FLAG_SECURE
                    </span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setWorkspaceTab('bypass')}>
                  <Activity className="h-3.5 w-3.5" />
                  <div className="flex flex-col">
                    <span>Choose items...</span>
                    <span className="text-2xs text-muted-foreground">
                      Pick specific bypasses, save &amp; replay presets
                    </span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {activeSessionId ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => requestReload()}
                  disabled={busy !== null}
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Reload script
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => void detach()}
                  disabled={busy !== null}
                >
                  <PowerOff className="h-3.5 w-3.5" /> Detach
                </Button>
              </>
            ) : selectedTarget && selectedTarget.pid === 0 ? (
              // Not-running app: offer both run methods. Spawn hooks the
              // earliest init but breaks on multi-process / anti-tamper /
              // translated apps; Launch & attach is the compatible path.
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" disabled={status.state !== 'connected' || busy !== null}>
                    {busy === 'attach' ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Running...
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5" /> Run
                      </>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[280px]">
                  <DropdownMenuLabel>Run not-running app</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => requestRun('launch-attach')}>
                    <Play className="h-3.5 w-3.5" />
                    <div className="flex flex-col">
                      <span>Launch &amp; attach</span>
                      <span className="text-2xs text-muted-foreground">
                        Most compatible - waits for ART, then hooks
                      </span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => requestRun('spawn')}>
                    <RotateCw className="h-3.5 w-3.5" />
                    <div className="flex flex-col">
                      <span>Spawn</span>
                      <span className="text-2xs text-muted-foreground">
                        Hooks earliest init; can fail on hardened apps
                      </span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                size="sm"
                disabled={status.state !== 'connected' || !selectedTarget || busy !== null}
                onClick={() => requestRun('attach')}
              >
                {busy === 'attach' ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Attaching...
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" /> Attach
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <FridaHeaderMetric
            icon={Smartphone}
            label="Device"
            value={activeDevice?.label ?? 'No active device'}
            detail={deviceOnline ? (activeDevice?.serial ?? 'online') : 'offline or missing'}
            tone={deviceOnline ? 'success' : 'muted'}
          />
          <FridaHeaderMetric
            icon={Activity}
            label="Target"
            value={selectedTargetLabel}
            detail={selectedTargetDetail}
            tone={selectedTarget ? 'success' : 'muted'}
          />
          <FridaHeaderMetric
            icon={Terminal}
            label="Session"
            value={activeSessionId ? activeSessionId.slice(0, 8) : 'None'}
            detail={agentSessionId ? 'agent loaded' : 'script console'}
            tone={activeSessionId ? 'success' : 'muted'}
          />
          <FridaHeaderMetric
            icon={BookOpen}
            label="Inventory"
            value={`${appProcessCount}/${processes.length} apps`}
            detail={`${builtinScripts.length + userScripts.length} scripts, ${events.length} events`}
            tone={status.state === 'connected' ? 'success' : 'muted'}
          />
        </div>
      </header>

      {status.state === 'error' && status.errorMessage && (
        <div className="flex shrink-0 items-start gap-2 border-b border-destructive/20 bg-destructive/5 px-4 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="min-w-0 flex-1 whitespace-pre-wrap break-words font-mono">
            {status.errorMessage}
          </div>
        </div>
      )}

      <ResizablePanelGroup
        direction="horizontal"
        autoSaveId="mobsec.frida-split"
        className="min-h-0 flex-1"
      >
        <ResizablePanel defaultSize={22} minSize={15}>
          <ProcessPane
            processes={filtered}
            filter={processFilter}
            onFilterChange={setProcessFilter}
            appsOnly={appsOnly}
            onAppsOnlyChange={setAppsOnly}
            selectedTarget={selectedTarget}
            onSelect={selectTarget}
            connected={status.state === 'connected'}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={56} minSize={30}>
          <div className="flex h-full min-h-0 flex-col">
            {/* Workspace tabs — non-modal panels, so the device view is never covered. */}
            <div className="flex min-h-9 shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-surface/30 px-2 py-1">
              <TabButton
                icon={FileCode2}
                label="Script"
                active={workspaceTab === 'script'}
                onClick={() => setWorkspaceTab('script')}
              />
              <TabButton
                icon={Radar}
                label="Intelligence"
                active={workspaceTab === 'intel'}
                onClick={() => setWorkspaceTab('intel')}
              />
              <TabButton
                icon={ShieldCheck}
                label="Bypass"
                active={workspaceTab === 'bypass'}
                onClick={() => setWorkspaceTab('bypass')}
              />
              <TabButton
                icon={Radio}
                label="Trace"
                active={workspaceTab === 'trace'}
                onClick={() => setWorkspaceTab('trace')}
              />
              <TabButton
                icon={Terminal}
                label="Console"
                active={workspaceTab === 'console'}
                onClick={() => setWorkspaceTab('console')}
              />
              {workspaceTab === 'script' && (
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  {draftSourceId && <Badge variant="muted">{draftSourceId}</Badge>}
                  <Button size="sm" variant="ghost" onClick={() => newBlankScript()}>
                    <FilePlus2 className="h-3.5 w-3.5" /> New
                  </Button>
                  <Button size="sm" variant="ghost" onClick={openSaveDialog}>
                    <Save className="h-3.5 w-3.5" /> Save as
                  </Button>
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1">
              {workspaceTab === 'script' && (
                <Editor
                  value={draftScript}
                  onChange={(v) => {
                    setDraftScript(v ?? '')
                    if (draftSourceId) setDraftSourceId(null)
                  }}
                  language="javascript"
                  theme={editorTheme}
                  onMount={(editor, monaco) => {
                    registerFridaCompletions(monaco)
                    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
                      editorActionRef.current()
                    })
                    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                      editorActionRef.current()
                    })
                  }}
                  options={{
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                    fontSize: 12,
                    wordWrap: 'on',
                    padding: { top: 8, bottom: 8 }
                  }}
                />
              )}
              {workspaceTab === 'intel' && (
                <IntelligencePanel
                  report={lastReport}
                  busy={reconBusy}
                  onRerun={() => void runRecon()}
                  onGoToBypass={() => setWorkspaceTab('bypass')}
                />
              )}
              {workspaceTab === 'bypass' && (
                <BypassPanel
                  sessionId={agentSessionId}
                  packageName={lastReport?.identifier ?? selectedTarget?.identifier ?? null}
                  applyAllSignal={bypassApplySignal}
                  seedResults={lastStrategyResults}
                />
              )}
              {workspaceTab === 'trace' && <TracePanel sessionId={agentSessionId} />}
              {workspaceTab === 'console' && <ConsoleREPL sessionId={activeSessionId} />}
            </div>

            {/* Bottom dock: live structured events + raw console */}
            <div className="flex h-60 shrink-0 flex-col border-t border-border bg-background">
              <div className="flex min-h-7 shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-surface/30 px-2 py-0.5">
                <TabButton
                  icon={Activity}
                  label="Live events"
                  count={events.length}
                  active={bottomTab === 'events'}
                  onClick={() => setBottomTab('events')}
                />
                <TabButton
                  icon={Terminal}
                  label="Console"
                  count={consoleEntries.length}
                  active={bottomTab === 'console'}
                  onClick={() => setBottomTab('console')}
                />
              </div>
              <div className="min-h-0 flex-1">
                {bottomTab === 'events' ? (
                  <LiveEventsPanel
                    events={events}
                    paused={eventsPaused}
                    pausedCount={eventsPausedCount}
                    onTogglePause={() => setEventsPaused(!eventsPaused)}
                    onClear={clearEvents}
                    onTraceClass={traceClassFromEvent}
                  />
                ) : (
                  <ConsolePane entries={consoleEntries} onClear={clearConsole} />
                )}
              </div>
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={22} minSize={15}>
          <ScriptLibraryPane
            builtin={builtinScripts}
            user={userScripts}
            onPick={loadFromLibrary}
            onDelete={(s) => void deleteUserScript(s.id, s.name)}
            onImportFiles={() => void importFiles()}
            onImportCodeshare={() => setCodeshareDialog(true)}
            onDuplicate={(s) => void duplicateScript(s)}
            onExport={(s) => void exportScript(s.id)}
            onEdit={(s) =>
              setEditScript({
                id: s.id,
                name: s.name,
                description: s.description,
                source: s.source
              })
            }
          />
        </ResizablePanel>
      </ResizablePanelGroup>

      <ParamRunDialog
        open={paramDialog !== null}
        title={paramDialog?.title ?? 'Run with parameters'}
        runLabel={paramDialog?.runLabel ?? 'Run'}
        params={paramDialog?.params ?? []}
        initialValues={draftSourceId ? (paramValues[draftSourceId] ?? {}) : {}}
        onCancel={() => setParamDialog(null)}
        onRun={runWithParams}
      />

      <Dialog open={saveDialog} onOpenChange={setSaveDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save script to library</DialogTitle>
            <DialogDescription>
              Saved scripts live in this project&apos;s library and persist across sessions.
            </DialogDescription>
          </DialogHeader>
          <input
            autoFocus
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Name, e.g. Custom WebView snooper"
            className="h-9 rounded-md border border-border bg-surface px-3 font-mono text-sm text-foreground outline-none focus:border-primary"
          />
          <input
            value={saveDescription}
            onChange={(e) => setSaveDescription(e.target.value)}
            placeholder="One-line description"
            className="h-9 rounded-md border border-border bg-surface px-3 font-mono text-sm text-foreground outline-none focus:border-primary"
          />
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setSaveDialog(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={!saveName.trim()} onClick={() => void submitSave()}>
              <Save className="h-3.5 w-3.5" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={codeshareDialog} onOpenChange={setCodeshareDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" /> Import from CodeShare
            </DialogTitle>
            <DialogDescription>
              Pulls a script from codeshare.frida.re by handle. Paste a{' '}
              <span className="font-mono">user/project</span> handle or a full CodeShare URL.
            </DialogDescription>
          </DialogHeader>
          <input
            autoFocus
            value={codeshareHandle}
            onChange={(e) => setCodeshareHandle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && codeshareHandle.trim()) void submitCodeshare()
            }}
            placeholder="pcipolloni/universal-android-ssl-pinning-bypass-with-frida"
            className="h-9 rounded-md border border-border bg-surface px-3 font-mono text-xs text-foreground outline-none focus:border-primary"
          />
          <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-2xs leading-relaxed text-warning">
            CodeShare scripts are community code that will run on your device with the target
            app&apos;s privileges. Review the source after import before running it against anything
            sensitive.
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setCodeshareDialog(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!codeshareHandle.trim() || codeshareBusy}
              onClick={() => void submitCodeshare()}
            >
              {codeshareBusy ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching...
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" /> Import
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editScript !== null} onOpenChange={(o) => (!o ? setEditScript(null) : null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit script details</DialogTitle>
            <DialogDescription>
              Rename or re-describe this library script. The source stays as it is - edit that in
              the main editor.
            </DialogDescription>
          </DialogHeader>
          {editScript && (
            <>
              <input
                autoFocus
                value={editScript.name}
                onChange={(e) => setEditScript({ ...editScript, name: e.target.value })}
                placeholder="Name"
                className="h-9 rounded-md border border-border bg-surface px-3 font-mono text-sm text-foreground outline-none focus:border-primary"
              />
              <input
                value={editScript.description}
                onChange={(e) => setEditScript({ ...editScript, description: e.target.value })}
                placeholder="One-line description"
                className="h-9 rounded-md border border-border bg-surface px-3 font-mono text-sm text-foreground outline-none focus:border-primary"
              />
            </>
          )}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditScript(null)}>
              Cancel
            </Button>
            <Button size="sm" disabled={!editScript?.name.trim()} onClick={() => void submitEdit()}>
              <Save className="h-3.5 w-3.5" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FridaBadge({ status }: { status: FridaStoreStatus }): JSX.Element {
  if (status.state === 'connected') return <Badge variant="success">Connected</Badge>
  if (status.state === 'connecting') return <Badge variant="warning">Connecting...</Badge>
  if (status.state === 'error') return <Badge variant="destructive">Error</Badge>
  return <Badge variant="muted">Disconnected</Badge>
}

function FridaHeaderMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone
}: {
  icon: typeof Activity
  label: string
  value: string
  detail: string
  tone: 'success' | 'muted'
}): JSX.Element {
  return (
    <div className="min-w-0 rounded-md border border-border bg-background/35 px-3 py-2">
      <div className="flex items-center gap-2">
        <Icon
          className={cn(
            'h-3.5 w-3.5 shrink-0',
            tone === 'success' ? 'text-success' : 'text-muted-foreground'
          )}
        />
        <span className="text-2xs uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      </div>
      <div className="mt-1 truncate text-xs font-medium text-foreground">{value}</div>
      <div className="mt-0.5 truncate font-mono text-2xs text-muted-foreground">{detail}</div>
    </div>
  )
}

/** Segmented tab button used by the workspace tabs and the bottom dock. */
function TabButton({
  icon: Icon,
  label,
  active,
  onClick,
  count
}: {
  icon: typeof Activity
  label: string
  active: boolean
  onClick: () => void
  count?: number
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
        active
          ? 'bg-surface-raised text-foreground'
          : 'text-muted-foreground hover:bg-surface-raised/50 hover:text-foreground'
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      {count != null && count > 0 && (
        <span className="font-mono text-2xs text-muted-foreground">{count}</span>
      )}
    </button>
  )
}

type FridaStoreStatus = ReturnType<typeof useFridaStore.getState>['status']

interface ProcessPaneProps {
  processes: { pid: number; name: string; identifier: string | null }[]
  filter: string
  onFilterChange: (next: string) => void
  appsOnly: boolean
  onAppsOnlyChange: (next: boolean) => void
  selectedTarget: FridaTarget | null
  onSelect: (target: FridaTarget | null) => void
  connected: boolean
}

function ProcessPane({
  processes,
  filter,
  onFilterChange,
  appsOnly,
  onAppsOnlyChange,
  selectedTarget,
  onSelect,
  connected
}: ProcessPaneProps): JSX.Element {
  // Apps come first — they're what most Frida workflows target. System
  // processes (zygote, surfaceflinger, native daemons…) get a separate
  // section below so users can still reach them when needed.
  const { apps, system } = useMemo(() => {
    const a: typeof processes = []
    const s: typeof processes = []
    for (const p of processes) {
      if (p.identifier) a.push(p)
      else s.push(p)
    }
    return { apps: a, system: s }
  }, [processes])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-9 shrink-0 flex-wrap items-center gap-2 border-b border-border bg-surface/30 px-3 py-1 text-xs">
        <Activity className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium">Processes</span>
        <span className="font-mono text-2xs text-muted-foreground">{processes.length}</span>
        <div className="ml-auto flex items-center gap-1">
          <span className="rounded border border-border bg-background/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            Apps {apps.length}
          </span>
          <span className="hidden rounded border border-border bg-background/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
            Native {system.length}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onAppsOnlyChange(!appsOnly)}
                className={cn(
                  'rounded border px-2 py-0.5 font-mono text-2xs transition-colors',
                  appsOnly
                    ? 'border-primary/40 bg-primary/15 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                )}
                aria-pressed={appsOnly}
              >
                Apps only
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Hide system/native processes. Most Frida scripts (Java, ART) only run inside app
              processes.
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border bg-surface/20 px-3 text-2xs">
        <Search className="h-3 w-3 text-muted-foreground" />
        <input
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder="Filter by name, package, or pid..."
          className="h-6 flex-1 bg-transparent font-mono text-2xs text-foreground outline-none placeholder:text-muted-foreground/60"
        />
        {filter && (
          <button
            type="button"
            onClick={() => onFilterChange('')}
            className="rounded px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:bg-surface-raised hover:text-foreground"
          >
            clear
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {!connected ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
            Start frida-server first.
          </div>
        ) : processes.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
            {appsOnly
              ? 'No apps match. Launch an app on the active device, or turn off "Apps only".'
              : 'No processes match.'}
          </div>
        ) : (
          <>
            {apps.length > 0 && (
              <ProcessSection
                label="Android apps"
                count={apps.length}
                items={apps}
                selectedTarget={selectedTarget}
                onSelect={onSelect}
              />
            )}
            {!appsOnly && system.length > 0 && (
              <ProcessSection
                label="System & native"
                count={system.length}
                items={system}
                selectedTarget={selectedTarget}
                onSelect={onSelect}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

interface ProcessSectionProps {
  label: string
  count: number
  items: { pid: number; name: string; identifier: string | null }[]
  selectedTarget: FridaTarget | null
  onSelect: (target: FridaTarget | null) => void
}

function ProcessSection({
  label,
  count,
  items,
  selectedTarget,
  onSelect
}: ProcessSectionProps): JSX.Element {
  return (
    <>
      <div className="sticky top-0 z-10 border-b border-border bg-surface/40 px-3 py-1 text-2xs uppercase tracking-wider text-muted-foreground backdrop-blur">
        {label} <span className="font-mono text-foreground/70">({count})</span>
      </div>
      {items.map((p) => {
        const target: FridaTarget = { pid: p.pid, identifier: p.identifier }
        const isSelected = isSameTarget(selectedTarget, target)
        const running = p.pid > 0
        return (
          <button
            key={p.identifier ?? `pid:${p.pid}`}
            type="button"
            onClick={() => onSelect(target)}
            className={cn(
              'flex w-full items-start justify-between gap-2 border-b border-l-2 border-b-border/30 border-l-transparent px-3 py-1.5 text-left font-mono text-2xs transition-colors hover:bg-surface-raised/60',
              isSelected && 'border-l-primary bg-surface-raised'
            )}
          >
            <span className="flex min-w-0 flex-1 items-start gap-2">
              <span
                className={cn(
                  'mt-1 h-1.5 w-1.5 shrink-0 rounded-full',
                  running ? 'bg-success' : 'bg-muted-foreground/40'
                )}
                aria-label={running ? 'Running' : 'Not running'}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-foreground">{p.identifier ?? p.name}</span>
                {p.identifier && p.identifier !== p.name && (
                  <span className="block truncate text-2xs text-muted-foreground/80">{p.name}</span>
                )}
              </span>
            </span>
            <span className="shrink-0 text-muted-foreground">
              {running ? `#${p.pid}` : 'spawn'}
            </span>
          </button>
        )
      })}
    </>
  )
}

interface ConsolePaneProps {
  entries: ReturnType<typeof useFridaStore.getState>['console']
  onClear: () => void
}

function channelOf(text: string): string | null {
  const m = /^\[([a-z-]+)\]/.exec(text)
  return m && m[1] ? m[1] : null
}

function ConsolePane({ entries, onClear }: ConsolePaneProps): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null)
  const [filter, setFilter] = useState('')
  const [levels, setLevels] = useState<{ info: boolean; warn: boolean; error: boolean }>({
    info: true,
    warn: true,
    error: true
  })
  // Channels (parsed from the [channel] prefix the agent emits) the user
  // has toggled OFF. Empty = show everything.
  const [hiddenChannels, setHiddenChannels] = useState<Set<string>>(new Set())

  const channelsPresent = useMemo(() => {
    const set = new Set<string>()
    for (const e of entries) {
      const c = channelOf(e.text)
      if (c) set.add(c)
    }
    return Array.from(set).sort()
  }, [entries])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return entries.filter((e) => {
      if (!levels[e.level]) return false
      const c = channelOf(e.text)
      if (c && hiddenChannels.has(c)) return false
      if (!q) return true
      return e.text.toLowerCase().includes(q)
    })
  }, [entries, filter, levels, hiddenChannels])

  const toggleChannel = (channel: string): void => {
    setHiddenChannels((prev) => {
      const next = new Set(prev)
      if (next.has(channel)) next.delete(channel)
      else next.add(channel)
      return next
    })
  }

  useEffect(() => {
    // Auto-scroll to bottom when the filtered list grows — we deliberately
    // depend on `filtered.length` rather than the raw entries so a search
    // doesn't yank the user to the bottom while they're typing a query
    // mid-scrollback.
    const el = ref.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [filtered.length])

  const toggleLevel = (level: 'info' | 'warn' | 'error'): void => {
    setLevels((s) => ({ ...s, [level]: !s[level] }))
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex min-h-7 shrink-0 flex-wrap items-center gap-2 border-b border-border bg-surface/30 px-3 py-1 text-2xs">
        <span className="font-mono uppercase tracking-wider text-muted-foreground">Console</span>
        <span className="font-mono text-foreground/60">
          {filtered.length === entries.length
            ? `(${entries.length})`
            : `(${filtered.length}/${entries.length})`}
        </span>
        <div className="ml-2 flex items-center gap-1">
          <LevelChip
            active={levels.info}
            onClick={() => toggleLevel('info')}
            label="info"
            tone="info"
          />
          <LevelChip
            active={levels.warn}
            onClick={() => toggleLevel('warn')}
            label="warn"
            tone="warn"
          />
          <LevelChip
            active={levels.error}
            onClick={() => toggleLevel('error')}
            label="error"
            tone="error"
          />
        </div>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter..."
          className="ml-2 h-5 min-w-[8rem] max-w-[20rem] flex-1 rounded-md border border-border bg-surface px-2 font-mono text-2xs text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary"
        />
        <div className="ml-auto">
          <Button size="sm" variant="ghost" className="h-5 px-2" onClick={onClear}>
            <Eraser className="h-3 w-3" /> Clear
          </Button>
        </div>
      </div>
      {channelsPresent.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border bg-surface/20 px-3 py-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
            channels
          </span>
          {channelsPresent.map((c) => {
            const on = !hiddenChannels.has(c)
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleChannel(c)}
                className={cn(
                  'h-4 rounded-sm border px-1 font-mono text-[10px] lowercase tracking-wider transition-colors',
                  on
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground/60'
                )}
                aria-pressed={on}
              >
                {c}
              </button>
            )
          })}
        </div>
      )}
      <div
        ref={ref}
        className="min-h-0 flex-1 overflow-auto px-3 py-2 font-mono text-2xs leading-relaxed"
      >
        {entries.length === 0 ? (
          <span className="text-muted-foreground">
            Output from the loaded script goes here. Calls to{' '}
            <span className="text-foreground">send(...)</span> and{' '}
            <span className="text-foreground">console.log</span> are streamed live.
          </span>
        ) : filtered.length === 0 ? (
          <span className="italic text-muted-foreground">No entries match the current filter.</span>
        ) : (
          filtered.map((e) => (
            <div key={e.id} className="flex gap-2">
              <span className="shrink-0 text-muted-foreground/60">
                {new Date(e.at).toLocaleTimeString()}
              </span>
              <span
                className={cn(
                  'whitespace-pre-wrap break-all',
                  e.level === 'error'
                    ? 'text-destructive'
                    : e.level === 'warn'
                      ? 'text-warning'
                      : 'text-foreground/90'
                )}
              >
                {e.text}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function LevelChip({
  active,
  onClick,
  label,
  tone
}: {
  active: boolean
  onClick: () => void
  label: string
  tone: 'info' | 'warn' | 'error'
}): JSX.Element {
  const toneClass =
    tone === 'error'
      ? active
        ? 'border-destructive/40 bg-destructive/15 text-destructive'
        : 'border-border text-muted-foreground/60'
      : tone === 'warn'
        ? active
          ? 'border-warning/40 bg-warning/15 text-warning'
          : 'border-border text-muted-foreground/60'
        : active
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-border text-muted-foreground/60'
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-4 rounded-sm border px-1 font-mono text-[10px] uppercase tracking-wider transition-colors',
        toneClass
      )}
      aria-pressed={active}
    >
      {label}
    </button>
  )
}

interface LibScript {
  id: string
  name: string
  description: string
  source: string
}

interface ScriptLibraryProps {
  builtin: LibScript[]
  user: LibScript[]
  onPick: (script: LibScript) => void
  onDelete: (script: { id: string; name: string }) => void
  onImportFiles: () => void
  onImportCodeshare: () => void
  onDuplicate: (script: LibScript) => void
  onExport: (script: LibScript) => void
  onEdit: (script: LibScript) => void
}

function ScriptLibraryPane({
  builtin,
  user,
  onPick,
  onDelete,
  onImportFiles,
  onImportCodeshare,
  onDuplicate,
  onExport,
  onEdit
}: ScriptLibraryProps): JSX.Element {
  const [filter, setFilter] = useState('')
  const q = filter.trim().toLowerCase()
  const matchesFilter = (script: LibScript): boolean => {
    if (!q) return true
    return (
      script.name.toLowerCase().includes(q) ||
      script.description.toLowerCase().includes(q) ||
      script.id.toLowerCase().includes(q) ||
      script.source.toLowerCase().includes(q)
    )
  }
  const filteredBuiltin = builtin.filter(matchesFilter)
  const filteredUser = user.filter(matchesFilter)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-surface/30 px-3 text-xs">
        <BookOpen className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium">Script library</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="ml-auto h-6 px-2">
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[220px]">
            <DropdownMenuLabel>Add scripts</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onImportFiles()}>
              <FilePlus2 className="h-3.5 w-3.5" /> Import from file(s)...
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onImportCodeshare()}>
              <Globe className="h-3.5 w-3.5" /> Import from CodeShare...
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border bg-surface/20 px-3 text-2xs">
        <Search className="h-3 w-3 text-muted-foreground" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search scripts..."
          className="h-6 min-w-0 flex-1 bg-transparent font-mono text-2xs text-foreground outline-none placeholder:text-muted-foreground/60"
        />
        {filter && (
          <button
            type="button"
            onClick={() => setFilter('')}
            className="rounded px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:bg-surface-raised hover:text-foreground"
          >
            clear
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="border-b border-border bg-surface/20 px-3 py-1.5 text-2xs uppercase tracking-wider text-muted-foreground">
          Built-in ({filteredBuiltin.length}/{builtin.length})
        </div>
        {filteredBuiltin.length === 0 ? (
          <div className="px-3 py-3 text-2xs leading-relaxed text-muted-foreground">
            No built-in scripts match the current search.
          </div>
        ) : (
          filteredBuiltin.map((s) => (
            <ScriptRow
              key={s.id}
              script={s}
              onPick={onPick}
              // Built-ins can't be edited or deleted; users fork them via
              // Duplicate, then edit the copy. Export lets them grab the
              // raw .js to share or version-control.
              actions={[
                { icon: Copy, label: 'Duplicate to my library', run: () => onDuplicate(s) },
                { icon: Download, label: 'Export to file', run: () => onExport(s) }
              ]}
            />
          ))
        )}
        <div className="border-y border-border bg-surface/20 px-3 py-1.5 text-2xs uppercase tracking-wider text-muted-foreground">
          Yours ({filteredUser.length}/{user.length})
        </div>
        {user.length === 0 ? (
          <div className="px-3 py-3 text-2xs leading-relaxed text-muted-foreground">
            Save the editor draft with <span className="font-mono">Save as</span>, import a{' '}
            <span className="font-mono">.js</span> file, or pull one from CodeShare via{' '}
            <span className="font-mono">Add</span> above.
          </div>
        ) : filteredUser.length === 0 ? (
          <div className="px-3 py-3 text-2xs leading-relaxed text-muted-foreground">
            No saved scripts match the current search.
          </div>
        ) : (
          filteredUser.map((s) => (
            <ScriptRow
              key={s.id}
              script={s}
              onPick={onPick}
              actions={[
                { icon: Pencil, label: 'Edit name / description', run: () => onEdit(s) },
                { icon: Copy, label: 'Duplicate', run: () => onDuplicate(s) },
                { icon: Download, label: 'Export to file', run: () => onExport(s) },
                {
                  icon: Trash2,
                  label: 'Delete',
                  run: () => onDelete(s),
                  danger: true
                }
              ]}
            />
          ))
        )}
      </div>
    </div>
  )
}

interface RowAction {
  icon: typeof Copy
  label: string
  run: () => void
  danger?: boolean
}

function ScriptRow({
  script,
  onPick,
  actions
}: {
  script: LibScript
  onPick: (s: LibScript) => void
  actions: RowAction[]
}): JSX.Element {
  return (
    <div className="group flex items-start gap-1 border-b border-border/30 px-3 py-2">
      <button
        type="button"
        onClick={() => onPick(script)}
        className="min-w-0 flex-1 text-left transition-colors hover:text-foreground"
      >
        <div className="truncate text-xs font-medium">{script.name}</div>
        {script.description && (
          <div className="mt-0.5 line-clamp-2 text-2xs leading-relaxed text-muted-foreground">
            {script.description}
          </div>
        )}
      </button>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {actions.map((a) => (
          <Tooltip key={a.label}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => a.run()}
                className={cn(
                  'rounded p-1 text-muted-foreground transition-colors hover:bg-surface-raised',
                  a.danger ? 'hover:text-destructive' : 'hover:text-foreground'
                )}
                aria-label={a.label}
              >
                <a.icon className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{a.label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  )
}
