# MobSec Studio Architecture

This document describes the current MobSec Studio architecture, major features,
service boundaries, data flow, storage model, packaging model, and known gaps.
It is intended for maintainers and contributors.

## Product Scope

MobSec Studio is a local Android security testing workbench. It combines:

- Device and emulator management.
- Embedded Android screen mirroring.
- HTTP/HTTPS proxy capture.
- Request replay through Repeater.
- APK static analysis.
- JADX decompilation and source search.
- Frida runtime instrumentation.
- Live logcat capture.
- Project-scoped local persistence.
- Toolchain and SDK management.

The app is intentionally local-first. The main process owns filesystem,
database, network child processes, and external tooling. The renderer is a
browser-like UI surface that communicates only through a typed preload API.

## Process Model

MobSec Studio uses the standard Electron three-process pattern.

```text
Renderer process
  React, Tailwind, Zustand, Monaco
  No direct Node/Electron/filesystem access
  Calls window.api and subscribes to pushed events
        |
        | contextBridge
        v
Preload process
  Allow-listed wrappers around ipcRenderer.invoke and ipcRenderer.on
  No business logic
        |
        | ipcMain.handle / webContents.send
        v
Main process
  BrowserWindow lifecycle
  SQLite database
  Winston logging
  Tool/service orchestration
  Child processes: adb, emulator, scrcpy, mitmproxy, apktool, jadx, frida-server
```

### Main Process

Main-process entry:

- `src/main/index.ts`

Responsibilities:

- Create and manage the BrowserWindow.
- Initialize database, logging, paths, services, and IPC.
- Wire main-process events to renderer events.
- Own shutdown and cleanup for long-running child processes.
- Enforce all filesystem and child-process boundaries.

### Preload

Preload entry:

- `src/preload/index.ts`

Responsibilities:

- Expose `window.api`.
- Wrap all request/response IPC calls.
- Expose event subscription helpers that return unsubscribe functions.
- Keep the renderer free of direct Electron imports.

### Renderer

Renderer entry:

- `src/renderer/src/main.tsx`
- `src/renderer/src/App.tsx`

Responsibilities:

- Render the full user interface.
- Hydrate Zustand stores from main-process state.
- Subscribe to pushed events.
- Present project, device, proxy, repeater, APK, JADX, Frida, logcat, emulator,
  mirror, and settings surfaces.

## Shared Contract

The shared contract lives in:

- `src/shared/types.ts`
- `src/shared/api.ts`
- `src/shared/ipc-channels.ts`
- `src/shared/frida-intel.ts`

Rules:

1. IPC channel names are declared centrally in `ipc-channels.ts`.
2. `api.ts` describes the typed `window.api` surface.
3. `types.ts` contains dependency-free domain types.
4. Main IPC handlers return `IpcResult<T>` where appropriate.
5. Renderer code branches on `result.ok` instead of catching thrown IPC errors.

## Event Flow

The main process uses a typed event bus:

- `src/main/utils/event-bus.ts`

Services emit internal events such as:

- `device:listChanged`
- `device:activeChanged`
- `emulator:status`
- `proxy:status`
- `proxy:request`
- `proxy:response`
- `frida:status`
- `frida:console`
- `frida:event`
- `logcat:lines`
- `logcat:status`
- `jadx:progress`
- `toolInstall:progress`
- `mirror:status`

`wireToWindow()` mirrors these events to the renderer with `webContents.send`.
Renderer stores subscribe through `window.api.on.*`.

## Core Services

Each service owns one external concern. Services are singleton modules imported
only by IPC handlers or other main-process services.

| Service           | File                                     | Responsibility                                                                                                              |
| ----------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Database          | `src/main/services/database.ts`          | SQLite connection, migrations, project repo, settings repo, captured requests, repeater tabs, Frida scripts, Frida presets. |
| ADB               | `src/main/services/adb.ts`               | ADB discovery, shell/push/root helpers, quoting, package validation, command execution.                                     |
| Device            | `src/main/services/device.ts`            | Active-device model, device listing, USB/wireless connect, TCP/IP enablement, state refresh, key sends.                     |
| Emulator          | `src/main/services/emulator.ts`          | App-managed AVD start/stop/restart, installed apps, APK install, SDK detection.                                             |
| Emulator installs | `src/main/services/emulator-installs.ts` | Third-party emulator detection and launch/connect helpers.                                                                  |
| SDK setup         | `src/main/services/sdk-setup.ts`         | Android command-line tools, platform tools, system image, AVD setup flow.                                                   |
| Toolchain         | `src/main/services/toolchain.ts`         | Tool discovery, download, extraction, verification, install progress.                                                       |
| Mirror            | `src/main/services/mirror.ts`            | Mirror status and coordination.                                                                                             |
| scrcpy            | `src/main/services/scrcpy.ts`            | scrcpy subprocess and video/control bridge.                                                                                 |
| Proxy             | `src/main/services/proxy.ts`             | mitmproxy lifecycle and captured request/response ingestion.                                                                |
| CA install        | `src/main/services/ca-install.ts`        | CA generation/install workflow and trust-store guidance.                                                                    |
| Repeater          | `src/main/services/repeater.ts`          | Request replay, redirects, repeat count, response history.                                                                  |
| APK analyzer      | `src/main/services/apk-analyzer.ts`      | APK extraction, apktool/JADX assistance, static findings, summary assembly.                                                 |
| JADX              | `src/main/services/jadx.ts`              | Dedicated decompile projects, progress parsing, file tree, file read, search, reveal, delete.                               |
| Frida             | `src/main/services/frida.ts`             | frida-server lifecycle, process/app listing, attach/spawn/launch, scripts, agent, tracing, presets, REPL.                   |
| Logcat            | `src/main/services/logcat.ts`            | `adb logcat` lifecycle, parsing, line stream, status.                                                                       |

## Renderer Structure

Important renderer paths:

| Path                                           | Role                                                            |
| ---------------------------------------------- | --------------------------------------------------------------- |
| `src/renderer/src/App.tsx`                     | Main app composition, tool routing, global event subscriptions. |
| `src/renderer/src/components/TitleBar.tsx`     | Frameless title bar, project picker, window controls.           |
| `src/renderer/src/components/Sidebar.tsx`      | Tool navigation.                                                |
| `src/renderer/src/components/StatusBar.tsx`    | Device/emulator/proxy/Frida/logcat/app status.                  |
| `src/renderer/src/components/EmulatorView.tsx` | Right-side device/emulator/mirror surface.                      |
| `src/renderer/src/components/tabs/*`           | Primary work surfaces.                                          |
| `src/renderer/src/components/proxy/*`          | Proxy request list/detail/cert wizard.                          |
| `src/renderer/src/components/repeater/*`       | Request editor, response viewer, history, inspector.            |
| `src/renderer/src/components/frida/*`          | Frida parameters, REPL, live events, recon, bypass, tracing.    |
| `src/renderer/src/components/devices/*`        | Device manager and wireless connect dialog.                     |
| `src/renderer/src/stores/*`                    | Zustand state stores.                                           |

## Zustand Stores

Stores mirror main-process state and hold renderer-only UI state.

| Store                      | Purpose                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------- |
| `useUIStore`               | Active tool, sidebar collapse, theme-adjacent UI preferences, emulator panel state.     |
| `useAppStore`              | App info and active project.                                                            |
| `useProjectsStore`         | Project list and project actions.                                                       |
| `useDeviceStore`           | Device list, active serial, wireless progress.                                          |
| `useEmulatorStore`         | Emulator status, SDK status, selected AVD.                                              |
| `useEmulatorInstallsStore` | Third-party emulator installs and launch/connect workflows.                             |
| `useMirrorStore`           | Mirror status and video/control state.                                                  |
| `useProxyStore`            | Proxy status, request buffer, selected request, filters.                                |
| `useRepeaterStore`         | Repeater tabs, active tab, request history, send state.                                 |
| `useApkAnalyzerStore`      | APK summaries, selected APK, analysis state.                                            |
| `useJadxStore`             | JADX status, projects, tree, selected file, search results, progress.                   |
| `useFridaStore`            | Frida status, processes, scripts, session ids, console, recon, strategies, live events. |
| `useLogcatStore`           | Logcat status, line ring buffer, filters, pause/wrap state.                             |
| `useToolchainStore`        | External tool list and install progress.                                                |
| `useSdkSetupStore`         | Android SDK setup wizard progress.                                                      |
| `useCaInstallStore`        | CA install status/result.                                                               |
| `useThemeStore`            | Light/dark/system theme state.                                                          |

## Feature Architecture

### Projects

Project data is stored in SQLite. Captured requests and repeater tabs are
project-scoped. The active project id is kept in the settings table and loaded
by the app store.

Important files:

- `src/main/services/database.ts`
- `src/main/ipc/db.ts`
- `src/renderer/src/components/ProjectPicker.tsx`
- `src/renderer/src/components/ProjectsManager.tsx`

### Devices And Emulator

Device state is centered around an active ADB serial. Most workflows use the
active device rather than an emulator-only assumption.

Important files:

- `src/main/services/device.ts`
- `src/main/services/emulator.ts`
- `src/main/services/emulator-installs.ts`
- `src/main/services/sdk-setup.ts`
- `src/main/ipc/device.ts`
- `src/main/ipc/emulator.ts`
- `src/main/ipc/emulator-installs.ts`
- `src/renderer/src/components/DevicePicker.tsx`
- `src/renderer/src/components/devices/DevicesManager.tsx`
- `src/renderer/src/components/devices/WirelessConnectDialog.tsx`
- `src/renderer/src/components/EmulatorView.tsx`

Supported flows:

- Refresh ADB devices.
- Select active device.
- Promote USB ADB to TCP/IP.
- Connect/disconnect wireless ADB targets.
- Detect and launch third-party emulators.
- Run Android SDK setup.
- Create/select/start/stop/restart AVDs.
- Send Android key events.

### Screen Mirror

The mirror stack uses scrcpy and a renderer-side display/control surface.

Important files:

- `src/main/services/scrcpy.ts`
- `src/main/services/mirror.ts`
- `src/main/ipc/mirror.ts`
- `src/renderer/src/components/EmulatorMirror.tsx`
- `src/renderer/src/components/EmulatorView.tsx`

### Proxy

The proxy service starts mitmproxy and ingests captured traffic. Requests and
responses are persisted through the database service and mirrored to the
renderer.

Important files:

- `src/main/services/proxy.ts`
- `src/main/services/ca-install.ts`
- `src/main/ipc/proxy.ts`
- `resources/mitmproxy/flow.py`
- `src/renderer/src/components/tabs/ProxyTab.tsx`
- `src/renderer/src/components/proxy/RequestList.tsx`
- `src/renderer/src/components/proxy/RequestDetail.tsx`
- `src/renderer/src/components/proxy/CertInstallWizard.tsx`

Capabilities:

- Start/stop proxy.
- Capture requests and responses.
- Persist project-scoped traffic.
- Filter by method/status/scheme/resource/signal/search.
- Inspect request and response details.
- Export HAR.
- Install/reinstall CA.

### Repeater

Repeater tabs are stored in SQLite and can be seeded from captured proxy
requests. Sends are performed by the main process.

Important files:

- `src/main/services/repeater.ts`
- `src/main/ipc/repeater.ts`
- `src/renderer/src/components/tabs/RepeaterTab.tsx`
- `src/renderer/src/components/repeater/RequestEditor.tsx`
- `src/renderer/src/components/repeater/ResponseViewer.tsx`
- `src/renderer/src/components/repeater/InspectorPanel.tsx`
- `src/renderer/src/components/repeater/toCurl.ts`

Capabilities:

- Create/update/delete tabs.
- Send request snapshots.
- Maintain per-tab history.
- Follow redirects optionally.
- Auto Content-Length optionally.
- Repeat request sends.
- Inspect parsed request components.
- Export as cURL.
- Save response bodies.

### APK Analyzer

APK Analyzer builds a static summary from APK metadata, extracted resources,
manifest parsing, DEX/string scans, native libraries, and decompile helpers.

Important files:

- `src/main/services/apk-analyzer.ts`
- `src/main/services/apk/*.ts`
- `src/main/ipc/apk.ts`
- `src/renderer/src/components/tabs/APKAnalyzerTab.tsx`
- `src/renderer/src/stores/useApkAnalyzerStore.ts`

Internal analyzers:

- `manifest.ts`
- `security-checks.ts`
- `secrets.ts`
- `endpoints.ts`
- `trackers.ts`
- `technologies.ts`
- `network-security.ts`
- `native.ts`
- `signing.ts`
- `attack-surface.ts`
- `config-files.ts`
- `dex.ts`
- `inventory.ts`
- `insights.ts`
- `axml.ts`
- `zip.ts`

Capabilities:

- Manifest review.
- Component and permission inventory.
- Attack-surface and deep-link review.
- Endpoint extraction.
- Secret detection.
- Tracker/SDK detection.
- Technology detection.
- Native library review.
- Signing review.
- Network security config review.
- Static security findings and remediation hints.
- Active-device install.
- Frida spawn-with-bypass integration.

### JADX

JADX is modeled as a dedicated decompile workspace rather than a small button in
APK Analyzer.

Important files:

- `src/main/services/jadx.ts`
- `src/main/ipc/jadx.ts`
- `src/renderer/src/components/tabs/JadxTab.tsx`
- `src/renderer/src/stores/useJadxStore.ts`

Capabilities:

- Decompile APKs with options.
- Report progress.
- List projects.
- Build file tree.
- Read source/resource files.
- Protect the UI from very large files.
- Search output.
- Reveal output directory.
- Delete generated projects.

### Frida

Frida uses both host-side `frida` bindings and a bundled in-app JavaScript
agent. The service owns frida-server lifecycle, session lifecycle, script
loading, RPC calls, and event forwarding.

Important files:

- `src/main/services/frida.ts`
- `src/main/ipc/frida.ts`
- `src/renderer/src/components/tabs/FridaTab.tsx`
- `src/renderer/src/components/frida/*`
- `src/renderer/src/stores/useFridaStore.ts`
- `src/agent/index.ts`
- `src/agent/orchestrate.ts`
- `src/agent/strategies/*`
- `src/agent/tracers/*`
- `src/agent/discovery/*`
- `src/agent/detectors/*`
- `resources/frida-scripts/*`
- `scripts/build-agent.mjs`

Service responsibilities:

- Resolve ABI-specific frida-server.
- Download/decompress/cache server binaries.
- Push and chmod server on device.
- Probe server version.
- Start/stop server.
- Detach sessions during stop.
- Disconnect when active device changes.
- List apps and processes.
- Attach, spawn, launch-and-attach.
- Load scripts with Java bridge and REPL shim.
- Relay console and structured events.
- Manage built-in and user scripts.
- Import CodeShare scripts.
- Save and load presets.
- Evaluate REPL code.
- Call agent RPC exports for recon, strategies, tracers, class search, heap
  snapshots, and native tracing.

Agent capabilities:

- Framework detection.
- Network/security/crypto/storage/native/JNI/obfuscation recon.
- Recommendations.
- SSL pinning and TrustManager/Conscrypt/OkHttp bypasses.
- Root/debugger/emulator/Frida-detection bypasses.
- Biometric and FLAG_SECURE bypasses.
- Flutter TLS assistance.
- Crypto/storage/network/IPC live monitors.
- Java class and method discovery.
- Method tracing.
- Native symbol tracing.
- Heap instance snapshots.

### Logcat

Logcat is a long-running ADB subprocess with line parsing in the main process
and filtering/pause behavior in the renderer.

Important files:

- `src/main/services/logcat.ts`
- `src/main/ipc/logcat.ts`
- `src/renderer/src/components/tabs/LogcatTab.tsx`
- `src/renderer/src/stores/useLogcatStore.ts`

Capabilities:

- Start/stop capture.
- Clear device log buffers.
- Choose log buffers.
- Set device-side minimum level.
- Scope to PID/package.
- Parse structured line fields.
- Filter by level, text, regex, case sensitivity, tag include, and tag exclude.
- Pause renderer updates while counting suppressed lines.

### Settings

Settings is the operational control center for projects, devices, tools, SDK,
storage, and app status.

Important files:

- `src/renderer/src/components/tabs/SettingsTab.tsx`
- `src/renderer/src/components/ProjectsManager.tsx`
- `src/renderer/src/components/devices/DevicesManager.tsx`
- `src/renderer/src/components/SdkSetupCard.tsx`
- `src/main/services/toolchain.ts`
- `src/main/services/sdk-setup.ts`

Capabilities:

- Health strip for active device, Frida, proxy, and logcat.
- Project manager.
- Device manager.
- External tool list, install, reinstall, refresh, and reveal install folder.
- Android SDK detection and setup.
- Storage path display.
- App version/platform/channel display.

## Database Schema

Migrations live in `src/main/services/database.ts`.

Current tables:

| Table               | Purpose                                                          |
| ------------------- | ---------------------------------------------------------------- |
| `_migrations`       | Applied migration ids.                                           |
| `projects`          | Project identities and timestamps.                               |
| `settings`          | Key/value settings such as active project and close preferences. |
| `captured_requests` | Proxy requests/responses, project-scoped.                        |
| `repeater_tabs`     | Repeater state, history, settings, latest response.              |
| `frida_scripts`     | User-saved Frida scripts.                                        |
| `frida_presets`     | Per-package or global Frida strategy/monitor presets.            |

SQLite runs under WAL mode with foreign keys enabled and synchronous NORMAL.

## Storage Layout

All paths are resolved through `src/main/utils/paths.ts`.

```text
<userData>/
  data/
    mobsec.db
  logs/
    error.log
    combined.log
  tools/
    platform-tools/
    scrcpy/
    mitmproxy/
    apktool/
    jadx/
    frida/
  avd/
  captures/
  scripts/
  tmp/
```

Rules:

- Do not hard-code `userData` paths outside `paths.ts`.
- Services should clean temporary files they own when practical.
- Generated JADX/APK/decompile output should remain discoverable from the UI.
- Tool downloads should go through the toolchain service.

## Toolchain Model

Toolchain state is represented by `ToolInfo` and `ToolInstallProgress`.

The app downloads or resolves:

- Android platform-tools / ADB.
- Android emulator and SDK components.
- scrcpy.
- mitmproxy.
- apktool.
- JADX.
- ABI-specific frida-server.

Some resources are bundled under `resources/` and copied into package resources
for production builds. Runtime downloads land under `userData/tools`.

## Build And Packaging

Build configuration:

- `package.json`
- `electron.vite.config.ts`
- `electron-builder.yml`
- `scripts/after-pack.cjs`
- `scripts/build-agent.mjs`
- `scripts/generate-icon.mjs`

Build outputs:

- `out/main`
- `out/preload`
- `out/renderer`
- `resources/frida-agent/agent.js`
- `resources/frida-agent/java-bridge.js`

Packaging outputs:

- `release/<version>/`

Targets:

| Platform | Target                                                |
| -------- | ----------------------------------------------------- |
| Windows  | NSIS x64 installer.                                   |
| macOS    | DMG for x64 and arm64.                                |
| Linux    | tar.gz for x64 and arm64; optional AppImage workflow. |

Packaging notes:

- `build/icon.png` is the primary icon source.
- Native modules and resources are unpacked from ASAR as configured.
- `better-sqlite3` and `frida` are unpacked because they include native/runtime
  assets.
- macOS signing/notarization is not fully productionized yet.
- Windows code signing is not fully productionized yet.

## Security Boundaries

Current posture:

- Renderer has no direct Node integration.
- Renderer accesses capabilities only through `window.api`.
- IPC contracts are typed.
- Main-process handlers validate inputs and use `safe()` result envelopes.
- External commands are spawned from main-process services only.
- ADB shell input is quoted/validated where package names or shell arguments are
  involved.
- Project data is local.
- No telemetry or cloud sync exists.

High-risk areas that require continued discipline:

- Any new IPC method must validate every untrusted renderer argument.
- Any shell/ADB command must use structured spawn arguments or explicit quoting.
- Any recursive filesystem delete/move must stay inside a resolved known
  workspace/cache directory.
- Any new renderer feature must not bypass preload.
- Any imported Frida/CodeShare script is user-controlled code and should be
  treated as target-process code, not trusted application code.

## Cross-Platform Notes

Windows:

- Primary development platform for this workspace.
- NSIS packaging is configured.
- `after-pack.cjs` applies executable icon handling with `rcedit`.
- PowerShell helper exists for Linux AppImage building requirements.

Linux:

- tar.gz packages are configured for x64 and arm64.
- AppImage can require Developer Mode/admin-equivalent symlink support when
  building from Windows-hosted environments.
- Runtime behavior depends on ADB permissions, udev rules, and local SDK/tool
  access.

macOS:

- DMG is configured for x64 and arm64.
- Best built and tested on macOS.
- Hardened runtime is enabled in config, but production notarization/signing
  still needs release engineering work.

Android:

- ADB works with USB, wireless, app-managed AVDs, and many third-party emulators.
- Frida server automation requires root/root-capable targets.
- CA system-store installation for modern Android often requires root or
  emulator/device configurations that allow system trust modification.

## Extension Points

To add a new main-process capability:

1. Add shared types in `src/shared/types.ts` if needed.
2. Add IPC channel names in `src/shared/ipc-channels.ts`.
3. Add API methods in `src/shared/api.ts`.
4. Implement service logic in `src/main/services/<feature>.ts`.
5. Register handlers in `src/main/ipc/<feature>.ts`.
6. Expose preload wrappers in `src/preload/index.ts`.
7. Add a Zustand store if the renderer needs persistent or streamed state.
8. Add UI in `src/renderer/src/components`.
9. Subscribe to bus events in `App.tsx` or the relevant tab/store.
10. Add validation, typecheck, lint, and build coverage.

To add a Frida agent capability:

1. Add strategy/tracer/detector/discovery logic under `src/agent`.
2. Export it through the agent registry/orchestrator.
3. Add or extend shared types in `src/shared/frida-intel.ts`.
4. Update `src/main/services/frida.ts` RPC calls if a new host method is needed.
5. Add renderer controls in the Frida panels.
6. Run `pnpm build:agent`.

To add an APK analyzer:

1. Create or extend a module under `src/main/services/apk`.
2. Add fields to shared APK summary types.
3. Compose the new result in `apk-analyzer.ts`.
4. Render it in `APKAnalyzerTab.tsx`.
5. Keep analysis tolerant of malformed APKs and partial extraction failures.

## Validation Commands

Use these commands before shipping a code change:

```bash
pnpm typecheck
pnpm lint
pnpm build
```

Use packaging commands only when release artifacts are actually needed:

```bash
pnpm build:win
pnpm build:mac
pnpm build:linux
pnpm build:linux:appimage
```

## Known Gaps And Missing Features

The application is feature-rich but still in public beta. The main known gaps
are:

| Area                  | Gap                                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Automated test suite  | Service, IPC, renderer, and Frida agent coverage should be expanded.                                                   |
| Electron E2E          | Add repeatable UI smoke tests for critical workflows.                                                                  |
| Release signing       | Add production Windows signing and macOS signing/notarization.                                                         |
| Reporting             | Add first-class project/finding report export in PDF, HTML, and Markdown.                                              |
| Project import/export | Add portable project bundles for offline sharing and backups.                                                          |
| Non-root Frida        | Add guided Frida Gadget patch/repack flow for non-root devices.                                                        |
| Proxy match/replace   | Add rewrite rules, scripted transforms, WebSocket support, and richer decoders.                                        |
| Repeater workflows    | Add collections, variables, auth helpers, request chaining, diffs, and assertions.                                     |
| APK/JADX analysis     | Add call graphs, dependency/SBOM view, patch/rebuild/sign support, and deeper native analysis.                         |
| Device coverage       | Expand tested matrix for OEM devices, API levels, emulator families, and root states.                                  |
| Accessibility         | Continue focus, keyboard, screen reader, contrast, and reduced-motion review.                                          |
| Performance           | Continue profiling large JADX projects, huge APKs, long proxy histories, noisy logcat streams, and heavy Frida events. |
| Documentation         | Add task-focused user guides and troubleshooting pages for common Android/ADB/CA/Frida failures.                       |

## Operational Troubleshooting Notes

- If Frida fails to start, confirm the active device is online, rooted, and has a
  matching ABI. Use Settings to reinstall tools if a cached binary is corrupted.
- If proxy traffic is missing, confirm the device proxy settings, CA trust, and
  whether the app uses certificate pinning or native networking stacks.
- If JADX decompile reports errors but outputs files, inspect the generated
  project anyway; JADX can partially decompile difficult APKs.
- If logcat is empty, confirm the selected device, buffers, minimum level, PID
  scope, and whether the app is currently running.
- If the mirror is blank, restart mirror after the device is fully online and
  verify scrcpy/toolchain installation.
- If ADB devices are unauthorized, accept the RSA prompt on the device and
  refresh devices.

## Maintainer Checklist

Before considering a release:

- `pnpm typecheck` passes.
- `pnpm lint` passes.
- `pnpm build` passes.
- Frida agent is rebuilt.
- Windows installer smoke test passes.
- Linux tar.gz smoke test passes.
- macOS DMG smoke test passes on macOS.
- Proxy, Repeater, APK Analyzer, JADX, Frida, Logcat, Device, Emulator, Mirror,
  and Settings flows are manually smoke tested.
- Release notes include known limitations and platform caveats.
