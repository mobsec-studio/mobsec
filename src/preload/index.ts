import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IPC, IPC_EVENT } from '@shared/ipc-channels'
import type { MobsecApi } from '@shared/api'
import type { FridaEvent } from '@shared/frida-intel'
import type {
  AppInfo,
  CaInstallResult,
  CapturedRequest,
  DeviceList,
  EmulatorBootProgress,
  EmulatorStatus,
  FridaStatus,
  JadxProgress,
  LogcatLine,
  LogcatStatus,
  MirrorStatus,
  MirrorVideoInit,
  MirrorVideoPacket,
  ProjectSummary,
  ProxyStatus,
  SdkSetupProgress,
  ToolInstallProgress,
  WirelessConnectProgress
} from '@shared/types'

/**
 * Renderer-facing API surface. The renderer must NEVER call ipcRenderer.invoke
 * directly — every channel is wrapped here so the API stays minimal, typed,
 * and auditable.
 */

function subscribe<T>(channel: string, handler: (payload: T) => void): () => void {
  const listener = (_event: unknown, payload: T): void => handler(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.off(channel, listener)
}

const api: MobsecApi = {
  app: {
    getInfo: () => ipcRenderer.invoke(IPC.app.getInfo) as Promise<AppInfo>,
    openExternal: (url) => ipcRenderer.invoke(IPC.app.openExternal, url),
    minimizeWindow: () => ipcRenderer.invoke(IPC.app.minimizeWindow),
    maximizeWindow: () => ipcRenderer.invoke(IPC.app.maximizeWindow),
    closeWindow: () => ipcRenderer.invoke(IPC.app.closeWindow),
    isMaximized: () => ipcRenderer.invoke(IPC.app.isMaximized) as Promise<boolean>,
    quit: () => ipcRenderer.invoke(IPC.app.quit),
    getFilePath: (file: File) => webUtils.getPathForFile(file),
    confirmClose: (action, dontAskAgain) =>
      ipcRenderer.invoke(IPC.app.confirmClose, action, dontAskAgain)
  },
  db: {
    listProjects: () => ipcRenderer.invoke(IPC.db.listProjects),
    createProject: (name) => ipcRenderer.invoke(IPC.db.createProject, name),
    deleteProject: (id) => ipcRenderer.invoke(IPC.db.deleteProject, id),
    renameProject: (id, name) => ipcRenderer.invoke(IPC.db.renameProject, id, name),
    getActiveProject: () => ipcRenderer.invoke(IPC.db.getActiveProject),
    setActiveProject: (id) => ipcRenderer.invoke(IPC.db.setActiveProject, id),
    listSettings: () => ipcRenderer.invoke(IPC.db.listSettings),
    getSetting: (key) => ipcRenderer.invoke(IPC.db.getSetting, key),
    setSetting: (key, value) => ipcRenderer.invoke(IPC.db.setSetting, key, value),
    getProjectSummary: (projectId) =>
      ipcRenderer.invoke(IPC.db.getProjectSummary, projectId ?? null),
    wipeSession: (projectId) => ipcRenderer.invoke(IPC.db.wipeSession, projectId ?? null)
  },
  emulatorInstalls: {
    list: () => ipcRenderer.invoke(IPC.emulatorInstalls.list),
    refresh: () => ipcRenderer.invoke(IPC.emulatorInstalls.refresh),
    launch: (id) => ipcRenderer.invoke(IPC.emulatorInstalls.launch, id),
    connectAll: (id) => ipcRenderer.invoke(IPC.emulatorInstalls.connectAll, id)
  },
  device: {
    list: () => ipcRenderer.invoke(IPC.device.list),
    getActive: () => ipcRenderer.invoke(IPC.device.getActive),
    setActive: (serial) => ipcRenderer.invoke(IPC.device.setActive, serial),
    refresh: () => ipcRenderer.invoke(IPC.device.refresh),
    enableTcpip: (serial, port) => ipcRenderer.invoke(IPC.device.enableTcpip, serial, port),
    connect: (target) => ipcRenderer.invoke(IPC.device.connect, target),
    disconnect: (serial) => ipcRenderer.invoke(IPC.device.disconnect, serial),
    sendKey: (key) => ipcRenderer.invoke(IPC.device.sendKey, key),
    wirelessConnect: (opts) => ipcRenderer.invoke(IPC.device.wirelessConnect, opts),
    pairWireless: (opts) => ipcRenderer.invoke(IPC.device.pairWireless, opts)
  },
  otherTools: {
    rootCheck: () => ipcRenderer.invoke(IPC.otherTools.rootCheck),
    tryAdbRoot: () => ipcRenderer.invoke(IPC.otherTools.tryAdbRoot),
    rebootForRoot: (mode) => ipcRenderer.invoke(IPC.otherTools.rebootForRoot, mode),
    listFastbootDevices: () => ipcRenderer.invoke(IPC.otherTools.listFastbootDevices),
    flashMagiskPatchedImage: (options) =>
      ipcRenderer.invoke(IPC.otherTools.flashMagiskPatchedImage, options),
    detectMagiskPatchedImages: () => ipcRenderer.invoke(IPC.otherTools.detectMagiskPatchedImages),
    startMagiskRoot: (options) => ipcRenderer.invoke(IPC.otherTools.startMagiskRoot, options),
    findFirmwareImages: () => ipcRenderer.invoke(IPC.otherTools.findFirmwareImages),
    downloadFirmwareImage: (options) =>
      ipcRenderer.invoke(IPC.otherTools.downloadFirmwareImage, options)
  },
  emulator: {
    getStatus: () => ipcRenderer.invoke(IPC.emulator.getStatus) as Promise<EmulatorStatus>,
    start: () => ipcRenderer.invoke(IPC.emulator.start),
    stop: () => ipcRenderer.invoke(IPC.emulator.stop),
    restart: () => ipcRenderer.invoke(IPC.emulator.restart),
    sendKey: (key) => ipcRenderer.invoke(IPC.emulator.sendKey, key),
    installApk: (path) => ipcRenderer.invoke(IPC.emulator.installApk, path),
    listInstalledApps: () => ipcRenderer.invoke(IPC.emulator.listInstalledApps),
    launchApp: (pkg) => ipcRenderer.invoke(IPC.emulator.launchApp, pkg),
    listAvds: () => ipcRenderer.invoke(IPC.emulator.listAvds),
    selectAvd: (name) => ipcRenderer.invoke(IPC.emulator.selectAvd, name),
    getSelectedAvd: () => ipcRenderer.invoke(IPC.emulator.getSelectedAvd),
    detectSdk: () => ipcRenderer.invoke(IPC.emulator.detectSdk)
  },
  toolchain: {
    list: () => ipcRenderer.invoke(IPC.toolchain.list),
    install: (toolId) => ipcRenderer.invoke(IPC.toolchain.install, toolId),
    cancel: (toolId) => ipcRenderer.invoke(IPC.toolchain.cancel, toolId),
    revealInstallDir: () => ipcRenderer.invoke(IPC.toolchain.revealInstallDir)
  },
  sdk: {
    runFullSetup: (options) => ipcRenderer.invoke(IPC.sdk.runFullSetup, options),
    getProgress: () => ipcRenderer.invoke(IPC.sdk.getProgress) as Promise<SdkSetupProgress>,
    cancelSetup: () => ipcRenderer.invoke(IPC.sdk.cancelSetup),
    createAvd: (options) => ipcRenderer.invoke(IPC.sdk.createAvd, options),
    deleteAvd: (name) => ipcRenderer.invoke(IPC.sdk.deleteAvd, name),
    listSystemImages: () => ipcRenderer.invoke(IPC.sdk.listSystemImages)
  },
  mirror: {
    getStatus: () => ipcRenderer.invoke(IPC.mirror.getStatus) as Promise<MirrorStatus>,
    start: () => ipcRenderer.invoke(IPC.mirror.start),
    stop: () => ipcRenderer.invoke(IPC.mirror.stop),
    sendTouch: (event) => ipcRenderer.invoke(IPC.mirror.sendTouch, event),
    sendKey: (keycode, action) => ipcRenderer.invoke(IPC.mirror.sendKey, keycode, action)
  },
  proxy: {
    getStatus: () => ipcRenderer.invoke(IPC.proxy.getStatus) as Promise<ProxyStatus>,
    start: () => ipcRenderer.invoke(IPC.proxy.start),
    stop: () => ipcRenderer.invoke(IPC.proxy.stop),
    listRequests: (opts) => ipcRenderer.invoke(IPC.proxy.listRequests, opts),
    getRequest: (id) => ipcRenderer.invoke(IPC.proxy.getRequest, id),
    clearRequests: () => ipcRenderer.invoke(IPC.proxy.clearRequests),
    exportHar: (path) => ipcRenderer.invoke(IPC.proxy.exportHar, path),
    reinstallCa: () => ipcRenderer.invoke(IPC.proxy.reinstallCa),
    getCaInstallResult: () => ipcRenderer.invoke(IPC.proxy.getCaInstallResult)
  },
  repeater: {
    listTabs: () => ipcRenderer.invoke(IPC.repeater.listTabs),
    createTab: (fromRequestId) => ipcRenderer.invoke(IPC.repeater.createTab, fromRequestId),
    updateTab: (tab) => ipcRenderer.invoke(IPC.repeater.updateTab, tab),
    deleteTab: (id) => ipcRenderer.invoke(IPC.repeater.deleteTab, id),
    send: (tab) => ipcRenderer.invoke(IPC.repeater.send, tab),
    saveBody: (filePath, content) => ipcRenderer.invoke(IPC.repeater.saveBody, filePath, content)
  },
  frida: {
    getStatus: () => ipcRenderer.invoke(IPC.frida.getStatus) as Promise<FridaStatus>,
    listProcesses: () => ipcRenderer.invoke(IPC.frida.listProcesses),
    attach: (pid, src) => ipcRenderer.invoke(IPC.frida.attach, pid, src),
    spawn: (id, src) => ipcRenderer.invoke(IPC.frida.spawn, id, src),
    launchAndAttach: (id, src) => ipcRenderer.invoke(IPC.frida.launchAndAttach, id, src),
    reconnaissance: (opts) => ipcRenderer.invoke(IPC.frida.reconnaissance, opts),
    autoPwn: (opts) => ipcRenderer.invoke(IPC.frida.autoPwn, opts),
    applyStrategies: (sessionId, ids) =>
      ipcRenderer.invoke(IPC.frida.applyStrategies, sessionId, ids),
    listStrategies: (sessionId) => ipcRenderer.invoke(IPC.frida.listStrategies, sessionId),
    listTracers: (sessionId) => ipcRenderer.invoke(IPC.frida.listTracers, sessionId),
    startTracer: (sessionId, id) => ipcRenderer.invoke(IPC.frida.startTracer, sessionId, id),
    stopTracer: (sessionId, id) => ipcRenderer.invoke(IPC.frida.stopTracer, sessionId, id),
    enumerateClasses: (sessionId, filter, limit) =>
      ipcRenderer.invoke(IPC.frida.enumerateClasses, sessionId, filter, limit),
    listMethods: (sessionId, className) =>
      ipcRenderer.invoke(IPC.frida.listMethods, sessionId, className),
    traceClass: (sessionId, className) =>
      ipcRenderer.invoke(IPC.frida.traceClass, sessionId, className),
    untraceClass: (sessionId, className) =>
      ipcRenderer.invoke(IPC.frida.untraceClass, sessionId, className),
    chooseInstances: (sessionId, className, limit) =>
      ipcRenderer.invoke(IPC.frida.chooseInstances, sessionId, className, limit),
    traceNative: (sessionId, moduleName, symbol) =>
      ipcRenderer.invoke(IPC.frida.traceNative, sessionId, moduleName, symbol),
    untraceNative: (sessionId, moduleName, symbol) =>
      ipcRenderer.invoke(IPC.frida.untraceNative, sessionId, moduleName, symbol),
    listActiveTraces: (sessionId) => ipcRenderer.invoke(IPC.frida.listActiveTraces, sessionId),
    listPresets: (packageName) => ipcRenderer.invoke(IPC.frida.listPresets, packageName),
    savePreset: (preset) => ipcRenderer.invoke(IPC.frida.savePreset, preset),
    deletePreset: (id) => ipcRenderer.invoke(IPC.frida.deletePreset, id),
    detach: (sessionId) => ipcRenderer.invoke(IPC.frida.detach, sessionId),
    loadScript: (sessionId, src) => ipcRenderer.invoke(IPC.frida.loadScript, sessionId, src),
    listBuiltinScripts: () => ipcRenderer.invoke(IPC.frida.listBuiltinScripts),
    installServer: () => ipcRenderer.invoke(IPC.frida.installServer),
    stopServer: () => ipcRenderer.invoke(IPC.frida.stopServer),
    listUserScripts: () => ipcRenderer.invoke(IPC.frida.listUserScripts),
    saveUserScript: (script) => ipcRenderer.invoke(IPC.frida.saveUserScript, script),
    deleteUserScript: (id) => ipcRenderer.invoke(IPC.frida.deleteUserScript, id),
    importScriptFiles: () => ipcRenderer.invoke(IPC.frida.importScriptFiles),
    importCodeshare: (handle) => ipcRenderer.invoke(IPC.frida.importCodeshare, handle),
    exportScript: (id) => ipcRenderer.invoke(IPC.frida.exportScript, id),
    evalCode: (sessionId, code) => ipcRenderer.invoke(IPC.frida.evalCode, sessionId, code)
  },
  apk: {
    analyze: (path) => ipcRenderer.invoke(IPC.apk.analyze, path),
    getManifest: (path) => ipcRenderer.invoke(IPC.apk.getManifest, path),
    decompile: (path) => ipcRenderer.invoke(IPC.apk.decompile, path),
    searchSecrets: (path, patterns) => ipcRenderer.invoke(IPC.apk.searchSecrets, path, patterns),
    listStrings: (path) => ipcRenderer.invoke(IPC.apk.listStrings, path),
    listPatterns: () => ipcRenderer.invoke(IPC.apk.listPatterns),
    installOnActiveDevice: (path) => ipcRenderer.invoke(IPC.apk.installOnActiveDevice, path),
    spawnWithBypass: (path, scriptId) => ipcRenderer.invoke(IPC.apk.spawnWithBypass, path, scriptId)
  },
  jadx: {
    status: () => ipcRenderer.invoke(IPC.jadx.status),
    decompile: (options) => ipcRenderer.invoke(IPC.jadx.decompile, options),
    listTree: (projectId) => ipcRenderer.invoke(IPC.jadx.listTree, projectId),
    readFile: (projectId, path) => ipcRenderer.invoke(IPC.jadx.readFile, projectId, path),
    search: (projectId, query, limit) =>
      ipcRenderer.invoke(IPC.jadx.search, projectId, query, limit),
    revealOutput: (projectId) => ipcRenderer.invoke(IPC.jadx.revealOutput, projectId),
    deleteProject: (projectId) => ipcRenderer.invoke(IPC.jadx.deleteProject, projectId)
  },
  logcat: {
    start: (options) => ipcRenderer.invoke(IPC.logcat.start, options),
    stop: () => ipcRenderer.invoke(IPC.logcat.stop),
    clear: () => ipcRenderer.invoke(IPC.logcat.clear),
    getStatus: () => ipcRenderer.invoke(IPC.logcat.getStatus),
    resolvePid: (packageName) => ipcRenderer.invoke(IPC.logcat.resolvePid, packageName)
  },
  dialog: {
    showOpen: (opts) => ipcRenderer.invoke(IPC.dialog.showOpen, opts),
    showSave: (opts) => ipcRenderer.invoke(IPC.dialog.showSave, opts),
    showMessage: (message, detail) => ipcRenderer.invoke(IPC.dialog.showMessage, message, detail)
  },
  log: {
    write: (level, message, meta) => ipcRenderer.send(IPC.log.write, level, message, meta)
  },
  on: {
    onDeviceListChanged: (h) => subscribe<DeviceList>(IPC_EVENT.device.listChanged, h),
    onDeviceActiveChanged: (h) =>
      subscribe<{ serial: string | null }>(IPC_EVENT.device.activeChanged, h),
    onWirelessProgress: (h) =>
      subscribe<WirelessConnectProgress>(IPC_EVENT.device.wirelessProgress, h),
    onEmulatorStatus: (h) => subscribe<EmulatorStatus>(IPC_EVENT.emulator.statusChanged, h),
    onEmulatorBootProgress: (h) =>
      subscribe<EmulatorBootProgress>(IPC_EVENT.emulator.bootProgress, h),
    onProxyStatus: (h) => subscribe<ProxyStatus>(IPC_EVENT.proxy.statusChanged, h),
    onProxyRequest: (h) => subscribe<CapturedRequest>(IPC_EVENT.proxy.request, h),
    onProxyResponse: (h) => subscribe<CapturedRequest>(IPC_EVENT.proxy.response, h),
    onProxyCaInstall: (h) => subscribe<CaInstallResult>(IPC_EVENT.proxy.caInstall, h),
    onFridaStatus: (h) => subscribe<FridaStatus>(IPC_EVENT.frida.statusChanged, h),
    onFridaConsole: (h) =>
      subscribe<{ sessionId: string; level: string; text: string }>(
        IPC_EVENT.frida.consoleMessage,
        h
      ),
    onFridaEvent: (h) => subscribe<FridaEvent>(IPC_EVENT.frida.event, h),
    onLogcatLines: (h) => subscribe<LogcatLine[]>(IPC_EVENT.logcat.lines, h),
    onLogcatStatus: (h) => subscribe<LogcatStatus>(IPC_EVENT.logcat.status, h),
    onJadxProgress: (h) => subscribe<JadxProgress>(IPC_EVENT.jadx.progress, h),
    onToolInstallProgress: (h) => subscribe<ToolInstallProgress>(IPC_EVENT.toolInstall.progress, h),
    onSdkSetupProgress: (h) => subscribe<SdkSetupProgress>(IPC_EVENT.sdkSetup.progress, h),
    onMirrorStatus: (h) => subscribe<MirrorStatus>(IPC_EVENT.mirror.statusChanged, h),
    onMirrorVideoInit: (h) => subscribe<MirrorVideoInit>(IPC_EVENT.mirror.videoInit, h),
    onMirrorVideoPacket: (h) => subscribe<MirrorVideoPacket>(IPC_EVENT.mirror.videoPacket, h),
    onWindowMaximizedChanged: (h) => subscribe<boolean>(IPC_EVENT.window.maximizedChanged, h),
    onWindowCloseRequested: (h) => subscribe<ProjectSummary>(IPC_EVENT.window.closeRequested, h)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (err) {
    console.error('Failed to expose preload API', err)
  }
} else {
  const target = globalThis as unknown as { api: MobsecApi }
  target.api = api
}
