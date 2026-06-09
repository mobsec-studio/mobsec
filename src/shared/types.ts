/**
 * Shared domain types used by both main and renderer processes.
 * Keep this file dependency-free — no node, no electron, no react imports.
 */

export interface AppInfo {
  version: string
  platform: NodeJS.Platform
  arch: string
  isPackaged: boolean
  userData: string
  resourcesPath: string
}

export interface Project {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface ProjectSummary {
  project: Project
  capturedRequests: number
  repeaterTabs: number
}

export type CloseConfirmAction =
  | 'save' // keep everything
  | 'discard' // wipe all session data (captured + repeater)
  | 'discard-proxy' // wipe captured requests only, keep repeater tabs
  | 'cancel' // abort close

export interface Setting {
  key: string
  value: string
}

export type EmulatorState =
  | 'idle'
  | 'starting'
  | 'booting'
  | 'running'
  | 'stopping'
  | 'error'
  | 'missing-dependencies'

export interface EmulatorStatus {
  state: EmulatorState
  avdName: string | null
  serial: string | null
  errorMessage?: string
}

export interface EmulatorBootProgress {
  phase: 'downloading-tools' | 'creating-avd' | 'booting' | 'configuring' | 'ready'
  percent: number
  message: string
}

export type ProxyState = 'stopped' | 'starting' | 'running' | 'stopping' | 'error'

export interface ProxyStatus {
  state: ProxyState
  port: number
  errorMessage?: string
}

export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS'
  | 'CONNECT'
  | 'TRACE'

export interface CapturedRequest {
  id: string
  timestamp: number
  method: HttpMethod | string
  scheme: 'http' | 'https'
  host: string
  port: number
  path: string
  url: string
  requestHeaders: Record<string, string>
  requestBody: string | null
  status: number | null
  statusText: string | null
  responseHeaders: Record<string, string>
  responseBody: string | null
  contentType: string | null
  durationMs: number | null
  size: number
  fromApp?: string | null
}

export interface RepeaterResponse {
  status: number
  statusText?: string
  headers: string
  body: string
  durationMs: number
  redirects?: {
    status: number
    statusText?: string
    url: string
    location: string
  }[]
}

export interface RepeaterSnapshot {
  /** Sent-at ISO timestamp. */
  sentAt: string
  request: {
    method: string
    url: string
    headers: string
    body: string
  }
  response: RepeaterResponse | null
  /** Set when the request errored before producing a response. */
  error?: string
}

export interface RepeaterTabSettings {
  /** Add/refresh Content-Length on send so the user doesn't have to. */
  autoContentLength: boolean
  /** Follow 3xx redirects automatically (up to 5 hops). */
  followRedirects: boolean
  /** When > 1, the next Send fires this many requests back-to-back. */
  repeatCount: number
}

export interface RepeaterTab {
  id: string
  name: string
  method: string
  url: string
  headers: string
  body: string
  /** Latest send result. Mirror of `history[history.length - 1].response`
   *  kept for backwards compatibility with existing rows. */
  lastResponse: RepeaterResponse | null
  /** Send-by-send history, newest at the end. */
  history: RepeaterSnapshot[]
  settings: RepeaterTabSettings
  createdAt: string
  updatedAt: string
}

export type FridaState = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface FridaStatus {
  state: FridaState
  deviceId: string | null
  serverVersion: string | null
  errorMessage?: string
}

export interface FridaProcess {
  pid: number
  name: string
  identifier: string | null
}

export interface FridaScript {
  id: string
  name: string
  description: string
  source: string
  category: 'builtin' | 'user'
}

export type SecretSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export interface SecretFinding {
  patternId: string
  patternLabel: string
  severity: SecretSeverity
  /** The actual extracted secret value. */
  value: string
  /** The line of source where it was found (trimmed if very long). */
  context: string
  /** File or DEX/string-pool origin. */
  source: string
  line: number
}

export interface EndpointFinding {
  url: string
  scheme: string
  host: string
  port: number | null
  path: string
  /** True when scheme is HTTP (cleartext). */
  insecure: boolean
  occurrences: { source: string; line: number }[]
}

export interface SecurityFinding {
  /** Stable id, e.g. `cleartext-true`. */
  id: string
  title: string
  severity: SecretSeverity
  detail: string
  /** One-line, actionable. */
  remediation: string
}

export interface TrackerFinding {
  id: string
  name: string
  category:
    | 'analytics'
    | 'crash-reporting'
    | 'ads'
    | 'attribution'
    | 'push'
    | 'sdk'
    | 'cloud'
    | 'payment'
    | 'support'
    | 'session-replay'
    | 'monitoring'
  url: string | null
}

export interface ApkComponentSummary {
  name: string
  exported: boolean
  exportedExplicit: boolean
  permission: string | null
  /** Action names flattened across intent filters — useful at a glance. */
  actions: string[]
  /** `scheme://host/path` shaped deep-link patterns this component matches. */
  deepLinks: string[]
  /** Provider-only: comma-separated authority list. */
  authorities: string | null
}

export interface ApkNativeLib {
  abi: string
  files: {
    name: string
    size: number
    sha256?: string
    riskTags?: string[]
    symbols?: string[]
  }[]
}

export interface ApkDeepLink {
  component: string
  scheme: string
  host: string | null
  path: string | null
  example: string
}

export interface ApkBundleInfo {
  format: 'apk' | 'xapk' | 'apks' | 'apkm'
  analyzedEntry: string | null
  splitCount: number
}

export interface ApkFileInventoryEntry {
  path: string
  category: string
  size: number
  compressedSize: number
}

export interface ApkFileInventoryCategory {
  id: string
  label: string
  count: number
  size: number
  compressedSize: number
}

export interface ApkFileInventory {
  totalEntries: number
  totalUncompressedBytes: number
  totalCompressedBytes: number
  compressionRatio: number
  categories: ApkFileInventoryCategory[]
  largestFiles: ApkFileInventoryEntry[]
}

export interface ApkNetworkSecurityDomain {
  domain: string
  includeSubdomains: boolean
  cleartextTrafficPermitted: boolean | null
  trustAnchors: string[]
  pinSet: {
    expiration: string | null
    pins: { digest: string; value: string }[]
  } | null
}

export interface ApkNetworkSecuritySummary {
  present: boolean
  source: string | null
  baseCleartextTrafficPermitted: boolean | null
  trustsUserCertificates: boolean
  certificatePinning: boolean
  debugOverrides: string[]
  domains: ApkNetworkSecurityDomain[]
  findings: SecurityFinding[]
}

export interface ApkTechnologyFinding {
  id: string
  name: string
  category:
    | 'framework'
    | 'networking'
    | 'storage'
    | 'crypto'
    | 'identity'
    | 'payments'
    | 'ui'
    | 'cloud'
    | 'anti-tamper'
    | 'obfuscation'
    | 'build'
    | 'sdk'
  confidence: 'high' | 'medium' | 'low'
  evidence: string[]
  note: string | null
  risk: SecretSeverity | null
}

export interface ApkAttackSurfaceItem {
  id: string
  type: 'activity' | 'service' | 'receiver' | 'provider' | 'deep-link'
  name: string
  severity: SecretSeverity
  exported: boolean
  permission: string | null
  reason: string
  actions: string[]
  deepLinks: string[]
  authorities: string | null
  testCommand: string | null
}

export interface ApkPrivacySignal {
  id: string
  label: string
  severity: SecretSeverity
  detail: string
  evidence: string[]
}

export interface ApkHardeningSummary {
  score: number
  obfuscated: boolean
  rootDetection: boolean
  playIntegrity: boolean
  certificatePinning: boolean
  antiTamper: boolean
  debugSafe: boolean
  backupSafe: boolean
  cleartextSafe: boolean
  nativeCode: boolean
  notes: string[]
}

export interface ApkRiskBreakdownItem {
  label: string
  score: number
  count: number
  severity: SecretSeverity
}

/**
 * Complete payload returned by `apk.analyze`. The renderer renders
 * exactly this — every tab reads off a different field.
 */
export interface ApkAnalysisSummary {
  /** SHA-256 of the APK file — used as a cache key. */
  apkSha256: string
  /** Absolute path on disk. */
  filePath: string
  size: number
  bundle: ApkBundleInfo
  packageName: string
  versionName: string
  versionCode: number
  minSdk: number
  targetSdk: number
  maxSdk: number | null
  application: {
    label: string | null
    debuggable: boolean
    allowBackup: boolean
    usesCleartextTraffic: boolean | null
    networkSecurityConfigRef: string | null
    testOnly: boolean
  }
  permissions: string[]
  declaredPermissions: { name: string; protectionLevel: string | null }[]
  components: {
    activities: ApkComponentSummary[]
    services: ApkComponentSummary[]
    receivers: ApkComponentSummary[]
    providers: ApkComponentSummary[]
  }
  deepLinks: ApkDeepLink[]
  attackSurface: ApkAttackSurfaceItem[]
  signingCertificates: ApkCertificate[]
  nativeLibraries: ApkNativeLib[]
  fileInventory: ApkFileInventory
  networkSecurity: ApkNetworkSecuritySummary
  technologies: ApkTechnologyFinding[]
  privacySignals: ApkPrivacySignal[]
  hardening: ApkHardeningSummary
  /** Total DEX class definitions (sum across multidex). */
  dexClassCount: number
  /** Per-DEX-file summary. */
  dexFiles: { name: string; classCount: number; version: string }[]
  /** Estimated obfuscation ratio in `[0, 1]`. */
  obfuscation: { ratio: number; totalClasses: number; shortClasses: number }
  secrets: SecretFinding[]
  endpoints: EndpointFinding[]
  securityFindings: SecurityFinding[]
  trackers: TrackerFinding[]
  /** Strings table sample (capped) for the Strings tab. */
  stringsSample: string[]
  /** Pretty-printed AndroidManifest.xml. */
  manifestXml: string
  /** 0–100 — heavier severity findings count more. */
  riskScore: number
  riskBreakdown: ApkRiskBreakdownItem[]
  /** Plain-English verdict derived from the score + counts. */
  verdict: 'clean' | 'low-risk' | 'concerning' | 'risky' | 'critical'
  /** Wall-clock the analysis completed at (ISO). */
  analyzedAt: string
}

export interface ApkCertificate {
  subject: string
  issuer: string
  serialNumber: string
  validFrom: string
  validTo: string
  sha256: string
}

export interface JadxStatus {
  installed: boolean
  binaryPath: string | null
  version: string | null
  outputRoot: string
  errorMessage?: string
}

export type JadxProgressPhase =
  | 'preparing'
  | 'loading'
  | 'processing'
  | 'scanning'
  | 'done'
  | 'error'

export interface JadxProgress {
  projectId: string | null
  inputPath: string
  outputDir: string | null
  phase: JadxProgressPhase
  percent: number
  message: string
  detail?: string
}

export interface JadxDecompileOptions {
  inputPath: string
  clean: boolean
  deobfuscate: boolean
  showBadCode: boolean
  noResources: boolean
  exportGradle: boolean
  mode: 'auto' | 'restructure' | 'simple' | 'fallback'
  threads: number
}

export interface JadxFileEntry {
  path: string
  name: string
  kind: 'file' | 'directory'
  size: number
  language: string
  children?: JadxFileEntry[]
}

export interface JadxCodeFinding {
  id: string
  ruleId: string
  title: string
  severity: SecretSeverity
  file: string
  line: number
  snippet: string
  detail: string
}

export interface JadxSearchResult {
  file: string
  line: number
  column: number
  preview: string
}

export interface JadxReadFileResult {
  path: string
  content: string
  size: number
  bytesRead: number
  truncated: boolean
  binary: boolean
}

export interface JadxEntryPoint {
  type: 'activity' | 'service' | 'receiver' | 'provider'
  component: string
  file: string | null
  exported: boolean
  permission: string | null
}

export interface JadxProjectSummary {
  id: string
  inputPath: string
  outputDir: string
  packageName: string | null
  appLabel: string | null
  decompiledAt: string
  durationMs: number
  jadxVersion: string | null
  exitCode: number | null
  completedWithErrors: boolean
  fileCount: number
  sourceFileCount: number
  resourceFileCount: number
  manifestFile: string | null
  topPackages: { name: string; count: number }[]
  entryPoints: JadxEntryPoint[]
  findings: JadxCodeFinding[]
  secrets: SecretFinding[]
  endpoints: EndpointFinding[]
  stdout: string
  stderr: string
}

export type LogLevel = 'V' | 'D' | 'I' | 'W' | 'E' | 'F'

export interface LogcatLine {
  /** Monotonic, service-assigned — stable React key + strict ordering. */
  seq: number
  timestamp: number
  level: LogLevel
  pid: number
  tid: number
  tag: string
  message: string
}

/** Android logcat ring buffers selectable at capture time. */
export type LogcatBuffer = 'main' | 'system' | 'crash' | 'events' | 'radio' | 'kernel'

/** Capture options applied device-side when (re)starting the stream. */
export interface LogcatOptions {
  /** Buffers to read, e.g. ['main','system','crash']. */
  buffers: LogcatBuffer[]
  /** Device-side minimum level (`*:<level>`) to cut volume at the source. */
  minLevel: LogLevel
  /** Scope to a single process via `--pid`; null = all processes. */
  pid: number | null
  /** Initial backlog to fetch with `-T <n>`. */
  tail: number
}

export interface LogcatStatus {
  running: boolean
  serial: string | null
  buffers: LogcatBuffer[]
  minLevel: LogLevel
  pid: number | null
  errorMessage?: string
}

export interface ToolInstallProgress {
  toolId: string
  toolLabel: string
  phase: 'queued' | 'downloading' | 'extracting' | 'verifying' | 'done' | 'error'
  bytesReceived: number
  bytesTotal: number
  message: string
}

export interface CaInstallResult {
  state:
    | 'installed'
    | 'already-installed'
    | 'skipped'
    | 'error'
    /**
     * Non-rooted device — we pushed the cert and launched the system
     * installer activity, but the user has to tap through it themselves.
     * The renderer surfaces the `guidance` blurb when this state arrives.
     */
    | 'user-action-required'
  message: string
  /** Multi-line explanation shown in the UI under the toast. */
  guidance?: string
  /** Where the cert was pushed on the device, when relevant. */
  certPathOnDevice?: string
  /**
   * Which install path was taken, so the UI can label the resulting
   * banner ("System store", "Magisk module", "User store").
   */
  path?: 'system-store' | 'magisk-module' | 'user-store'
}

/**
 * How a device is talking to adb. `emulator` is the embedded Android
 * emulator we manage; `usb` is a real device on a wire; `wifi` is a real
 * device that was paired/connected over TCP/IP (either via our wizard or
 * by the user running `adb connect` themselves).
 */
export type DeviceTransport = 'emulator' | 'usb' | 'wifi'

export type DeviceState = 'online' | 'offline' | 'unauthorized'

export type RootMethod = 'adb-root' | 'magisk' | 'su' | null

/**
 * What this device can do. Computed by `deviceService.probeCapabilities`
 * once per `Device` and refreshed when the device flips between online/
 * offline. The renderer turns this into a capability matrix the user can
 * inspect before they pick a target.
 */
export interface DeviceCapabilities {
  /** A working `su` or `adb root` path exists. */
  rooted: boolean
  rootMethod: RootMethod
  /** Magisk binary (or `/data/adb/magisk/`) detected on device. */
  magiskInstalled: boolean
  /** `adb shell setprop ro.debuggable 1` works (i.e. userdebug build). */
  userdebugBuild: boolean
  /** True iff frida-server can be pushed and started — needs root. */
  canRunFridaServer: boolean
  /** True iff CA cert can land in the system trust store. */
  canInstallSystemCa: boolean
  /** True iff we can persist the CA via a Magisk module (rooted + Magisk). */
  canInstallMagiskCa: boolean
  /**
   * True for every adb-online device — the system credentials installer
   * works on any Android. Apps only honour the user store when their
   * Network Security Config explicitly opts in, so we surface a warning.
   */
  canInstallUserCa: boolean
  /** Mirror + control via scrcpy — works on any device with USB debugging. */
  canMirror: boolean
  /** Logcat — works on any adb device. */
  canLogcat: boolean
  /** Free-form blockers the UI should explain, e.g. "Frida needs root". */
  warnings: string[]
}

export interface Device {
  /** Stable identifier for `adb -s <serial>`. */
  serial: string
  transport: DeviceTransport
  state: DeviceState
  /** Human-readable name we render in the picker — falls back to serial. */
  label: string
  model: string | null
  manufacturer: string | null
  brand: string | null
  product: string | null
  /** e.g. "14" — what the user thinks of as the OS version. */
  androidVersion: string | null
  /** e.g. 34. Useful for "this feature needs API 30+" gating. */
  sdkLevel: number | null
  /** Primary ABI, e.g. "arm64-v8a", "x86_64". Drives Frida server pick. */
  abi: string | null
  capabilities: DeviceCapabilities
  /** Wall-clock when the metadata was last refreshed. */
  lastSeenAt: number
}

export interface DeviceList {
  devices: Device[]
  activeSerial: string | null
}

export type RootTargetKind = 'emulator' | 'real-device' | 'unknown'

export type RootWorkflowKind = 'already-rooted' | 'adb-root' | 'magisk-real-device'

export type RootWorkflowStepState = 'ready' | 'manual' | 'guarded' | 'done'

export interface RootWorkflowStep {
  id: string
  title: string
  body: string
  state: RootWorkflowStepState
}

export interface RootWorkflow {
  kind: RootWorkflowKind
  title: string
  summary: string
  steps: RootWorkflowStep[]
  warnings: string[]
}

export interface RootToolResult {
  serial: string
  label: string
  targetKind: RootTargetKind
  rooted: boolean
  rootMethod: RootMethod
  userdebugBuild: boolean
  magiskInstalled: boolean
  canRunFridaServer: boolean
  adbRootAttempted: boolean
  adbRootSucceeded: boolean
  message: string
  details: string[]
  nextSteps: string[]
  workflow: RootWorkflow
}

export type RootRebootMode = 'recovery' | 'bootloader' | 'system'

export type MagiskFlashPartition = 'boot' | 'init_boot' | 'recovery'

export interface MagiskFlashOptions {
  imagePath: string
  partition: MagiskFlashPartition
  confirmed: boolean
}

export type MagiskPatchedImageSource = 'host' | 'device'

export interface MagiskPatchedImageCandidate {
  source: MagiskPatchedImageSource
  path: string
  displayPath: string
  filename: string
  sizeBytes: number
  modifiedAt: number
  pulledFromDevice: boolean
}

export interface MagiskPatchedImageSearchResult {
  candidates: MagiskPatchedImageCandidate[]
  selected: MagiskPatchedImageCandidate | null
  message: string
  details: string[]
}

export interface MagiskRootStartOptions {
  imagePath?: string
  partition: MagiskFlashPartition
  confirmed: boolean
  rebootAfterFlash: boolean
}

export interface RootActionResult {
  message: string
  details: string[]
  fastbootDevices?: string[]
  patchedImage?: MagiskPatchedImageCandidate
  partition?: MagiskFlashPartition
}

export interface FirmwareCandidate {
  provider: 'google-pixel' | 'manual-url'
  deviceCodename: string
  buildId: string
  filename: string
  url: string
  exactBuildMatch: boolean
  sourcePage: string
}

export interface FirmwareSearchResult {
  provider: 'google-pixel' | 'manual-url' | 'unsupported'
  deviceCodename: string | null
  buildId: string | null
  recommendedPartition: MagiskFlashPartition
  candidates: FirmwareCandidate[]
  message: string
  warnings: string[]
  sourcePage?: string
}

export interface FirmwareExtractedImage {
  partition: MagiskFlashPartition
  path: string
  filename: string
  sizeBytes: number
}

export interface FirmwareDownloadOptions {
  url?: string
  acceptedTerms: boolean
  pushToDevice: boolean
}

export interface FirmwareDownloadResult {
  candidate: FirmwareCandidate
  downloadPath: string
  workDir: string
  extractedImages: FirmwareExtractedImage[]
  recommendedPartition: MagiskFlashPartition
  recommendedImagePath: string | null
  pushedToDevicePath: string | null
  magiskLaunched: boolean
  message: string
  details: string[]
}

/**
 * Steps a user walks through when adding a wireless device. Surfaced via
 * the `device:wirelessConnect` IPC progress channel so the renderer can
 * show a live status line.
 */
export type EmulatorVendor = 'ldplayer' | 'bluestacks' | 'nox' | 'memu' | 'genymotion'

/**
 * An emulator that's installed on the host machine but isn't the
 * Android Studio AVD we manage directly. We detect these by walking
 * vendor-specific install paths; once detected, they're "connectable"
 * via `adb connect host:port` rather than launched as our own
 * subprocess.
 */
export interface EmulatorInstall {
  /** Stable id: `${vendor}:${normalised path}`. */
  id: string
  vendor: EmulatorVendor
  /** Display name shown in the UI ("LDPlayer 9", "BlueStacks 5"). */
  name: string
  installPath: string
  launcherPath: string | null
  /** CLI helper if the vendor ships one (e.g. LDPlayer's ldconsole.exe). */
  consolePath: string | null
  /** Default adb host (almost always 127.0.0.1). */
  defaultHost: string
  /** Vendor-specific list of ports its first few instances bind to. */
  defaultPorts: number[]
  /** Per-instance enumeration when the vendor's CLI supports it. */
  instances: EmulatorInstanceInfo[]
}

export interface EmulatorInstanceInfo {
  index: number
  name: string
  running: boolean
  /** host:port form ready for `adb connect`. */
  adbTarget: string
}

export type WirelessConnectPhase =
  | 'enabling-tcpip'
  | 'discovering-ip'
  | 'pairing'
  | 'connecting'
  | 'verifying'
  | 'done'
  | 'error'

export interface WirelessConnectProgress {
  phase: WirelessConnectPhase
  message: string
  serial?: string
  errorMessage?: string
}

export interface WirelessPairResult {
  paired: boolean
  serial: string | null
}

export type ToolStatusState =
  | 'not-installed'
  | 'queued'
  | 'downloading'
  | 'extracting'
  | 'installed'
  | 'error'
  | 'unavailable'

export interface ToolInfo {
  id: string
  label: string
  description: string
  state: ToolStatusState
  version: string | null
  /** Path the binary resolves to once installed. */
  installPath: string | null
  /** Where this tool came from (download URL or env var). */
  source: string
  required: boolean
  /** Bytes received/total from the most recent install attempt. */
  progress: { received: number; total: number } | null
  errorMessage?: string
}

export interface AndroidSdk {
  /** Resolved path to the Android SDK root. */
  root: string
  /** How we resolved it: ANDROID_HOME, ANDROID_SDK_ROOT, or our bundled tools dir. */
  source: 'ANDROID_HOME' | 'ANDROID_SDK_ROOT' | 'bundled' | 'unknown'
  hasPlatformTools: boolean
  hasEmulator: boolean
  hasAvdManager: boolean
  systemImages: string[]
}

export interface AvdInfo {
  name: string
  device: string | null
  target: string | null
  systemImage: string | null
  path: string | null
}

export type MirrorState = 'idle' | 'connecting' | 'running' | 'stopping' | 'error'

export interface MirrorStatus {
  state: MirrorState
  width: number | null
  height: number | null
  errorMessage?: string
}

/** Video parameters announced by scrcpy-server before the first frame. */
export interface MirrorVideoInit {
  /** WebCodecs codec string, e.g. `avc1.640028`. */
  codec: string
  width: number
  height: number
}

/** One encoded video frame ready to feed into a WebCodecs VideoDecoder. */
export interface MirrorVideoPacket {
  /** Microseconds since the stream started. */
  pts: number
  keyframe: boolean
  /** Raw H.264 (Annex B) bytes for this access unit. */
  data: Uint8Array
}

export interface MirrorTouchEvent {
  /** 0 = down, 1 = up, 2 = move. */
  action: 0 | 1 | 2
  /** Pointer id — 0 for primary mouse, increment for multi-touch. */
  pointerId: number
  /** 0..1 normalized to the displayed video dimensions. */
  x: number
  y: number
  /** 0..1, where 1 means full pressure. */
  pressure: number
}

export type SdkSetupPhase =
  | 'idle'
  | 'downloading-cmdline-tools'
  | 'accepting-licenses'
  | 'installing-platform-tools'
  | 'installing-emulator'
  | 'installing-platform'
  | 'installing-system-image'
  | 'creating-avd'
  | 'configuring-avd'
  | 'done'
  | 'error'

export interface SdkSetupProgress {
  phase: SdkSetupPhase
  /** 0-100, overall completion across the whole setup. */
  overallPercent: number
  /** 0-100, completion of the current step. */
  stepPercent: number
  message: string
  errorMessage?: string
}

export interface SdkSetupOptions {
  apiLevel: number
  variant: 'google_apis' | 'google_apis_playstore'
  abi: 'x86_64' | 'arm64-v8a'
  deviceProfile: string
  avdName: string
  ramMb: number
  diskGb: number
}

export const DEFAULT_SDK_SETUP: SdkSetupOptions = {
  apiLevel: 33,
  variant: 'google_apis',
  abi: 'x86_64',
  deviceProfile: 'pixel_5',
  avdName: 'MobSec_Pixel5_API33',
  ramMb: 2048,
  diskGb: 6
}

export interface DialogOptions {
  title?: string
  defaultPath?: string
  filters?: { name: string; extensions: string[] }[]
  properties?: ('openFile' | 'openDirectory' | 'multiSelections')[]
}

/**
 * A discriminated result envelope for IPC calls. Main process should never
 * throw across the IPC boundary — instead resolve with `{ ok: false, error }`.
 */
export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: string }
