import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Toaster } from '@/components/ui/sonner'
import { TitleBar } from '@/components/TitleBar'
import { Sidebar } from '@/components/Sidebar'
import { StatusBar } from '@/components/StatusBar'
import { EmulatorView } from '@/components/EmulatorView'
import { DashboardTab } from '@/components/tabs/DashboardTab'
import { ProxyTab } from '@/components/tabs/ProxyTab'
import { RepeaterTab } from '@/components/tabs/RepeaterTab'
import { FridaTab } from '@/components/tabs/FridaTab'
import { APKAnalyzerTab } from '@/components/tabs/APKAnalyzerTab'
import { JadxTab } from '@/components/tabs/JadxTab'
import { LogcatTab } from '@/components/tabs/LogcatTab'
import { OtherToolsTab } from '@/components/tabs/OtherToolsTab'
import { SettingsTab } from '@/components/tabs/SettingsTab'
import { useUIStore, type ToolId } from '@/stores/useUIStore'
import { useAppStore } from '@/stores/useAppStore'
import { useEmulatorStore } from '@/stores/useEmulatorStore'
import { useProxyStore } from '@/stores/useProxyStore'
import { useToolchainStore } from '@/stores/useToolchainStore'
import { useSdkSetupStore } from '@/stores/useSdkSetupStore'
import { useMirrorStore } from '@/stores/useMirrorStore'
import { useProjectsStore } from '@/stores/useProjectsStore'
import { useRepeaterStore } from '@/stores/useRepeaterStore'
import { useLogcatStore } from '@/stores/useLogcatStore'
import { useJadxStore } from '@/stores/useJadxStore'
import { ApkDropZone } from '@/components/ApkDropZone'
import { CloseConfirmDialog } from '@/components/CloseConfirmDialog'
import { CertInstallWizard } from '@/components/proxy/CertInstallWizard'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useCaInstallStore } from '@/stores/useCaInstallStore'
import { toast } from 'sonner'

const TAB_COMPONENTS: Record<ToolId, () => JSX.Element> = {
  dashboard: DashboardTab,
  proxy: ProxyTab,
  repeater: RepeaterTab,
  frida: FridaTab,
  apk: APKAnalyzerTab,
  jadx: JadxTab,
  logcat: LogcatTab,
  tools: OtherToolsTab,
  settings: SettingsTab
}

export default function App(): JSX.Element {
  const activeTool = useUIStore((s) => s.activeTool)
  const setActiveTool = useUIStore((s) => s.setActiveTool)
  const emulatorPanelSize = useUIStore((s) => s.emulatorPanelSize)
  const emulatorPanelVisible = useUIStore((s) => s.emulatorPanelVisible)
  const setEmulatorPanelSize = useUIStore((s) => s.setEmulatorPanelSize)

  const hydrateApp = useAppStore((s) => s.hydrate)
  const hydrateEmulator = useEmulatorStore((s) => s.hydrate)
  const hydrateProxy = useProxyStore((s) => s.hydrate)
  const hydrateToolchain = useToolchainStore((s) => s.hydrate)
  const hydrateSdk = useSdkSetupStore((s) => s.hydrate)
  const hydrateMirror = useMirrorStore((s) => s.hydrate)
  const hydrateProjects = useProjectsStore((s) => s.hydrate)
  const projectsEpoch = useProjectsStore((s) => s.activeEpoch)
  const refreshAppProject = useAppStore((s) => s.refreshProject)
  const hydrateRepeater = useRepeaterStore((s) => s.hydrate)
  const setEmulatorStatus = useEmulatorStore((s) => s.setStatus)
  const setBootProgress = useEmulatorStore((s) => s.setBootProgress)
  const setProxyStatus = useProxyStore((s) => s.setStatus)
  const appendProxyRequest = useProxyStore((s) => s.appendRequest)
  const updateProxyRequest = useProxyStore((s) => s.updateRequest)
  const applyToolProgress = useToolchainStore((s) => s.applyProgress)
  const setSdkProgress = useSdkSetupStore((s) => s.setProgress)
  const setMirrorStatus = useMirrorStore((s) => s.setStatus)
  const setMirrorVideoInit = useMirrorStore((s) => s.setVideoInit)
  const setJadxProgress = useJadxStore((s) => s.setProgress)

  useEffect(() => {
    void hydrateApp()
    void hydrateEmulator()
    void hydrateProxy()
    void hydrateToolchain()
    void hydrateSdk()
    void hydrateMirror()
    void hydrateProjects()
  }, [
    hydrateApp,
    hydrateEmulator,
    hydrateProxy,
    hydrateToolchain,
    hydrateSdk,
    hydrateMirror,
    hydrateProjects
  ])

  // When the active project changes, refresh the data stores that are
  // scoped to it. activeEpoch is a monotonic counter so we don't have to
  // diff the project object identity.
  useEffect(() => {
    if (projectsEpoch === 0) return
    void refreshAppProject()
    void hydrateProxy()
    void hydrateRepeater()
  }, [projectsEpoch, refreshAppProject, hydrateProxy, hydrateRepeater])

  // Subscribe to push events from main. Cleanups returned by `on.*` unbind
  // the underlying ipcRenderer listeners.
  useEffect(() => {
    const offEmu = window.api.on.onEmulatorStatus(setEmulatorStatus)
    const offBoot = window.api.on.onEmulatorBootProgress(setBootProgress)
    const offProxy = window.api.on.onProxyStatus(setProxyStatus)
    const offProxyReq = window.api.on.onProxyRequest(appendProxyRequest)
    const offProxyRes = window.api.on.onProxyResponse(updateProxyRequest)
    const offCa = window.api.on.onProxyCaInstall((result) => {
      // Hand every result to the wizard store. It owns toast surfacing
      // and auto-open semantics so we don't duplicate "you need to tap
      // through" warnings across UI surfaces.
      useCaInstallStore.getState().setResult(result)
      if (result.state === 'installed') {
        toast.success('HTTPS interception enabled', { description: result.message })
      } else if (result.state === 'error') {
        toast.error('CA cert install failed', { description: result.message })
      } else if (result.state === 'user-action-required') {
        toast.warning('Finish the cert install on your phone', {
          description: 'Tap through the dialog that just opened — see the wizard for steps.'
        })
      }
    })
    const offTool = window.api.on.onToolInstallProgress(applyToolProgress)
    const offSdk = window.api.on.onSdkSetupProgress(setSdkProgress)
    const offMirror = window.api.on.onMirrorStatus(setMirrorStatus)
    const offMirrorInit = window.api.on.onMirrorVideoInit(setMirrorVideoInit)
    // Logcat streams continuously once started — ingest at the app level so
    // lines keep flowing into the ring buffer even when the tab isn't open.
    const offLogcatLines = window.api.on.onLogcatLines((lines) =>
      useLogcatStore.getState().appendLines(lines)
    )
    const offLogcatStatus = window.api.on.onLogcatStatus((status) =>
      useLogcatStore.getState().setStatus(status)
    )
    const offJadxProgress = window.api.on.onJadxProgress(setJadxProgress)
    return () => {
      offEmu()
      offBoot()
      offProxy()
      offProxyReq()
      offProxyRes()
      offCa()
      offTool()
      offSdk()
      offMirror()
      offMirrorInit()
      offLogcatLines()
      offLogcatStatus()
      offJadxProgress()
    }
  }, [
    setEmulatorStatus,
    setBootProgress,
    setProxyStatus,
    appendProxyRequest,
    updateProxyRequest,
    applyToolProgress,
    setSdkProgress,
    setMirrorStatus,
    setMirrorVideoInit,
    setJadxProgress
  ])

  // Keyboard shortcuts: Cmd/Ctrl+1..8 to switch tools, Cmd/Ctrl+, for Settings.
  useEffect(() => {
    const order: ToolId[] = [
      'dashboard',
      'proxy',
      'repeater',
      'frida',
      'apk',
      'jadx',
      'logcat',
      'tools'
    ]
    function onKey(e: KeyboardEvent): void {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key === ',') {
        e.preventDefault()
        setActiveTool('settings')
        return
      }
      const idx = Number(e.key) - 1
      if (Number.isInteger(idx) && idx >= 0 && idx < order.length) {
        e.preventDefault()
        setActiveTool(order[idx] as ToolId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setActiveTool])

  const ActiveComponent = TAB_COMPONENTS[activeTool]
  const mainPanelSize = emulatorPanelVisible ? 100 - emulatorPanelSize : 100

  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={400}>
      <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
        <TitleBar />
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <main className="flex min-h-0 flex-1 overflow-hidden">
            <ResizablePanelGroup direction="horizontal" autoSaveId="mobsec.main-split">
              <ResizablePanel defaultSize={mainPanelSize} minSize={30}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={activeTool}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.16, ease: 'easeOut' }}
                    className="h-full"
                  >
                    <ErrorBoundary resetKey={activeTool}>
                      <ActiveComponent />
                    </ErrorBoundary>
                  </motion.div>
                </AnimatePresence>
              </ResizablePanel>
              {emulatorPanelVisible && (
                <>
                  <ResizableHandle withHandle />
                  <ResizablePanel
                    defaultSize={emulatorPanelSize}
                    minSize={22}
                    maxSize={55}
                    onResize={setEmulatorPanelSize}
                  >
                    <EmulatorView />
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </main>
        </div>
        <StatusBar />
        <Toaster />
        <ApkDropZone />
        <CloseConfirmDialog />
        <CertInstallWizard />
      </div>
    </TooltipProvider>
  )
}
