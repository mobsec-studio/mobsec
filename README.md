# MobSec Studio

MobSec Studio is a local-first Android security workbench for application
assessment, traffic interception, runtime instrumentation, static analysis,
device management, and repeatable testing workflows.

The application is built as a desktop Electron app. It is designed for Android
penetration testers who want a single workspace instead of a loose collection of
terminals, proxies, scripts, emulators, and static-analysis tools.

Everything runs on the analyst machine. There is no cloud backend, telemetry
pipeline, or remote project sync.

## What It Provides

| Area                | Capabilities                                                                                                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dashboard           | Project-aware overview, quick actions, tool state, and navigation into the main work surfaces.                                                                                                                                                                           |
| Projects            | Named workspaces with isolated captured traffic, repeater tabs, and session state.                                                                                                                                                                                       |
| Device management   | USB ADB devices, wireless ADB, active-device selection, unauthorized/offline state handling, third-party emulator discovery, and quick device refresh.                                                                                                                   |
| Emulator management | Android SDK detection, quick SDK/AVD setup, AVD start/stop/restart, boot progress, installed-app listing, APK install, and hardware key actions.                                                                                                                         |
| Screen mirror       | Embedded scrcpy-powered device mirror with touch and key input through the MobSec UI.                                                                                                                                                                                    |
| Proxy               | HTTP/HTTPS interception through mitmproxy, live request/response capture, filtering, request intelligence, HAR export, project-scoped history, and CA installation support.                                                                                              |
| Repeater            | Multi-tab request replay, Monaco-based request editing, auto Content-Length, redirect control, repeat counts, per-tab history, response viewer, inspector panels, cURL export, and response body save.                                                                   |
| APK Analyzer        | APK ingestion, manifest review, component inventory, attack-surface review, endpoints, strings, trackers, technologies, native libraries, signing information, network-security config review, secrets, and security findings.                                           |
| JADX                | Dedicated decompile workspace with project history, progress reporting, file tree, large-file handling, search, reveal-output, and project deletion.                                                                                                                     |
| Frida               | frida-server management, ABI-aware server download/cache, process listing, attach/spawn/launch-and-attach modes, Monaco script authoring, script library, CodeShare import, live console, REPL, recon, Auto-Pwn, bypasses, tracers, presets, and structured live events. |
| Logcat              | Device-side logcat capture with buffer selection, minimum level, PID/package scoping, regex/search filters, tag include/exclude, pause/drop counts, clear buffers, and exportable review flow.                                                                           |
| Settings            | Toolchain management, SDK setup, device/project managers, health overview, storage location, app info, and beta notices.                                                                                                                                                 |

## Main Workflows

### Intercept And Replay Traffic

1. Select or connect an Android device.
2. Start the Proxy.
3. Install the MobSec CA when needed.
4. Capture traffic in the Proxy tab.
5. Send interesting requests to Repeater.
6. Modify, replay, inspect, export, or save the response body.

### Analyze An APK

1. Drop or select an APK in APK Analyzer.
2. Review manifest, components, permissions, signing, trackers, technologies,
   endpoints, native libraries, and findings.
3. Run deeper decompilation in JADX when source-level review is needed.
4. Install the APK to the active device or spawn it with a Frida bypass flow.

### Instrument A Running App

1. Start Frida on the active device.
2. Select a running process or installed package.
3. Use Attach, Spawn, or Launch & Attach depending on the target.
4. Run custom scripts, built-in scripts, Recon, or Auto-Pwn.
5. Use live monitors, class search, method tracing, heap snapshots, native
   tracing, and the REPL to explore behavior.

### Debug Runtime Behavior

1. Start Logcat for the active device.
2. Choose buffers and minimum level.
3. Scope to a package/PID when needed.
4. Filter by level, search, regex, included tags, or excluded tags.
5. Pause without losing track of dropped line counts.

## Deep Feature Map

### Proxy

- Starts and stops a mitmproxy subprocess from the main process.
- Captures request and response metadata into SQLite.
- Shows request method, URL, host, status, content type, duration, and size.
- Includes filters for search, method, status class, scheme, resource type, and
  higher-signal request traits.
- Stores project-scoped request history.
- Supports HAR export.
- Includes a CA installation wizard and reinstall flow.
- Pairs naturally with Repeater for manual verification and fuzzing.

### Repeater

- Creates tabs from scratch or from captured proxy requests.
- Supports method, URL, headers, and body editing.
- Tracks per-send history with request/response snapshots.
- Has auto Content-Length, redirect following, and repeat count settings.
- Includes request inspector views for query parameters, headers, cookies, and
  body fields.
- Includes response viewing in raw/pretty/hex-oriented review surfaces.
- Can export requests as cURL commands.

### APK Analyzer

- Parses core APK metadata and manifest details.
- Reviews activities, services, receivers, and providers.
- Highlights exported components, permissions, deep links, and authorities.
- Scans for secrets, tokens, private keys, database strings, and API keys.
- Detects trackers, analytics SDKs, crash reporters, monitoring libraries,
  payments, push, attribution, and session replay tooling.
- Reviews security settings such as debuggable, allowBackup, cleartext, network
  security config, WebView risks, dynamic code loading, PendingIntent issues,
  exported components, and FLAG_SECURE posture.
- Extracts endpoints and insecure HTTP usage.
- Reviews native libraries by ABI, size, symbols, hashes, and risk tags.
- Integrates with active-device install and Frida spawn-with-bypass flows.

### JADX

- Decompiles APKs through a dedicated service and UI.
- Tracks decompile status and progress in the app.
- Stores and lists JADX projects.
- Presents a collapsible file tree for large decompiled projects.
- Reads source/resource files with large-file safeguards.
- Searches decompiled output.
- Reveals the output directory for external review.
- Allows deleting generated JADX projects when no longer needed.

### Frida

- Downloads and caches frida-server by Android ABI.
- Pushes, chmods, probes, starts, stops, and cleans up frida-server on the
  active device.
- Handles active-device changes by disconnecting stale sessions.
- Lists running processes and installed apps.
- Supports attach, spawn, and launch-and-attach run modes.
- Provides a Monaco script editor with Frida API completions.
- Supports script parameters declared in comments.
- Loads built-in scripts from `resources/frida-scripts`.
- Saves, edits, duplicates, imports, exports, and deletes user scripts.
- Imports CodeShare scripts by handle or URL.
- Streams console messages and structured live events.
- Includes a REPL that evaluates JavaScript in the live session.
- Runs a bundled intelligence agent for framework, security, crypto, storage,
  networking, native, JNI, and obfuscation profiling.
- Includes Auto-Pwn for profiling plus applicable bypass application.
- Provides bypass strategies for SSL pinning, TrustManager/Conscrypt/OkHttp,
  root detection, debugger detection, emulator detection, biometric checks,
  FLAG_SECURE, anti-Frida checks, and Flutter TLS interception.
- Supports presets for replaying bypass/monitor selections.
- Includes monitors for crypto, storage, network, IPC, class tracing, and native
  symbol tracing.
- Includes class search, method reflection, heap instance snapshots, native
  tracing, and active-trace stopping.

### Logcat

- Captures logs from the active device through ADB.
- Supports main/system/crash/events/radio/kernel buffers where available.
- Supports device-side minimum level and PID filtering.
- Resolves package names to PIDs for scoped capture.
- Parses logcat lines into timestamp, level, PID, TID, tag, and message.
- Maintains a bounded renderer-side ring buffer.
- Supports pause with suppressed-line count.
- Provides level toggles, text search, regex mode, case sensitivity, tag include,
  and tag exclude filters.

### Device And Emulator Support

- Active-device model shared by emulator, mirror, proxy, Frida, JADX/APK flows,
  and logcat.
- USB ADB and wireless ADB.
- Wireless connect helper for direct `host:port` and USB-to-TCP/IP promotion.
- Third-party emulator install discovery and connect-all workflows.
- Embedded emulator setup through Android SDK tooling.
- AVD list, selected AVD, start, stop, restart, install APK, launch app, and
  key actions.

## Architecture Summary

MobSec Studio is split into three Electron layers:

| Layer        | Role                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------- |
| Main process | Owns stateful services, SQLite, logging, child processes, filesystem access, and IPC handlers.      |
| Preload      | Exposes a typed, allow-listed `window.api` through `contextBridge`.                                 |
| Renderer     | React UI with Zustand stores. It has no direct Node, Electron, filesystem, or child-process access. |

External tools are owned by main-process services:

- ADB and Android SDK command-line tools.
- Android Emulator and AVD Manager.
- scrcpy for mirroring.
- mitmproxy for traffic capture.
- apktool and JADX for static analysis.
- Frida and frida-server for runtime instrumentation.

See [docs/architecture.md](docs/architecture.md) for the full engineering map.

## Storage

Persistent data lives under Electron's `userData` directory.

| Path             | Purpose                                            |
| ---------------- | -------------------------------------------------- |
| `data/mobsec.db` | SQLite database with WAL mode.                     |
| `logs/`          | Winston logs.                                      |
| `tools/`         | Downloaded toolchain and cached external binaries. |
| `avd/`           | App-managed Android Virtual Device data.           |
| `captures/`      | Exported captures and request/response bodies.     |
| `scripts/`       | User-saved Frida scripts and related local data.   |
| `tmp/`           | Temporary APK/JADX/tooling work.                   |

## Tech Stack

| Layer                   | Technology                                                  |
| ----------------------- | ----------------------------------------------------------- |
| Desktop                 | Electron 33, electron-vite, electron-builder                |
| UI                      | React 18, TypeScript, Tailwind CSS, shadcn-style primitives |
| Editors                 | Monaco Editor                                               |
| State                   | Zustand                                                     |
| Database                | better-sqlite3                                              |
| Logging                 | Winston                                                     |
| Runtime instrumentation | Frida 17, frida-java-bridge, bundled agent                  |
| Proxy                   | mitmproxy                                                   |
| Android control         | ADB, Android Emulator, SDK tools                            |
| Mirroring               | scrcpy                                                      |
| Static analysis         | apktool, JADX                                               |
| Build tooling           | pnpm, Vite, TypeScript, ESLint, Prettier                    |

## Supported Platforms

| Platform        | Status                                                   |
| --------------- | -------------------------------------------------------- |
| Windows x64     | Primary supported packaging target; NSIS installer.      |
| Linux x64/arm64 | Supported through tar.gz and optional AppImage workflow. |
| macOS x64/arm64 | Supported through DMG packaging, best built on macOS.    |

Runtime Android support depends on the local ADB/SDK environment and whether the
target device permits the operation. Frida server installation requires a rooted
or root-capable Android environment. Non-root targets can still be assessed with
proxying, static analysis, logcat, and manual/gadget-based instrumentation
outside the automatic frida-server flow.

## Quick Start

Prerequisites:

- Node.js 20 or newer.
- pnpm 8 or newer.
- Internet access for first-time dependency/tool downloads.

```bash
pnpm install
pnpm dev
```

Useful scripts:

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm build:win
pnpm build:mac
pnpm build:linux
pnpm build:linux:appimage
```

`pnpm build` creates the compiled app in `out/`. Installer/package scripts write
to `release/<version>/`.

## Security Posture

- Renderer runs with `contextIsolation: true`.
- Renderer does not get direct Node integration.
- IPC is typed in shared files and implemented through preload wrappers.
- Main-process handlers validate inputs and return `IpcResult` envelopes.
- External tools are spawned by main-process services, not renderer code.
- Project data is local by default.
- No telemetry or cloud synchronization is built into the app.

## Known Gaps And Roadmap

These are not necessarily bugs; they are the most important remaining product
and engineering opportunities.

| Area               | Current gap / next improvement                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Automated tests    | Add unit/integration coverage for services, IPC contracts, APK analyzers, Frida agent modules, and renderer workflows.           |
| End-to-end testing | Add Playwright/Electron smoke tests for proxy, repeater, APK, JADX, Frida, logcat, and device flows.                             |
| Signed releases    | Add production-grade Windows signing, macOS signing/notarization, and Linux repository metadata when distribution is formalized. |
| Reporting          | Add polished PDF/HTML/Markdown export for APK findings, proxy sessions, Frida recon, and combined project reports.               |
| Collaboration      | Add optional project import/export bundles before considering any multi-user/cloud sync.                                         |
| Non-root Frida     | Add a first-class Frida Gadget workflow for non-root production devices.                                                         |
| Proxy depth        | Add WebSocket views, advanced content decoding, match/replace rules, and scripted traffic transformations.                       |
| Repeater depth     | Add collections, variables, auth helpers, chained requests, diff views, and assertion-based checks.                              |
| APK/JADX depth     | Add call graph views, taint-style traces, SBOM/dependency views, patch/rebuild/sign flows, and richer native binary analysis.    |
| Device matrix      | Broaden tested coverage across Android API levels, OEM ROMs, rooted/non-rooted devices, and third-party emulators.               |
| Accessibility      | Continue keyboard navigation, focus states, screen reader labels, and reduced-motion review.                                     |
| Performance        | Continue profiling large APK/JADX projects, long proxy captures, noisy logcat sessions, and heavy Frida event streams.           |

## Repository Guide

| Path           | Purpose                                                               |
| -------------- | --------------------------------------------------------------------- |
| `src/main`     | Main process, services, IPC handlers, database, logging, paths.       |
| `src/preload`  | Context bridge and exposed API.                                       |
| `src/renderer` | React UI, stores, tabs, shared components, styling.                   |
| `src/shared`   | Types, IPC channel names, API contract, Frida intelligence types.     |
| `src/agent`    | Bundled Frida agent, strategies, tracers, discovery, recon.           |
| `resources`    | Built-in Frida scripts, Frida agent bundle, mitmproxy helper.         |
| `scripts`      | Icon generation, Frida probe tooling, agent build, packaging helpers. |
| `build`        | Packaging icons/resources.                                            |
| `docs`         | Architecture and engineering documentation.                           |

## License

MIT
