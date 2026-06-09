/**
 * The typed contract exposed by the preload script to the renderer.
 * Renderer code interacts with `window.api.<namespace>.<method>()`.
 *
 * Every method here MUST resolve (never reject) — main process wraps each
 * handler with an `IpcResult<T>` envelope. Renderer code should branch on
 * `.ok` rather than try/catch.
 */

import type {
  AndroidSdk,
  AppInfo,
  ApkAnalysisSummary,
  AvdInfo,
  CaInstallResult,
  CapturedRequest,
  CloseConfirmAction,
  Device,
  DeviceList,
  DialogOptions,
  EmulatorInstall,
  EmulatorBootProgress,
  EmulatorStatus,
  FirmwareDownloadOptions,
  FirmwareDownloadResult,
  FirmwareSearchResult,
  FridaProcess,
  FridaScript,
  FridaStatus,
  IpcResult,
  JadxDecompileOptions,
  JadxFileEntry,
  JadxProgress,
  JadxProjectSummary,
  JadxReadFileResult,
  JadxSearchResult,
  JadxStatus,
  LogcatLine,
  LogcatOptions,
  LogcatStatus,
  MirrorStatus,
  MirrorTouchEvent,
  MirrorVideoInit,
  MirrorVideoPacket,
  Project,
  ProjectSummary,
  ProxyStatus,
  RepeaterTab,
  RootToolResult,
  RootActionResult,
  RootRebootMode,
  SdkSetupOptions,
  SdkSetupProgress,
  Setting,
  ToolInfo,
  ToolInstallProgress,
  WirelessConnectProgress,
  WirelessPairResult,
  MagiskFlashOptions,
  MagiskPatchedImageSearchResult,
  MagiskRootStartOptions
} from './types'
import type {
  ActiveTrace,
  ApplyStrategiesResult,
  AutoPwnResult,
  ClassMethodInfo,
  ClassSearchResult,
  FridaEvent,
  FridaPreset,
  HeapInstance,
  ReconResult,
  StrategyInfo,
  TracerInfo
} from './frida-intel'

export interface AppApi {
  getInfo(): Promise<AppInfo>
  openExternal(url: string): Promise<IpcResult<void>>
  minimizeWindow(): Promise<void>
  maximizeWindow(): Promise<void>
  closeWindow(): Promise<void>
  isMaximized(): Promise<boolean>
  quit(): Promise<void>
  /** Resolve an absolute filesystem path from a dropped File. */
  getFilePath(file: File): string
  /** Renderer's response to the close-confirmation prompt. */
  confirmClose(action: CloseConfirmAction, dontAskAgain: boolean): Promise<IpcResult<void>>
}

export interface DbApi {
  listProjects(): Promise<IpcResult<Project[]>>
  createProject(name: string): Promise<IpcResult<Project>>
  deleteProject(id: string): Promise<IpcResult<void>>
  renameProject(id: string, name: string): Promise<IpcResult<Project>>
  getActiveProject(): Promise<IpcResult<Project | null>>
  setActiveProject(id: string): Promise<IpcResult<void>>
  listSettings(): Promise<IpcResult<Setting[]>>
  getSetting(key: string): Promise<IpcResult<string | null>>
  setSetting(key: string, value: string): Promise<IpcResult<void>>
  getProjectSummary(projectId?: string): Promise<IpcResult<ProjectSummary | null>>
  wipeSession(projectId?: string): Promise<IpcResult<void>>
}

export interface EmulatorInstallsApi {
  list(): Promise<IpcResult<EmulatorInstall[]>>
  refresh(): Promise<IpcResult<EmulatorInstall[]>>
  launch(installId: string): Promise<IpcResult<void>>
  connectAll(installId: string): Promise<IpcResult<{ connected: string[]; failed: string[] }>>
}

export interface DeviceApi {
  list(): Promise<IpcResult<DeviceList>>
  getActive(): Promise<IpcResult<Device | null>>
  setActive(serial: string | null): Promise<IpcResult<void>>
  refresh(): Promise<IpcResult<DeviceList>>
  enableTcpip(serial: string, port?: number): Promise<IpcResult<{ host: string; port: number }>>
  connect(target: string): Promise<IpcResult<{ serial: string }>>
  disconnect(serial: string): Promise<IpcResult<void>>
  sendKey(key: string): Promise<IpcResult<void>>
  wirelessConnect(opts: {
    /** Existing USB serial to promote to TCP/IP. */
    fromSerial?: string
    /** `host:port` to connect to directly (skips tcpip step). */
    hostPort?: string
    port?: number
  }): Promise<IpcResult<{ serial: string }>>
  pairWireless(opts: {
    /** Pairing address shown in Android's "Pair device with pairing code" dialog. */
    pairHostPort: string
    /** Six-digit code shown beside that pairing address. */
    pairingCode: string
    /** Optional connection address from the main Wireless Debugging screen. */
    connectHostPort?: string
  }): Promise<IpcResult<WirelessPairResult>>
}

export interface OtherToolsApi {
  rootCheck(): Promise<IpcResult<RootToolResult>>
  tryAdbRoot(): Promise<IpcResult<RootToolResult>>
  rebootForRoot(mode: RootRebootMode): Promise<IpcResult<RootActionResult>>
  listFastbootDevices(): Promise<IpcResult<RootActionResult>>
  flashMagiskPatchedImage(options: MagiskFlashOptions): Promise<IpcResult<RootActionResult>>
  detectMagiskPatchedImages(): Promise<IpcResult<MagiskPatchedImageSearchResult>>
  startMagiskRoot(options: MagiskRootStartOptions): Promise<IpcResult<RootActionResult>>
  findFirmwareImages(): Promise<IpcResult<FirmwareSearchResult>>
  downloadFirmwareImage(
    options: FirmwareDownloadOptions
  ): Promise<IpcResult<FirmwareDownloadResult>>
}

export interface EmulatorApi {
  getStatus(): Promise<EmulatorStatus>
  start(): Promise<IpcResult<void>>
  stop(): Promise<IpcResult<void>>
  restart(): Promise<IpcResult<void>>
  sendKey(key: string): Promise<IpcResult<void>>
  installApk(filePath: string): Promise<IpcResult<{ packageName: string }>>
  listInstalledApps(): Promise<IpcResult<{ packageName: string; label: string }[]>>
  launchApp(packageName: string): Promise<IpcResult<void>>
  listAvds(): Promise<IpcResult<AvdInfo[]>>
  selectAvd(name: string): Promise<IpcResult<void>>
  getSelectedAvd(): Promise<IpcResult<string | null>>
  detectSdk(): Promise<IpcResult<AndroidSdk>>
}

export interface ToolchainApi {
  list(): Promise<IpcResult<ToolInfo[]>>
  install(toolId: string): Promise<IpcResult<void>>
  cancel(toolId: string): Promise<IpcResult<void>>
  revealInstallDir(): Promise<IpcResult<void>>
}

export interface SdkApi {
  runFullSetup(options: Partial<SdkSetupOptions>): Promise<IpcResult<{ avdName: string }>>
  getProgress(): Promise<SdkSetupProgress>
  cancelSetup(): Promise<IpcResult<void>>
  createAvd(options: SdkSetupOptions): Promise<IpcResult<{ avdName: string }>>
  deleteAvd(name: string): Promise<IpcResult<void>>
  listSystemImages(): Promise<IpcResult<string[]>>
}

export interface MirrorApi {
  getStatus(): Promise<MirrorStatus>
  start(): Promise<IpcResult<void>>
  stop(): Promise<IpcResult<void>>
  sendTouch(event: MirrorTouchEvent): Promise<IpcResult<void>>
  sendKey(keycode: number, action: 'down' | 'up'): Promise<IpcResult<void>>
}

export interface ProxyApi {
  getStatus(): Promise<ProxyStatus>
  start(): Promise<IpcResult<void>>
  stop(): Promise<IpcResult<void>>
  listRequests(opts?: {
    limit?: number
    offset?: number
    search?: string
  }): Promise<IpcResult<CapturedRequest[]>>
  getRequest(id: string): Promise<IpcResult<CapturedRequest | null>>
  clearRequests(): Promise<IpcResult<void>>
  exportHar(filePath: string): Promise<IpcResult<void>>
  reinstallCa(): Promise<IpcResult<CaInstallResult>>
  getCaInstallResult(): Promise<IpcResult<CaInstallResult | null>>
}

export interface RepeaterApi {
  listTabs(): Promise<IpcResult<RepeaterTab[]>>
  createTab(fromRequestId?: string): Promise<IpcResult<RepeaterTab>>
  updateTab(tab: RepeaterTab): Promise<IpcResult<RepeaterTab>>
  deleteTab(id: string): Promise<IpcResult<void>>
  send(tab: RepeaterTab): Promise<IpcResult<RepeaterTab>>
  saveBody(filePath: string, content: string): Promise<IpcResult<void>>
}

export interface FridaApi {
  getStatus(): Promise<FridaStatus>
  listProcesses(): Promise<IpcResult<FridaProcess[]>>
  attach(pid: number, scriptSource: string): Promise<IpcResult<{ sessionId: string }>>
  spawn(identifier: string, scriptSource: string): Promise<IpcResult<{ sessionId: string }>>
  launchAndAttach(
    identifier: string,
    scriptSource: string
  ): Promise<IpcResult<{ sessionId: string }>>
  /** Load the intelligence agent + profile the target → App Intelligence Report. */
  reconnaissance(opts: {
    pid?: number
    identifier?: string | null
    method?: 'attach' | 'spawn' | 'launch-attach'
  }): Promise<IpcResult<ReconResult>>
  /** One-click: profile + apply the full applicable bypass stack + verify. */
  autoPwn(opts: {
    pid?: number
    identifier?: string | null
    method?: 'attach' | 'spawn' | 'launch-attach'
  }): Promise<IpcResult<AutoPwnResult>>
  /** Apply specific strategies to an existing agent session. */
  applyStrategies(sessionId: string, ids: string[]): Promise<IpcResult<ApplyStrategiesResult>>
  /** Enumerate available strategies + applicability for a session. */
  listStrategies(sessionId: string): Promise<IpcResult<StrategyInfo[]>>
  /** List live monitors + active state for a session. */
  listTracers(sessionId: string): Promise<IpcResult<TracerInfo[]>>
  /** Start a live monitor; resolves the updated monitor list. */
  startTracer(sessionId: string, id: string): Promise<IpcResult<TracerInfo[]>>
  /** Stop a live monitor; resolves the updated monitor list. */
  stopTracer(sessionId: string, id: string): Promise<IpcResult<TracerInfo[]>>
  /** Search loaded classes by substring. */
  enumerateClasses(
    sessionId: string,
    filter: string,
    limit?: number
  ): Promise<IpcResult<ClassSearchResult>>
  /** Reflect a class's declared methods. */
  listMethods(sessionId: string, className: string): Promise<IpcResult<ClassMethodInfo>>
  /** Trace every method of a class (logs to the console [trace] channel). */
  traceClass(
    sessionId: string,
    className: string
  ): Promise<IpcResult<{ ok: boolean; hooked: number }>>
  untraceClass(sessionId: string, className: string): Promise<IpcResult<void>>
  /** Snapshot live instances of a class from the heap. */
  chooseInstances(
    sessionId: string,
    className: string,
    limit?: number
  ): Promise<IpcResult<HeapInstance[]>>
  /** Trace a native export (module!symbol). */
  traceNative(
    sessionId: string,
    moduleName: string,
    symbol: string
  ): Promise<IpcResult<{ ok: boolean }>>
  untraceNative(sessionId: string, moduleName: string, symbol: string): Promise<IpcResult<void>>
  /** List active monitors/class/native traces for the stop list. */
  listActiveTraces(sessionId: string): Promise<IpcResult<ActiveTrace[]>>
  /** List saved instrumentation presets, optionally ranked for a package. */
  listPresets(packageName?: string): Promise<IpcResult<FridaPreset[]>>
  /** Create or update a preset. */
  savePreset(preset: {
    id?: string
    packageName: string
    name: string
    strategyIds: string[]
    monitorIds: string[]
  }): Promise<IpcResult<FridaPreset>>
  deletePreset(id: string): Promise<IpcResult<void>>
  detach(sessionId: string): Promise<IpcResult<void>>
  loadScript(sessionId: string, scriptSource: string): Promise<IpcResult<void>>
  listBuiltinScripts(): Promise<IpcResult<FridaScript[]>>
  installServer(): Promise<IpcResult<void>>
  stopServer(): Promise<IpcResult<void>>
  listUserScripts(): Promise<IpcResult<FridaScript[]>>
  saveUserScript(script: {
    id?: string
    name: string
    description: string
    source: string
  }): Promise<IpcResult<FridaScript>>
  deleteUserScript(id: string): Promise<IpcResult<void>>
  importScriptFiles(): Promise<IpcResult<FridaScript[]>>
  importCodeshare(handle: string): Promise<IpcResult<FridaScript>>
  exportScript(id: string): Promise<IpcResult<{ path: string } | null>>
  /** Evaluate a JS expression in the live Frida session context. Returns
   *  { ok: true, value: <stringified result> } or { ok: false, value: <error message> }. */
  evalCode(sessionId: string, code: string): Promise<IpcResult<{ ok: boolean; value: string }>>
}

export interface ApkSecretPatternSummary {
  id: string
  label: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  regex: string
}

export interface ApkApi {
  analyze(filePath: string): Promise<IpcResult<ApkAnalysisSummary>>
  getManifest(filePath: string): Promise<IpcResult<string>>
  decompile(filePath: string): Promise<IpcResult<{ outputDir: string }>>
  searchSecrets(
    filePath: string,
    patterns?: string[]
  ): Promise<IpcResult<ApkAnalysisSummary['secrets']>>
  listStrings(filePath: string): Promise<IpcResult<string[]>>
  listPatterns(): Promise<IpcResult<ApkSecretPatternSummary[]>>
  installOnActiveDevice(
    filePath: string
  ): Promise<IpcResult<{ packageName: string; serial: string }>>
  spawnWithBypass(
    filePath: string,
    scriptId?: string
  ): Promise<IpcResult<{ sessionId: string; packageName: string }>>
}

export interface JadxApi {
  status(): Promise<IpcResult<JadxStatus>>
  decompile(options: JadxDecompileOptions): Promise<IpcResult<JadxProjectSummary>>
  listTree(projectId: string): Promise<IpcResult<JadxFileEntry[]>>
  readFile(projectId: string, path: string): Promise<IpcResult<JadxReadFileResult>>
  search(projectId: string, query: string, limit?: number): Promise<IpcResult<JadxSearchResult[]>>
  revealOutput(projectId: string): Promise<IpcResult<void>>
  deleteProject(projectId: string): Promise<IpcResult<void>>
}

export interface LogcatApi {
  /** Start (or restart) the capture with device-side options. */
  start(options: LogcatOptions): Promise<IpcResult<LogcatStatus>>
  stop(): Promise<IpcResult<LogcatStatus>>
  /** Clear the device's logcat buffers (`adb logcat -c`). */
  clear(): Promise<IpcResult<void>>
  getStatus(): Promise<IpcResult<LogcatStatus>>
  /** Resolve a package name to its main pid (for --pid scoping), or null. */
  resolvePid(packageName: string): Promise<IpcResult<number | null>>
}

export interface DialogApi {
  showOpen(options: DialogOptions): Promise<IpcResult<string[]>>
  showSave(options: DialogOptions): Promise<IpcResult<string | null>>
  showMessage(message: string, detail?: string): Promise<void>
}

export interface LogApi {
  write(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: unknown): void
}

/** Subscribe to push events from main. Returns an unsubscribe function. */
export interface EventsApi {
  onDeviceListChanged(handler: (list: DeviceList) => void): () => void
  onDeviceActiveChanged(handler: (payload: { serial: string | null }) => void): () => void
  onWirelessProgress(handler: (progress: WirelessConnectProgress) => void): () => void
  onEmulatorStatus(handler: (status: EmulatorStatus) => void): () => void
  onEmulatorBootProgress(handler: (progress: EmulatorBootProgress) => void): () => void
  onProxyStatus(handler: (status: ProxyStatus) => void): () => void
  onProxyRequest(handler: (req: CapturedRequest) => void): () => void
  onProxyResponse(handler: (req: CapturedRequest) => void): () => void
  onProxyCaInstall(handler: (result: CaInstallResult) => void): () => void
  onFridaStatus(handler: (status: FridaStatus) => void): () => void
  onFridaConsole(
    handler: (msg: { sessionId: string; level: string; text: string }) => void
  ): () => void
  onFridaEvent(handler: (event: FridaEvent) => void): () => void
  onLogcatLines(handler: (lines: LogcatLine[]) => void): () => void
  onLogcatStatus(handler: (status: LogcatStatus) => void): () => void
  onJadxProgress(handler: (progress: JadxProgress) => void): () => void
  onToolInstallProgress(handler: (progress: ToolInstallProgress) => void): () => void
  onSdkSetupProgress(handler: (progress: SdkSetupProgress) => void): () => void
  onMirrorStatus(handler: (status: MirrorStatus) => void): () => void
  onMirrorVideoInit(handler: (init: MirrorVideoInit) => void): () => void
  onMirrorVideoPacket(handler: (packet: MirrorVideoPacket) => void): () => void
  onWindowMaximizedChanged(handler: (isMaximized: boolean) => void): () => void
  onWindowCloseRequested(handler: (summary: ProjectSummary) => void): () => void
}

export interface MobsecApi {
  app: AppApi
  db: DbApi
  device: DeviceApi
  emulatorInstalls: EmulatorInstallsApi
  emulator: EmulatorApi
  otherTools: OtherToolsApi
  toolchain: ToolchainApi
  sdk: SdkApi
  mirror: MirrorApi
  proxy: ProxyApi
  repeater: RepeaterApi
  frida: FridaApi
  apk: ApkApi
  jadx: JadxApi
  logcat: LogcatApi
  dialog: DialogApi
  log: LogApi
  on: EventsApi
}

declare global {
  interface Window {
    api: MobsecApi
  }
}
