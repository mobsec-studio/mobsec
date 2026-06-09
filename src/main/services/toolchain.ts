import extract from 'extract-zip'
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { rename } from 'node:fs/promises'
import { get as httpsGet } from 'node:https'
import { get as httpGet } from 'node:http'
import { tmpdir } from 'node:os'
import { basename, delimiter, dirname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
// `xz-decompress` ships as CommonJS — Node ESM can't named-import from it
// directly. The error message Node prints points exactly here:
// "import pkg from '...'; const { XzReadableStream } = pkg".
import xzDecompress from 'xz-decompress'
const { XzReadableStream } = xzDecompress
import type { ToolInfo, ToolStatusState } from '@shared/types'
import { bus } from '../utils/event-bus'
import { getLogger } from '../utils/logger'
import { getPaths } from '../utils/paths'
import { safeSpawn } from '../utils/spawn'

/**
 * Tool acquisition service.
 *
 * Each tool has:
 *  - a manifest entry describing per-platform download URLs and the expected
 *    layout under userData/tools/<install-subdir>/,
 *  - an installer that downloads, verifies, and extracts on demand,
 *  - and a status that the renderer subscribes to via `toolInstall:progress`.
 *
 * Larger pieces of the Android SDK (system image, emulator binary) are
 * intentionally NOT auto-downloaded by this service — they're licensed and
 * gated behind sdkmanager license acceptance. The emulator service tries to
 * discover an existing SDK first (ANDROID_HOME / ANDROID_SDK_ROOT), and falls
 * back to a guided installer card if nothing is found.
 */

type Plat = 'win32' | 'darwin' | 'linux'

interface DownloadSpec {
  url: string
  /** Filename to land the download as (under tmp). */
  filename: string
  /** Format of the downloaded archive. `zip` is the historical default and
   *  needs `archiveRoot` to lift a single inner folder. `tar.gz` is used by
   *  Linux/macOS standalone tools. `xz-single-file` expects the .xz to
   *  decompress into one binary. `raw-single-file` stores the downloaded file
   *  directly under the install dir. */
  kind?: 'zip' | 'tar.gz' | 'xz-single-file' | 'raw-single-file'
  /** Top-level directory inside the archive that contains the payload. Used
   *  by the `zip` kind only. */
  archiveRoot?: string
  /** For `xz-single-file`: the filename to give the decompressed binary
   *  under the install dir. Falls back to `binaryRelativePath` lookup. */
  decompressedFilename?: string
}

interface ToolManifest {
  id: string
  label: string
  description: string
  required: boolean
  /** Folder under getPaths().tools where this tool ends up. */
  installSubdir: string
  /** Binary path relative to the install dir; used to detect existing installs. */
  binaryRelativePath: Partial<Record<Plat, string>>
  download: Partial<Record<Plat, DownloadSpec>>
}

const PLATFORM_TOOLS_BASE = 'https://dl.google.com/android/repository/platform-tools-latest-'
const SCRCPY_BASE = 'https://github.com/Genymobile/scrcpy/releases/download'
const SCRCPY_VERSION = '3.1'
const CMDLINE_TOOLS_BASE = 'https://dl.google.com/android/repository/commandlinetools-'
// Pinned to a recent build of the Android SDK Command-Line Tools.
// Update this revision number occasionally; old revisions stay available.
const CMDLINE_TOOLS_BUILD = '11076708_latest'
const MITMPROXY_BASE = 'https://downloads.mitmproxy.org'
const MITMPROXY_VERSION = '11.1.3'
const FRIDA_BASE = 'https://github.com/frida/frida/releases/download'
// Keep this in lockstep with the `frida` npm dep so the host bindings and
// the device server speak the same protocol version. If they diverge, the
// device connection fails with "incompatible client".
const FRIDA_VERSION = '17.9.10'
const JADX_BASE = 'https://github.com/skylot/jadx/releases/download'
const JADX_VERSION = '1.5.3'

function hostArchName(kind: 'linux' | 'darwin'): string {
  if (kind === 'linux') return process.arch === 'arm64' ? 'aarch64' : 'x86_64'
  return process.arch === 'arm64' ? 'arm64' : 'x86_64'
}

function mitmproxyArchive(kind: 'linux' | 'darwin'): DownloadSpec {
  const arch = hostArchName(kind)
  const platformName = kind === 'darwin' ? 'macos' : 'linux'
  return {
    kind: 'tar.gz',
    url: `${MITMPROXY_BASE}/${MITMPROXY_VERSION}/mitmproxy-${MITMPROXY_VERSION}-${platformName}-${arch}.tar.gz`,
    filename: `mitmproxy-${MITMPROXY_VERSION}-${platformName}-${arch}.tar.gz`
  }
}

function scrcpyServerDownload(): DownloadSpec {
  return {
    kind: 'raw-single-file',
    url: `${SCRCPY_BASE}/v${SCRCPY_VERSION}/scrcpy-server-v${SCRCPY_VERSION}`,
    filename: `scrcpy-server-v${SCRCPY_VERSION}`,
    decompressedFilename: 'scrcpy-server'
  }
}

const MANIFEST: ToolManifest[] = [
  {
    id: 'platform-tools',
    label: 'Android Platform Tools',
    description: 'adb and fastboot — required for emulator control and APK installation.',
    required: true,
    installSubdir: 'platform-tools',
    binaryRelativePath: {
      win32: 'adb.exe',
      darwin: 'adb',
      linux: 'adb'
    },
    download: {
      win32: {
        url: `${PLATFORM_TOOLS_BASE}windows.zip`,
        filename: 'platform-tools-windows.zip',
        archiveRoot: 'platform-tools'
      },
      darwin: {
        url: `${PLATFORM_TOOLS_BASE}darwin.zip`,
        filename: 'platform-tools-darwin.zip',
        archiveRoot: 'platform-tools'
      },
      linux: {
        url: `${PLATFORM_TOOLS_BASE}linux.zip`,
        filename: 'platform-tools-linux.zip',
        archiveRoot: 'platform-tools'
      }
    }
  },
  {
    id: 'cmdline-tools',
    label: 'Android Command-line Tools',
    description: 'sdkmanager + avdmanager. Required to install the emulator and create AVDs.',
    required: false,
    installSubdir: 'cmdline-tools/latest',
    binaryRelativePath: {
      win32: 'bin/sdkmanager.bat',
      darwin: 'bin/sdkmanager',
      linux: 'bin/sdkmanager'
    },
    download: {
      win32: {
        url: `${CMDLINE_TOOLS_BASE}win-${CMDLINE_TOOLS_BUILD}.zip`,
        filename: `commandlinetools-win-${CMDLINE_TOOLS_BUILD}.zip`,
        archiveRoot: 'cmdline-tools'
      },
      darwin: {
        url: `${CMDLINE_TOOLS_BASE}mac-${CMDLINE_TOOLS_BUILD}.zip`,
        filename: `commandlinetools-mac-${CMDLINE_TOOLS_BUILD}.zip`,
        archiveRoot: 'cmdline-tools'
      },
      linux: {
        url: `${CMDLINE_TOOLS_BASE}linux-${CMDLINE_TOOLS_BUILD}.zip`,
        filename: `commandlinetools-linux-${CMDLINE_TOOLS_BUILD}.zip`,
        archiveRoot: 'cmdline-tools'
      }
    }
  },
  {
    id: 'mitmproxy',
    label: 'mitmproxy',
    description: 'Local HTTP/HTTPS interception proxy. Used by the Proxy tab.',
    required: false,
    installSubdir: 'mitmproxy',
    binaryRelativePath: {
      win32: 'mitmdump.exe',
      darwin: 'mitmdump',
      linux: 'mitmdump'
    },
    download: {
      win32: {
        url: `${MITMPROXY_BASE}/${MITMPROXY_VERSION}/mitmproxy-${MITMPROXY_VERSION}-windows-x86_64.zip`,
        filename: `mitmproxy-${MITMPROXY_VERSION}-windows.zip`
        // Windows zip extracts the binaries directly at the root (no inner folder).
      },
      darwin: mitmproxyArchive('darwin'),
      linux: mitmproxyArchive('linux')
    }
  },
  {
    id: 'frida-server',
    label: 'Frida server (Android)',
    description:
      'Runtime instrumentation daemon. MobSec downloads the matching Android ABI on demand.',
    required: false,
    installSubdir: 'frida',
    binaryRelativePath: {
      // The frida-server binary IS an Android ELF, not a host-platform
      // binary. We just store it in the same install dir regardless of OS.
      win32: 'frida-server',
      darwin: 'frida-server',
      linux: 'frida-server'
    },
    download: {
      win32: {
        kind: 'xz-single-file',
        url: `${FRIDA_BASE}/${FRIDA_VERSION}/frida-server-${FRIDA_VERSION}-android-x86_64.xz`,
        filename: `frida-server-${FRIDA_VERSION}-android-x86_64.xz`,
        decompressedFilename: 'frida-server'
      },
      darwin: {
        kind: 'xz-single-file',
        url: `${FRIDA_BASE}/${FRIDA_VERSION}/frida-server-${FRIDA_VERSION}-android-x86_64.xz`,
        filename: `frida-server-${FRIDA_VERSION}-android-x86_64.xz`,
        decompressedFilename: 'frida-server'
      },
      linux: {
        kind: 'xz-single-file',
        url: `${FRIDA_BASE}/${FRIDA_VERSION}/frida-server-${FRIDA_VERSION}-android-x86_64.xz`,
        filename: `frida-server-${FRIDA_VERSION}-android-x86_64.xz`,
        decompressedFilename: 'frida-server'
      }
    }
  },
  {
    id: 'scrcpy',
    label: 'scrcpy',
    description: 'Open-source Android screen mirror — embeds the emulator inside MobSec Studio.',
    required: true,
    installSubdir: 'scrcpy',
    binaryRelativePath: {
      win32: 'scrcpy.exe',
      darwin: 'scrcpy-server',
      linux: 'scrcpy-server'
    },
    download: {
      win32: {
        url: `${SCRCPY_BASE}/v${SCRCPY_VERSION}/scrcpy-win64-v${SCRCPY_VERSION}.zip`,
        filename: `scrcpy-win64-v${SCRCPY_VERSION}.zip`,
        archiveRoot: `scrcpy-win64-v${SCRCPY_VERSION}`
      },
      darwin: scrcpyServerDownload(),
      linux: scrcpyServerDownload()
    }
  },
  {
    id: 'jadx',
    label: 'JADX',
    description: 'Dex-to-Java decompiler used by the JADX Workbench for source review.',
    required: false,
    installSubdir: 'jadx',
    binaryRelativePath: {
      win32: 'bin/jadx.bat',
      darwin: 'bin/jadx',
      linux: 'bin/jadx'
    },
    download: {
      win32: {
        url: `${JADX_BASE}/v${JADX_VERSION}/jadx-${JADX_VERSION}.zip`,
        filename: `jadx-${JADX_VERSION}.zip`
      },
      darwin: {
        url: `${JADX_BASE}/v${JADX_VERSION}/jadx-${JADX_VERSION}.zip`,
        filename: `jadx-${JADX_VERSION}.zip`
      },
      linux: {
        url: `${JADX_BASE}/v${JADX_VERSION}/jadx-${JADX_VERSION}.zip`,
        filename: `jadx-${JADX_VERSION}.zip`
      }
    }
  }
]

/**
 * Some tools own a long-running subprocess that locks files on Windows.
 * Other services register a "shut me down before you touch my install dir"
 * callback here so reinstalls don't trip EPERM. We avoid importing those
 * services directly so toolchain stays free of dependency cycles.
 */
const dependents = new Map<string, () => Promise<void>>()

export function registerToolDependent(toolId: string, stop: () => Promise<void>): void {
  dependents.set(toolId, stop)
}

async function stopDependents(toolId: string): Promise<void> {
  const stop = dependents.get(toolId)
  if (!stop) return
  try {
    await stop()
  } catch {
    // best-effort — install can still proceed if stop fails; we'll get a
    // clearer error from the unlink if the binary is still locked.
  }
}

type State = ToolStatusState

interface ToolState {
  state: State
  version: string | null
  progress: { received: number; total: number } | null
  errorMessage?: string
  abort?: AbortController
}

class ToolchainService {
  private states = new Map<string, ToolState>()

  constructor() {
    for (const tool of MANIFEST) {
      this.states.set(tool.id, {
        state: this.detectInstalled(tool) ? 'installed' : 'not-installed',
        version: null,
        progress: null
      })
    }
  }

  list(): ToolInfo[] {
    const plat = process.platform as Plat
    return MANIFEST.map((m) => {
      const st = this.states.get(m.id)!
      const installPath = this.resolveInstalledPath(m, plat)
      const downloadSpec = m.download[plat]
      const busy =
        st.state === 'queued' ||
        st.state === 'downloading' ||
        st.state === 'extracting'
      const state: ToolStatusState = busy
        ? st.state
        : installPath
          ? 'installed'
          : downloadSpec
            ? st.state === 'error'
              ? 'error'
              : 'not-installed'
            : 'unavailable'
      const source = installPath
        ? installPath.startsWith(getPaths().tools)
          ? 'Managed by MobSec Studio'
          : 'Detected on this system'
        : downloadSpec?.url ?? manualInstallMessage(m, plat)
      return {
        id: m.id,
        label: m.label,
        description: m.description,
        state,
        version: st.version,
        installPath,
        source,
        required: m.required,
        progress: st.progress,
        errorMessage: state === 'error' ? st.errorMessage : undefined
      }
    })
  }

  /**
   * Resolve the absolute path to the binary if we have a candidate location.
   * Returns null when the current platform has no automatic install path.
   */
  binaryPath(toolId: string): string | null {
    const plat = process.platform as Plat
    const tool = MANIFEST.find((t) => t.id === toolId)
    if (!tool) return null
    return this.resolveInstalledPath(tool, plat)
  }

  isInstalled(toolId: string): boolean {
    return this.binaryPath(toolId) !== null
  }

  async install(toolId: string): Promise<void> {
    const tool = MANIFEST.find((t) => t.id === toolId)
    if (!tool) throw new Error(`Unknown tool: ${toolId}`)

    const plat = process.platform as Plat
    const spec = tool.download[plat]
    if (!spec) {
      throw new Error(manualInstallMessage(tool, plat))
    }

    const existing = this.states.get(toolId)
    if (existing?.state === 'downloading' || existing?.state === 'extracting') {
      throw new Error(`${tool.label} install already in progress`)
    }

    // Some tools have a long-running process that locks the binary on Windows.
    // Reinstalling while the process is alive trips `EPERM: unlink ...` when
    // we try to wipe the old install dir. Stop the dependent service first.
    await stopDependents(toolId)

    const abort = new AbortController()
    this.setState(tool, { state: 'queued', version: null, progress: null, abort })
    this.emit(tool, 'queued', 0, 0, `Preparing to download ${tool.label}…`)

    const paths = getPaths()
    const finalDir = join(paths.tools, tool.installSubdir)
    const stagingDir = join(paths.tmp, `tool-${tool.id}-${Date.now()}`)
    const archiveTarget = join(paths.tmp, spec.filename)

    try {
      // Clean stale staging from previous failed runs.
      if (existsSync(stagingDir)) rmSync(stagingDir, { recursive: true, force: true })
      mkdirSync(stagingDir, { recursive: true })

      this.setState(tool, { state: 'downloading', version: null, progress: { received: 0, total: 0 }, abort })
      await this.download(spec.url, archiveTarget, (received, total) => {
        this.setState(tool, {
          state: 'downloading',
          version: null,
          progress: { received, total },
          abort
        })
        this.emit(tool, 'downloading', received, total, `Downloading ${tool.label}…`)
      }, abort.signal)

      this.setState(tool, { state: 'extracting', version: null, progress: null, abort })
      this.emit(tool, 'extracting', 0, 0, `Extracting ${tool.label}…`)

      if (spec.kind === 'xz-single-file') {
        // Decompress directly into the install dir under the desired name.
        if (existsSync(finalDir)) rmSync(finalDir, { recursive: true, force: true })
        mkdirSync(finalDir, { recursive: true })
        const binName =
          spec.decompressedFilename ?? tool.binaryRelativePath[plat] ?? 'binary'
        const targetBin = join(finalDir, binName)
        await decompressXzToFile(archiveTarget, targetBin)
      } else if (spec.kind === 'raw-single-file') {
        if (existsSync(finalDir)) rmSync(finalDir, { recursive: true, force: true })
        mkdirSync(finalDir, { recursive: true })
        const binName =
          spec.decompressedFilename ?? tool.binaryRelativePath[plat] ?? basename(spec.filename)
        await rename(archiveTarget, join(finalDir, binName))
      } else {
        if (spec.kind === 'tar.gz') {
          await extractTarGz(archiveTarget, stagingDir)
        } else {
          await extract(archiveTarget, { dir: stagingDir })
        }
        const stagedRoot = resolveArchivePayloadRoot(stagingDir, spec)
        if (!existsSync(stagedRoot)) {
          throw new Error(`Expected directory ${spec.archiveRoot} inside ${spec.filename}`)
        }
        if (existsSync(finalDir)) rmSync(finalDir, { recursive: true, force: true })
        mkdirSync(dirname(finalDir), { recursive: true })
        await rename(stagedRoot, finalDir)
      }

      // On macOS / Linux make the binary executable.
      const bin = this.binaryAbsolutePath(tool, plat)
      if (bin && plat !== 'win32' && existsSync(bin)) {
        const { chmodSync } = await import('node:fs')
        chmodSync(bin, 0o755)
      }

      try {
        rmSync(stagingDir, { recursive: true, force: true })
      } catch {
        // best-effort cleanup
      }
      try {
        rmSync(archiveTarget, { force: true })
      } catch {
        // best-effort cleanup
      }

      this.setState(tool, { state: 'installed', version: null, progress: null })
      this.emit(tool, 'done', 0, 0, `${tool.label} installed`)
      getLogger().info(`Installed ${tool.label}`, { dir: finalDir })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      getLogger().error(`Tool install failed: ${tool.id}`, { error: message })
      this.setState(tool, {
        state: 'error',
        version: null,
        progress: null,
        errorMessage: message
      })
      this.emit(tool, 'error', 0, 0, message)
      try {
        rmSync(stagingDir, { recursive: true, force: true })
      } catch {
        // best-effort cleanup
      }
      throw err
    }
  }

  cancel(toolId: string): void {
    const state = this.states.get(toolId)
    state?.abort?.abort(new Error('Cancelled by user'))
  }

  private binaryAbsolutePath(tool: ToolManifest, plat: Plat): string | null {
    const rel = tool.binaryRelativePath[plat]
    if (!rel) return null
    return join(getPaths().tools, tool.installSubdir, rel)
  }

  private resolveInstalledPath(tool: ToolManifest, plat: Plat): string | null {
    const managed = this.binaryAbsolutePath(tool, plat)
    if (managed && existsSync(managed)) return managed

    if (tool.id === 'platform-tools') {
      const sdkRoot = process.env['ANDROID_HOME'] || process.env['ANDROID_SDK_ROOT']
      const adb = tool.binaryRelativePath[plat]
      if (sdkRoot && adb) {
        const candidate = join(sdkRoot, 'platform-tools', adb)
        if (existsSync(candidate)) return candidate
      }
      return findOnPath(plat === 'win32' ? 'adb.exe' : 'adb')
    }

    if (tool.id === 'cmdline-tools') {
      const sdkRoot = process.env['ANDROID_HOME'] || process.env['ANDROID_SDK_ROOT']
      const sdkmanager = tool.binaryRelativePath[plat]
      if (sdkRoot && sdkmanager) {
        const candidate = join(sdkRoot, 'cmdline-tools', 'latest', sdkmanager)
        if (existsSync(candidate)) return candidate
      }
      return findOnPath(plat === 'win32' ? 'sdkmanager.bat' : 'sdkmanager')
    }

    if (tool.id === 'mitmproxy') {
      return findOnPath(plat === 'win32' ? 'mitmdump.exe' : 'mitmdump')
    }

    if (tool.id === 'scrcpy') {
      if (plat === 'win32') return findOnPath('scrcpy.exe')
      return findScrcpyServer()
    }

    if (tool.id === 'jadx') {
      return findOnPath(plat === 'win32' ? 'jadx.bat' : 'jadx')
    }

    return null
  }

  private detectInstalled(tool: ToolManifest): boolean {
    const plat = process.platform as Plat
    return this.resolveInstalledPath(tool, plat) !== null
  }

  private setState(
    tool: ToolManifest,
    next: Partial<ToolState> & { state: State }
  ): void {
    const merged: ToolState = {
      ...(this.states.get(tool.id) ?? { state: 'not-installed', version: null, progress: null }),
      ...next
    }
    this.states.set(tool.id, merged)
  }

  private emit(
    tool: ToolManifest,
    phase: 'queued' | 'downloading' | 'extracting' | 'verifying' | 'done' | 'error',
    received: number,
    total: number,
    message: string
  ): void {
    bus.emit('toolInstall:progress', {
      toolId: tool.id,
      toolLabel: tool.label,
      phase,
      bytesReceived: received,
      bytesTotal: total,
      message
    })
  }

  /**
   * Stream a URL to disk with progress callbacks. Follows up to 5 redirects.
   * Resolves the file size from the Content-Length header when available.
   */
  private async download(
    url: string,
    target: string,
    onProgress: (received: number, total: number) => void,
    signal: AbortSignal
  ): Promise<void> {
    const stagingFile = join(tmpdir(), `mobsec-${Date.now()}-${basename(target)}`)
    let redirects = 0
    let currentUrl = url

    for (;;) {
      if (signal.aborted) throw new Error('Download cancelled')
      const result = await new Promise<{ kind: 'redirect'; to: string } | { kind: 'ok' }>(
        (resolve, reject) => {
          const client = currentUrl.startsWith('https') ? httpsGet : httpGet
          const req = client(currentUrl, { signal }, (res) => {
            const status = res.statusCode ?? 0
            if (status >= 300 && status < 400 && res.headers.location) {
              res.resume()
              resolve({ kind: 'redirect', to: res.headers.location })
              return
            }
            if (status !== 200) {
              res.resume()
              reject(new Error(`HTTP ${status} fetching ${currentUrl}`))
              return
            }
            const total = Number(res.headers['content-length'] ?? 0)
            let received = 0
            res.on('data', (chunk: Buffer) => {
              received += chunk.length
              onProgress(received, total)
            })
            const out = createWriteStream(stagingFile)
            pipeline(res, out)
              .then(() => resolve({ kind: 'ok' }))
              .catch(reject)
          })
          req.on('error', reject)
        }
      )

      if (result.kind === 'redirect') {
        redirects += 1
        if (redirects > 5) throw new Error('Too many redirects')
        currentUrl = new URL(result.to, currentUrl).toString()
        continue
      }

      const size = statSync(stagingFile).size
      if (size === 0) throw new Error('Downloaded file is empty')
      await rename(stagingFile, target)
      return
    }
  }
}

function findOnPath(binary: string): string | null {
  for (const dir of (process.env['PATH'] ?? '').split(delimiter)) {
    if (!dir) continue
    const candidate = join(dir, binary)
    if (existsSync(candidate)) return candidate
  }
  return null
}

function findScrcpyServer(): string | null {
  const candidates = [
    process.env['SCRCPY_SERVER_PATH'] ?? '',
    join(getPaths().tools, 'scrcpy', 'scrcpy-server'),
    join(getPaths().tools, 'scrcpy', 'scrcpy-server.jar'),
    '/opt/homebrew/share/scrcpy/scrcpy-server',
    '/usr/local/share/scrcpy/scrcpy-server',
    '/usr/local/opt/scrcpy/share/scrcpy/scrcpy-server',
    '/usr/share/scrcpy/scrcpy-server',
    '/snap/scrcpy/current/usr/share/scrcpy/scrcpy-server'
  ]

  for (const scrcpyBin of ['scrcpy', 'scrcpy.exe']) {
    const fromPath = findOnPath(scrcpyBin)
    if (!fromPath) continue
    const binDir = dirname(fromPath)
    const prefix = dirname(binDir)
    candidates.push(join(binDir, 'scrcpy-server'))
    candidates.push(join(prefix, 'share', 'scrcpy', 'scrcpy-server'))
  }

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate
  }
  return null
}

function manualInstallMessage(tool: ToolManifest, plat: Plat): string {
  if (tool.id === 'mitmproxy') {
    return `mitmproxy is not auto-downloadable for ${plat}/${process.arch}. Install it with your OS package manager and ensure mitmdump is on PATH.`
  }
  if (tool.id === 'scrcpy') {
    return `scrcpy-server is not auto-downloadable for ${plat}/${process.arch}. Install scrcpy with your OS package manager or set SCRCPY_SERVER_PATH.`
  }
  return `${tool.label} is not auto-downloadable for ${plat}/${process.arch}. Install it with your OS package manager and ensure it is on PATH.`
}

function resolveArchivePayloadRoot(stagingDir: string, spec: DownloadSpec): string {
  if (spec.archiveRoot) return join(stagingDir, spec.archiveRoot)

  const entries = readdirSync(stagingDir, { withFileTypes: true }).filter(
    (entry) => entry.name !== '__MACOSX'
  )
  if (entries.length === 1 && entries[0]?.isDirectory()) {
    return join(stagingDir, entries[0].name)
  }
  return stagingDir
}

function extractTarGz(archive: string, destination: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = safeSpawn('tar', ['-xzf', archive, '-C', destination], {
      windowsHide: true
    })
    let stderr = ''
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`tar exited ${code}: ${stderr.trim() || 'unknown error'}`))
    })
  })
}

/**
 * Decompress a `.xz` file into a single destination file. The pure-JS
 * `xz-decompress` package works on Web Streams, so we wrap the file buffer
 * in a `Blob.stream()` and drain the reader into a Node buffer.
 */
async function decompressXzToFile(srcXzFile: string, destFile: string): Promise<void> {
  const raw = readFileSync(srcXzFile)
  // `Blob` is available in Electron 33's renderer + Node 18+ main. Wrap so
  // we get a `ReadableStream<Uint8Array>` to hand to XzReadableStream.
  const blob = new Blob([raw])
  const stream = new XzReadableStream(blob.stream())
  const reader = stream.getReader()
  const chunks: Buffer[] = []
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(Buffer.from(value))
  }
  writeFileSync(destFile, Buffer.concat(chunks))
}

export const toolchainService = new ToolchainService()
