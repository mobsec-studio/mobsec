/**
 * Centralized IPC channel registry. Every renderer→main invoke and main→renderer
 * event uses one of the strings listed here. Treat as a wire-format contract:
 * never inline a channel string anywhere else in the codebase.
 */

export const IPC = {
  app: {
    getInfo: 'app:getInfo',
    openExternal: 'app:openExternal',
    minimizeWindow: 'app:minimizeWindow',
    maximizeWindow: 'app:maximizeWindow',
    closeWindow: 'app:closeWindow',
    isMaximized: 'app:isMaximized',
    quit: 'app:quit',
    /** Confirm-or-cancel response to a close-requested prompt. */
    confirmClose: 'app:confirmClose'
  },
  db: {
    listProjects: 'db:listProjects',
    createProject: 'db:createProject',
    deleteProject: 'db:deleteProject',
    renameProject: 'db:renameProject',
    getActiveProject: 'db:getActiveProject',
    setActiveProject: 'db:setActiveProject',
    listSettings: 'db:listSettings',
    getSetting: 'db:getSetting',
    setSetting: 'db:setSetting',
    /** Get summary of how much data is in a project (or active project if null). */
    getProjectSummary: 'db:getProjectSummary',
    /** Wipe captured requests + repeater tabs for a project. */
    wipeSession: 'db:wipeSession'
  },
  emulatorInstalls: {
    /** Detect installed third-party emulators (LDPlayer, BlueStacks…). */
    list: 'emulatorInstalls:list',
    /** Re-run detection on demand. */
    refresh: 'emulatorInstalls:refresh',
    /** Spawn a detected emulator's launcher. */
    launch: 'emulatorInstalls:launch',
    /** adb-connect every default port of one install. */
    connectAll: 'emulatorInstalls:connectAll'
  },
  device: {
    list: 'device:list',
    getActive: 'device:getActive',
    setActive: 'device:setActive',
    refresh: 'device:refresh',
    /** Promote a USB device to TCP/IP (`adb -s X tcpip 5555`). */
    enableTcpip: 'device:enableTcpip',
    /** `adb connect host:port` — for the older wireless-debugging flow. */
    connect: 'device:connect',
    /** `adb disconnect <serial>` — only valid for wifi-transport rows. */
    disconnect: 'device:disconnect',
    /** Send a hardware/navigation key to the active device. */
    sendKey: 'device:sendKey',
    /**
     * Higher-level wizard endpoint: takes a USB serial (or a host:port
     * for the modern pairing flow) and walks through tcpip + connect +
     * verify, streaming progress on `device:event:wirelessProgress`.
     */
    wirelessConnect: 'device:wirelessConnect',
    /** Android 11+ `adb pair host:port code`, optionally followed by connect. */
    pairWireless: 'device:pairWireless'
  },
  otherTools: {
    rootCheck: 'otherTools:rootCheck',
    tryAdbRoot: 'otherTools:tryAdbRoot',
    rebootForRoot: 'otherTools:rebootForRoot',
    listFastbootDevices: 'otherTools:listFastbootDevices',
    flashMagiskPatchedImage: 'otherTools:flashMagiskPatchedImage',
    detectMagiskPatchedImages: 'otherTools:detectMagiskPatchedImages',
    startMagiskRoot: 'otherTools:startMagiskRoot',
    findFirmwareImages: 'otherTools:findFirmwareImages',
    downloadFirmwareImage: 'otherTools:downloadFirmwareImage'
  },
  emulator: {
    getStatus: 'emulator:getStatus',
    start: 'emulator:start',
    stop: 'emulator:stop',
    restart: 'emulator:restart',
    sendKey: 'emulator:sendKey',
    installApk: 'emulator:installApk',
    listInstalledApps: 'emulator:listInstalledApps',
    launchApp: 'emulator:launchApp',
    listAvds: 'emulator:listAvds',
    selectAvd: 'emulator:selectAvd',
    getSelectedAvd: 'emulator:getSelectedAvd',
    detectSdk: 'emulator:detectSdk'
  },
  toolchain: {
    list: 'toolchain:list',
    install: 'toolchain:install',
    cancel: 'toolchain:cancel',
    revealInstallDir: 'toolchain:revealInstallDir'
  },
  sdk: {
    runFullSetup: 'sdk:runFullSetup',
    getProgress: 'sdk:getProgress',
    cancelSetup: 'sdk:cancelSetup',
    createAvd: 'sdk:createAvd',
    deleteAvd: 'sdk:deleteAvd',
    listSystemImages: 'sdk:listSystemImages'
  },
  mirror: {
    getStatus: 'mirror:getStatus',
    start: 'mirror:start',
    stop: 'mirror:stop',
    sendTouch: 'mirror:sendTouch',
    sendKey: 'mirror:sendKey'
  },
  proxy: {
    getStatus: 'proxy:getStatus',
    start: 'proxy:start',
    stop: 'proxy:stop',
    listRequests: 'proxy:listRequests',
    getRequest: 'proxy:getRequest',
    clearRequests: 'proxy:clearRequests',
    exportHar: 'proxy:exportHar',
    /**
     * Run `ensureCaInstalled(activeDevice)` on demand. Used by the renderer's
     * "Re-install CA" button to retrigger the install flow without bouncing
     * the proxy — useful when the user dismissed the system dialog by accident.
     */
    reinstallCa: 'proxy:reinstallCa',
    /** Read the most recent CA-install result so the wizard hydrates correctly. */
    getCaInstallResult: 'proxy:getCaInstallResult'
  },
  repeater: {
    listTabs: 'repeater:listTabs',
    createTab: 'repeater:createTab',
    updateTab: 'repeater:updateTab',
    deleteTab: 'repeater:deleteTab',
    send: 'repeater:send',
    saveBody: 'repeater:saveBody'
  },
  frida: {
    getStatus: 'frida:getStatus',
    listProcesses: 'frida:listProcesses',
    attach: 'frida:attach',
    spawn: 'frida:spawn',
    /** Launch the app normally, wait for ART, then attach to the live pid. */
    launchAndAttach: 'frida:launchAndAttach',
    /** Load the intelligence agent + run reconnaissance, return the report. */
    reconnaissance: 'frida:reconnaissance',
    /** One-click: profile + apply the full applicable bypass stack + verify. */
    autoPwn: 'frida:autoPwn',
    /** Apply specific strategies to an existing agent session. */
    applyStrategies: 'frida:applyStrategies',
    /** Enumerate available strategies + applicability for a session. */
    listStrategies: 'frida:listStrategies',
    /** Live monitors + discovery on an existing agent session. */
    listTracers: 'frida:listTracers',
    startTracer: 'frida:startTracer',
    stopTracer: 'frida:stopTracer',
    enumerateClasses: 'frida:enumerateClasses',
    listMethods: 'frida:listMethods',
    traceClass: 'frida:traceClass',
    untraceClass: 'frida:untraceClass',
    chooseInstances: 'frida:chooseInstances',
    traceNative: 'frida:traceNative',
    untraceNative: 'frida:untraceNative',
    listActiveTraces: 'frida:listActiveTraces',
    /** Saveable per-app instrumentation presets (bypass + monitor recipes). */
    listPresets: 'frida:listPresets',
    savePreset: 'frida:savePreset',
    deletePreset: 'frida:deletePreset',
    detach: 'frida:detach',
    loadScript: 'frida:loadScript',
    listBuiltinScripts: 'frida:listBuiltinScripts',
    installServer: 'frida:installServer',
    stopServer: 'frida:stopServer',
    listUserScripts: 'frida:listUserScripts',
    saveUserScript: 'frida:saveUserScript',
    deleteUserScript: 'frida:deleteUserScript',
    /** Open a multi-select .js dialog, import each into the user library. */
    importScriptFiles: 'frida:importScriptFiles',
    /** Pull a script from codeshare.frida.re by `user/project` handle. */
    importCodeshare: 'frida:importCodeshare',
    /** Write a script's source to a .js file via a save dialog. */
    exportScript: 'frida:exportScript',
    /** Evaluate a JS expression in an active session's Frida context and return the result. */
    evalCode: 'frida:evalCode'
  },
  apk: {
    analyze: 'apk:analyze',
    getManifest: 'apk:getManifest',
    decompile: 'apk:decompile',
    searchSecrets: 'apk:searchSecrets',
    listStrings: 'apk:listStrings',
    /** Return the built-in secret-pattern catalog so the renderer can show
     *  a "what we scan for" reference. Stable; no per-call side effects. */
    listPatterns: 'apk:listPatterns',
    /** `adb install` against the currently active device. Used by the
     *  one-click "Install on device" action from the analyzer overview. */
    installOnActiveDevice: 'apk:installOnActiveDevice',
    /** Install (if needed) then `frida spawn` the package and load a
     *  built-in script by id (default: ssl-pinning-bypass). */
    spawnWithBypass: 'apk:spawnWithBypass'
  },
  jadx: {
    status: 'jadx:status',
    decompile: 'jadx:decompile',
    listTree: 'jadx:listTree',
    readFile: 'jadx:readFile',
    search: 'jadx:search',
    revealOutput: 'jadx:revealOutput',
    deleteProject: 'jadx:deleteProject'
  },
  logcat: {
    start: 'logcat:start',
    stop: 'logcat:stop',
    clear: 'logcat:clear',
    getStatus: 'logcat:getStatus',
    /** Resolve a package name to its main pid for --pid scoping. */
    resolvePid: 'logcat:resolvePid'
  },
  dialog: {
    showOpen: 'dialog:showOpen',
    showSave: 'dialog:showSave',
    showMessage: 'dialog:showMessage'
  },
  log: {
    write: 'log:write'
  }
} as const

/** Channels used for main→renderer push events (sent via webContents.send). */
export const IPC_EVENT = {
  device: {
    listChanged: 'device:event:listChanged',
    activeChanged: 'device:event:activeChanged',
    wirelessProgress: 'device:event:wirelessProgress'
  },
  emulator: {
    statusChanged: 'emulator:event:statusChanged',
    bootProgress: 'emulator:event:bootProgress'
  },
  proxy: {
    statusChanged: 'proxy:event:statusChanged',
    request: 'proxy:event:request',
    response: 'proxy:event:response',
    caInstall: 'proxy:event:caInstall'
  },
  frida: {
    statusChanged: 'frida:event:statusChanged',
    consoleMessage: 'frida:event:consoleMessage',
    scriptError: 'frida:event:scriptError',
    event: 'frida:event:event'
  },
  logcat: {
    lines: 'logcat:event:lines',
    status: 'logcat:event:status'
  },
  jadx: {
    progress: 'jadx:event:progress'
  },
  toolInstall: {
    progress: 'toolInstall:event:progress',
    complete: 'toolInstall:event:complete',
    error: 'toolInstall:event:error'
  },
  sdkSetup: {
    progress: 'sdkSetup:event:progress'
  },
  mirror: {
    statusChanged: 'mirror:event:statusChanged',
    videoInit: 'mirror:event:videoInit',
    videoPacket: 'mirror:event:videoPacket'
  },
  window: {
    maximizedChanged: 'window:event:maximizedChanged',
    closeRequested: 'window:event:closeRequested'
  }
} as const

export type IpcChannel = typeof IPC
export type IpcEventChannel = typeof IPC_EVENT
