import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, statSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdir, chmod } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import xzDecompress from 'xz-decompress'
const { XzReadableStream } = xzDecompress
import frida, { Scope } from 'frida'
import type { Application, Device, Process, Script, Session } from 'frida'
import type { FridaProcess, FridaScript, FridaStatus } from '@shared/types'
import {
  isAgentMessage,
  type ActiveTrace,
  type AgentMessage,
  type AppIntelligenceReport,
  type ApplyStrategiesResult,
  type AutoPwnResult,
  type ClassMethodInfo,
  type ClassSearchResult,
  type HeapInstance,
  type ReconResult,
  type StrategyInfo,
  type StrategyResult,
  type TracerInfo
} from '@shared/frida-intel'
import { bus } from '../utils/event-bus'
import { getLogger } from '../utils/logger'
import { getPaths } from '../utils/paths'
import {
  isSafeAndroidPackageName,
  pushFile,
  quoteShellArg,
  root as adbRoot,
  resolveAdbPath,
  shell
} from './adb'

/**
 * Frida release version. Must match the `frida` npm package version so
 * the device-side server speaks the same protocol as the host bindings.
 * If you bump the npm dep, bump this in lockstep.
 */
const FRIDA_VERSION = '17.9.10'
const FRIDA_RELEASE_BASE = 'https://github.com/frida/frida/releases/download'

/**
 * Frida integration.
 *
 * Lifecycle:
 *   1. The user clicks "Install & start frida-server" in the Frida tab.
 *   2. We adb-root the device, push the bundled `frida-server` binary into
 *      `/data/local/tmp/`, chmod it, and run with `-D` so it daemonizes.
 *   3. frida-node's device manager picks up the new ABI server within
 *      a second or two — we poll for it.
 *   4. From then on, listProcesses / attach / loadScript work against the
 *      live `Device` handle.
 *
 * Each script load opens an isolated `Session` we track by a uuid we mint
 * locally (Frida sessions don't have user-friendly ids). Multiple sessions
 * can run in parallel against different processes.
 */

interface ActiveSession {
  session: Session
  script: Script | null
}

class FridaService {
  private status: FridaStatus = {
    state: 'disconnected',
    deviceId: null,
    serverVersion: null
  }
  private device: Device | null = null
  private sessions = new Map<string, ActiveSession>()
  /** The detached `adb shell /data/local/tmp/frida-server` child we own.
   *  Closing this kills frida-server on the device too, because adb's
   *  shell service tears down its child when the client disconnects. */
  private serverChild: ChildProcess | null = null

  constructor() {
    bus.on('device:activeChanged', ({ serial }) => {
      const current = this.status.deviceId
      if (!current || current === serial) return
      getLogger().info('frida: active device changed, stopping previous session', {
        previous: current,
        next: serial
      })
      void this.stopServer().catch((err) => {
        getLogger().warn('frida: failed to stop after active device change', {
          error: err instanceof Error ? err.message : String(err)
        })
      })
    })
  }

  getStatus(): FridaStatus {
    return { ...this.status }
  }

  /**
   * Push, mark executable, and start frida-server on the given device.
   * Idempotent: kills any pre-existing instance first so reinstalls work.
   *
   * On any failure we surface the *actual* device-side output (chmod errors,
   * `--version` complaints, missing libc symbols, etc.) instead of a vague
   * "did not come up" — that diagnostic info is the difference between
   * "I can fix this" and "now what".
   */
  async installServer(serial: string, deviceAbi: string | null = null): Promise<void> {
    const log = getLogger()
    this.setStatus({ ...this.status, state: 'connecting', errorMessage: undefined })

    try {
      // Resolve the right frida-server binary for the device's CPU. The
      // previous implementation looked up a single bundled `frida-server`
      // under tools/frida/, which only ever matched whichever ABI the
      // toolchain happened to fetch (x86_64 in our manifest). For a real
      // ARM device that binary is useless. `ensureFridaServerForAbi` looks
      // up the per-ABI cache at tools/frida/<abi>/frida-server, downloads
      // and decompresses from GitHub releases when the cache is cold, and
      // returns a known-good local path.
      const localBin = await ensureFridaServerForAbi(deviceAbi, log)

      // 1. Sanity-check the local binary. A botched xz extract or a partial
      //    download produces something that looks fine to existsSync but
      //    silently fails to execute on device. Cheap to check, expensive
      //    to debug.
      const localStat = statSync(localBin)
      if (localStat.size < 1_000_000) {
        throw new Error(
          `Local frida-server binary is suspiciously small (${localStat.size} bytes). Reinstall "Frida server" from Settings.`
        )
      }
      const head = readFileSync(localBin, { encoding: null }).subarray(0, 4)
      if (head[0] !== 0x7f || head[1] !== 0x45 || head[2] !== 0x4c || head[3] !== 0x46) {
        throw new Error(
          'Local frida-server is not an ELF binary (missing 0x7F 45 4C 46 magic). The xz extract probably failed — reinstall from Settings.'
        )
      }
      log.info('frida: local binary looks valid', { path: localBin, bytes: localStat.size })

      // 2. adb root so we can write to /data/local/tmp and run as root.
      try {
        await adbRoot(serial)
      } catch (err) {
        throw new Error(
          `adb root failed (needed to run frida-server as root): ${
            err instanceof Error ? err.message : String(err)
          }`
        )
      }

      // 3. Push + chmod.
      const devicePath = '/data/local/tmp/frida-server'
      log.info('frida: pushing frida-server', { from: localBin, to: devicePath })
      await pushFile(serial, localBin, devicePath)
      const chmodRes = await shell(serial, `chmod 755 ${devicePath}`)
      if (chmodRes.exitCode !== 0) {
        throw new Error(
          `chmod failed on /data/local/tmp/frida-server: ${chmodRes.stderr.trim() || chmodRes.stdout.trim()}`
        )
      }

      // 4. Probe the binary with --version. This is a fast end-to-end check:
      //    if the architecture is wrong, the linker missing, or the file
      //    corrupted, we get a real error message we can show the user.
      log.info('frida: probing frida-server --version')
      const versionRes = await shell(serial, `${devicePath} --version`)
      if (versionRes.exitCode !== 0) {
        const stderr = versionRes.stderr.trim() || versionRes.stdout.trim()
        throw new Error(
          `frida-server --version failed (exit ${versionRes.exitCode}): ${
            stderr || 'no output'
          }. The binary may not match the device architecture (try restarting Frida after switching devices/AVDs), or the system image lacks a required libc.`
        )
      }
      const serverVersion = versionRes.stdout.trim()
      log.info('frida: server reports version', { version: serverVersion })

      // 5. Kill any previous instance — both our tracked child and any
      //    leftover server from a previous run. Brief settle.
      this.killServerChild()
      await shell(serial, 'killall -q frida-server').catch(() => undefined)
      await sleep(300)

      // 6. Start frida-server as a detached child of *our* process. We do
      //    NOT use `frida-server -D` because some builds either don't honour
      //    that flag or daemonize without releasing the adb stdio handles,
      //    leaving the adb shell hung indefinitely. Instead we run the
      //    server in the foreground via adb shell, but as a child we hold
      //    on to and unref — so the spawn returns instantly and the server
      //    lives until we (or app exit) kill it.
      const adbBin = resolveAdbPath()
      if (!adbBin) {
        throw new Error('adb is not installed.')
      }
      log.info('frida: spawning detached frida-server', { adbBin, serial })
      const child = spawn(adbBin, ['-s', serial, 'shell', devicePath], {
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      })
      this.serverChild = child

      // Capture early stderr/stdout so a fast-crashing server has somewhere
      // to put its words. The buffer is bounded at 4 KiB to avoid bloat.
      const earlyOutput: string[] = []
      const capture = (chunk: Buffer): void => {
        const text = chunk.toString('utf8')
        earlyOutput.push(text)
        if (earlyOutput.join('').length > 4096) earlyOutput.shift()
      }
      child.stdout?.on('data', capture)
      child.stderr?.on('data', capture)
      child.on('error', (err) => {
        log.warn('frida: adb child error', { error: err.message })
      })
      child.on('exit', (code, signal) => {
        log.info('frida: adb child for frida-server exited', { code, signal })
        if (this.serverChild === child) this.serverChild = null
      })
      if (process.platform !== 'win32') child.unref()

      // 7. Wait for frida-server to actually be alive on device. If the
      //    adb child exits early, surface what it printed instead of
      //    grinding through the full poll window.
      let ready = false
      for (let i = 0; i < 30; i++) {
        if (!this.serverChild || child.exitCode !== null) break
        const res = await shell(serial, 'pgrep -x frida-server').catch(() => null)
        if (res && res.exitCode === 0 && res.stdout.trim().length > 0) {
          ready = true
          break
        }
        await sleep(250)
      }
      if (!ready) {
        const captured = earlyOutput.join('').trim()
        const exited = child.exitCode !== null
        const logcatRes = await shell(serial, 'logcat -d -t 100 -s frida-server:*').catch(
          () => null
        )
        const tail = logcatRes?.stdout.trim().split('\n').slice(-10).join('\n') ?? ''
        this.killServerChild()
        throw new Error(
          [
            exited
              ? `adb shell exited (code ${child.exitCode}, signal ${child.signalCode ?? 'none'}) before frida-server bound.`
              : 'frida-server is not visible to pgrep yet.',
            captured ? `Captured output:\n${captured}` : '',
            tail ? `Recent logcat:\n${tail}` : ''
          ]
            .filter(Boolean)
            .join('\n\n')
        )
      }
      log.info('frida: server is up')

      await this.connect(serial)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.warn('frida: install/start failed', { serial, error: message })
      this.killServerChild()
      this.device = null
      this.setStatus({
        state: 'error',
        deviceId: serial,
        serverVersion: null,
        errorMessage: message
      })
      throw err
    }
  }

  /** Best-effort SIGTERM/taskkill on our held adb child. The adb daemon
   *  tears the shell down with it, killing frida-server on the device. */
  private killServerChild(): void {
    const child = this.serverChild
    if (!child) return
    try {
      if (process.platform === 'win32') {
        if (child.pid) {
          spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
            windowsHide: true
          })
        }
      } else if (child.pid) {
        // negative pid = whole process group (we set detached: true on POSIX)
        try {
          process.kill(-child.pid, 'SIGTERM')
        } catch {
          child.kill('SIGTERM')
        }
      }
    } catch {
      // ignore
    }
    this.serverChild = null
  }

  private async detachAllSessions(reason: string): Promise<void> {
    const entries = Array.from(this.sessions.entries())
    for (const [sessionId, entry] of entries) {
      try {
        await entry.script?.unload()
      } catch (err) {
        getLogger().debug('frida: script unload during stop failed', {
          sessionId,
          error: err instanceof Error ? err.message : String(err)
        })
      }
      try {
        await entry.session.detach()
      } catch (err) {
        getLogger().debug('frida: session detach during stop failed', {
          sessionId,
          error: err instanceof Error ? err.message : String(err)
        })
      }
      this.sessions.delete(sessionId)
      bus.emit('frida:console', {
        sessionId,
        level: 'warn',
        text: `[session detached: ${reason}]`
      })
    }
  }

  /** Public stop entrypoint: detach sessions, kill adb child, and remove stray frida-server. */
  async stopServer(): Promise<void> {
    const serial = this.status.deviceId
    await this.detachAllSessions('frida-server stopped')
    this.killServerChild()
    if (serial) {
      await shell(serial, 'killall -q frida-server').catch((err: unknown) => {
        getLogger().debug('frida: killall during stop failed', {
          serial,
          error: err instanceof Error ? err.message : String(err)
        })
      })
    }
    this.setStatus({ state: 'disconnected', deviceId: null, serverVersion: null })
    this.device = null
  }

  /**
   * Attach the host-side frida bindings to the given ADB device. Doesn't
   * push or start the server — call `installServer` for the full flow.
   */
  async connect(serial: string): Promise<void> {
    const log = getLogger()
    this.setStatus({ ...this.status, state: 'connecting', deviceId: serial })

    try {
      const device = await frida.getDevice(serial)
      this.device = device
      // Tiny smoke test: enumerate one process to confirm the protocol
      // handshake works. If frida-node's ABI is wrong, this throws before
      // we mislead the user about being connected.
      await device.enumerateProcesses({ scope: Scope.Minimal })
      // Frida exposes the server's reported version via system parameters.
      let serverVersion: string | null = null
      try {
        const params = (await device.querySystemParameters()) as Record<string, unknown>
        const version = params['version']
        if (typeof version === 'string') serverVersion = version
      } catch {
        // best-effort — older frida-server builds may not expose version.
      }
      this.setStatus({
        state: 'connected',
        deviceId: serial,
        serverVersion
      })
      log.info('frida: connected', { device: serial, version: serverVersion })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.warn('frida: connect failed', { error: message })
      this.setStatus({
        state: 'error',
        deviceId: serial,
        serverVersion: null,
        errorMessage: message
      })
      throw err
    }
  }

  async listProcesses(): Promise<FridaProcess[]> {
    if (!this.device) throw new Error('Not connected to frida-server yet.')

    // We want two views in one list:
    //   1. Every *installed* Android app, running or not. `enumerateApplications`
    //      returns these with pid=0 for the ones that aren't currently up — that
    //      way an app the user just installed (and hasn't launched yet) still
    //      shows up so they can spawn it from the UI.
    //   2. Every live process the device is willing to enumerate. Covers the
    //      system natives that don't have an identifier at all.
    //
    // We merge the two streams and dedupe by pid: when an app is running, the
    // application entry already carries its pid, so we hide the bare process
    // row to avoid duplicates.
    const [apps, procs] = await Promise.all([
      this.device.enumerateApplications({ scope: Scope.Metadata }).catch((err: unknown) => {
        getLogger().warn('frida: enumerateApplications failed', {
          error: err instanceof Error ? err.message : String(err)
        })
        return [] as Application[]
      }),
      this.device.enumerateProcesses({ scope: Scope.Metadata })
    ])

    const claimedPids = new Set<number>()
    const out: FridaProcess[] = []
    for (const a of apps) {
      out.push({
        pid: a.pid,
        name: a.name,
        identifier: a.identifier
      })
      if (a.pid > 0) claimedPids.add(a.pid)
    }
    for (const p of procs) {
      if (claimedPids.has(p.pid)) continue
      out.push({
        pid: p.pid,
        name: p.name,
        identifier: extractAppIdentifier(p)
      })
    }

    // Sort: apps (have identifier) first, then everything else; alphabetical
    // within each group. Running apps and not-running apps interleave by name
    // so a freshly installed package sits next to its peers.
    return out.sort((a, b) => {
      const aIsApp = a.identifier != null
      const bIsApp = b.identifier != null
      if (aIsApp !== bIsApp) return aIsApp ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }

  async attach(pid: number, source: string): Promise<{ sessionId: string }> {
    if (!this.device) throw new Error('Not connected to frida-server yet.')
    if (!Number.isInteger(pid) || pid <= 0) throw new Error(`Invalid process pid: ${pid}`)
    const session = await this.device.attach(pid)
    const result = await this.bindSession(session, source)
    bus.emit('frida:console', {
      sessionId: result.sessionId,
      level: 'info',
      text: `[script loaded into pid ${pid}]`
    })
    return result
  }

  async spawn(identifier: string, source: string): Promise<{ sessionId: string }> {
    if (!this.device) throw new Error('Not connected to frida-server yet.')
    // Spawn → attach → load → resume. The script is loaded into the
    // suspended process before we resume, so its hooks observe the very
    // first instructions of the app's `Application.onCreate`. We surface
    // each lifecycle step to the console because they're load-bearing and
    // a silent failure here (e.g. the app self-destructs right after
    // resume, common with anti-tamper builds) is otherwise invisible.
    const pkg = identifier.trim()
    if (!isSafeAndroidPackageName(pkg))
      throw new Error(`Invalid Android package name: ${identifier}`)
    const pid = await this.device.spawn(pkg)
    const session = await this.device.attach(pid)
    const result = await this.bindSession(session, source)
    bus.emit('frida:console', {
      sessionId: result.sessionId,
      level: 'info',
      text: `[script loaded into pid ${pid}; resuming process]`
    })
    await this.device.resume(pid)
    bus.emit('frida:console', {
      sessionId: result.sessionId,
      level: 'info',
      text: `[pid ${pid} resumed — if no hook output appears within a few seconds, the app may be exiting on Frida detection or its ART runtime hasn't reached your hooked classes yet. Try the "Launch & attach" run mode for a more compatible path.]`
    })
    return result
  }

  /**
   * Launch the app the *normal* way, wait for it to be fully running,
   * then attach to the live process and load the script.
   *
   * This is the robust alternative to `spawn` for apps where the
   * spawn-before-resume instrumentation never sees ART come up:
   * multi-process / re-execing apps, aggressive anti-tamper, and ARM
   * builds running under x86 translation. Because we attach to an
   * already-running process, the Java VM is guaranteed to be
   * initialized and the `Java` global is defined + available — so
   * scripts that touch `Java` at top level (most CodeShare scripts)
   * stop throwing `ReferenceError: 'Java' is not defined`.
   *
   * The trade-off vs spawn: we can't hook the very first instructions
   * of `Application.onCreate`. For everything that runs after the app
   * is on screen — which is almost everything an analyst cares about —
   * this is strictly more reliable.
   */
  /**
   * Resolve a running app's pid by its exact package identifier — robust to
   * the 15-char Linux comm truncation that breaks Frida process-name
   * matching. Tries Frida's application list (carries the full package id),
   * then `adb pidof`, then a defensive process-name fallback that accounts
   * for the truncated comm. Returns 0 when the app isn't running yet.
   */
  private async resolveRunningPid(identifier: string): Promise<number> {
    if (!this.device) return 0

    // 1. Frida applications — `identifier` is the exact package id.
    try {
      const apps = await this.device.enumerateApplications({ scope: Scope.Minimal })
      const app = apps.find((a) => a.identifier === identifier && a.pid > 0)
      if (app) return app.pid
    } catch {
      /* fall through */
    }

    // 2. adb pidof — exact, immune to comm truncation.
    const serial = this.status.deviceId
    if (serial) {
      const res = await shell(serial, `pidof ${quoteShellArg(identifier)}`).catch(() => null)
      if (res && res.exitCode === 0) {
        const first = res.stdout.trim().split(/\s+/)[0]
        const pid = Number(first)
        if (Number.isFinite(pid) && pid > 0) return pid
      }
    }

    // 3. Process list, accepting the truncated comm (it's the tail/prefix of
    //    the package id) so we still match long-named packages.
    try {
      const procs = await this.device.enumerateProcesses({ scope: Scope.Minimal })
      const proc = procs.find(
        (p) =>
          p.name === identifier ||
          (p.name.length >= 15 && (identifier.endsWith(p.name) || identifier.startsWith(p.name)))
      )
      if (proc) return proc.pid
    } catch {
      /* give up */
    }
    return 0
  }

  async launchAndAttach(identifier: string, source: string): Promise<{ sessionId: string }> {
    if (!this.device) throw new Error('Not connected to frida-server yet.')
    const serial = this.status.deviceId
    if (!serial) throw new Error('No device serial on the active Frida connection.')
    const pkg = identifier.trim()
    if (!isSafeAndroidPackageName(pkg)) {
      throw new Error(`Invalid Android package name: ${identifier}`)
    }
    const log = getLogger()

    bus.emit('frida:console', {
      sessionId: 'launch',
      level: 'info',
      text: `[launch] starting ${pkg} on the device…`
    })
    // `monkey` reliably launches whatever the package's LAUNCHER activity
    // is without us needing to know the activity name. If the package has
    // no launcher (rare for apps you'd test), fall back to a generic
    // start so at least the process comes up.
    const monkeyRes = await shell(
      serial,
      `monkey -p ${quoteShellArg(pkg)} -c android.intent.category.LAUNCHER 1`
    ).catch(() => null)
    if (!monkeyRes || monkeyRes.exitCode !== 0) {
      await shell(serial, `am start -S ${quoteShellArg(`${pkg}/.MainActivity`)}`).catch(
        () => undefined
      )
    }

    // Poll for the app's main process to appear, resolving its pid by the
    // exact package identifier. We must NOT match on Frida's process
    // `name`: Linux truncates a process's comm to 15 chars (e.g.
    // `com.app.damnvulnerablebank` → `nvulnerablebank`), so name-equality
    // silently fails for every package id longer than 15 characters.
    let pid = 0
    for (let i = 0; i < 40; i++) {
      pid = await this.resolveRunningPid(pkg)
      if (pid > 0) break
      await sleep(500)
    }
    if (!pid) {
      throw new Error(
        `${pkg} didn't come up as a running process within 20s. Make sure it launches normally on the device (try opening it by hand), then select its running row and use Attach.`
      )
    }

    // ART is up by the time the process is listed, but give the app a
    // brief moment to finish wiring its Application/first Activity so
    // class loaders the script targets are present.
    await sleep(800)
    bus.emit('frida:console', {
      sessionId: 'launch',
      level: 'info',
      text: `[launch] attaching to running pid ${pid}…`
    })
    const session = await this.device.attach(pid)
    const result = await this.bindSession(session, source)
    bus.emit('frida:console', {
      sessionId: result.sessionId,
      level: 'info',
      text: `[launch] script loaded into running pid ${pid} (ART already initialized)`
    })
    log.info('frida: launch-and-attach complete', { identifier: pkg, pid })
    return result
  }

  /**
   * Run the intelligence agent against a target and return its App
   * Intelligence Report.
   *
   * Reuses the existing attach / spawn / launch-attach injection paths —
   * so every bit of their robustness (ART-readiness waits, the
   * launch-attach fallback for hardened apps) applies here too — then
   * calls the agent's `profile()` rpc export and resolves the structured
   * report. The recon session is intentionally left alive so the user can
   * immediately apply bypasses or tracers in the same session.
   */
  /**
   * Inject the intelligence agent against a target and return a live
   * session + its script handle. Shared by reconnaissance() and autoPwn().
   * Reuses attach / spawn / launch-attach so all their robustness applies.
   */
  private async loadAgentSession(opts: {
    pid?: number
    identifier?: string | null
    method?: 'attach' | 'spawn' | 'launch-attach'
  }): Promise<{ sessionId: string; script: Script; method: 'attach' | 'spawn' | 'launch-attach' }> {
    if (!this.device) throw new Error('Not connected to frida-server yet.')
    const source = loadFridaAgentSource()

    // Default: attach to a live pid, else launch-and-attach by package
    // (the most compatible path for not-yet-running / hardened apps).
    const method: 'attach' | 'spawn' | 'launch-attach' =
      opts.method ?? (opts.pid && opts.pid > 0 ? 'attach' : 'launch-attach')

    let sessionId: string
    if (method === 'attach') {
      if (!opts.pid || opts.pid <= 0) throw new Error('Agent attach needs a running process pid.')
      sessionId = (await this.attach(opts.pid, source)).sessionId
    } else if (method === 'spawn') {
      if (!opts.identifier) throw new Error('Agent spawn needs a package identifier.')
      sessionId = (await this.spawn(opts.identifier, source)).sessionId
    } else {
      if (!opts.identifier) throw new Error('Agent launch needs a package identifier.')
      sessionId = (await this.launchAndAttach(opts.identifier, source)).sessionId
    }

    const entry = this.sessions.get(sessionId)
    if (!entry || !entry.script) {
      throw new Error(
        'Agent session ended before it could run — the app may be exiting on detection.'
      )
    }
    return { sessionId, script: entry.script, method }
  }

  /** Look up an existing session and the named export on its agent script. */
  private agentExport(sessionId: string, name: string): (...args: unknown[]) => Promise<unknown> {
    const entry = this.sessions.get(sessionId)
    if (!entry || !entry.script) throw new Error(`No active session ${sessionId}`)
    const fn = entry.script.exports[name]
    if (typeof fn !== 'function') {
      throw new Error(
        `This session is not running the MobSec intelligence agent (no ${name}() export). Run Recon or Auto-Pwn to load it.`
      )
    }
    return fn
  }

  async reconnaissance(opts: {
    pid?: number
    identifier?: string | null
    method?: 'attach' | 'spawn' | 'launch-attach'
  }): Promise<ReconResult> {
    const { sessionId, script, method } = await this.loadAgentSession(opts)
    bus.emit('frida:console', {
      sessionId,
      level: 'info',
      text: '[recon] intelligence agent loaded — profiling target…'
    })

    const profileFn = script.exports.profile
    if (typeof profileFn !== 'function') {
      throw new Error(
        'Intelligence agent did not expose a profile() export — the agent bundle may be stale. Run `pnpm build:agent` and rebuild.'
      )
    }

    let report: AppIntelligenceReport
    try {
      report = (await profileFn({
        injection: method,
        identifier: opts.identifier ?? null
      })) as AppIntelligenceReport
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      bus.emit('frida:console', {
        sessionId,
        level: 'error',
        text: `[recon] profiling failed: ${msg}`
      })
      throw new Error(`Reconnaissance failed: ${msg}`)
    }

    report.injection = method
    if (opts.identifier) report.identifier = opts.identifier

    bus.emit('frida:console', {
      sessionId,
      level: 'info',
      text: `[recon] complete — framework=${report.framework.label}, ${report.security.length} control(s), ${report.networking.length} net lib(s) in ${report.durationMs}ms`
    })
    return { sessionId, report }
  }

  /**
   * One-click Auto-Pwn: inject the agent, profile the target, then apply the
   * *safe* applicable bypass stack and return the report + results.
   *
   * Profiling and applying are two separate agent calls on purpose: the
   * report is captured first, so if a bypass later destabilises the app the
   * user still gets the full intelligence (and a clear note) rather than a
   * misleading failure. Risky/native strategies (anti-anti-Frida libc hooks,
   * Flutter BoringSSL patching) are NOT auto-applied — they're manual-only
   * from the bypass checklist.
   */
  async autoPwn(opts: {
    pid?: number
    identifier?: string | null
    method?: 'attach' | 'spawn' | 'launch-attach'
  }): Promise<AutoPwnResult> {
    const { sessionId, script, method } = await this.loadAgentSession(opts)
    bus.emit('frida:console', {
      sessionId,
      level: 'info',
      text: '[auto-pwn] agent loaded — profiling target…'
    })

    const profileFn = script.exports.profile
    if (typeof profileFn !== 'function') {
      throw new Error(
        'Intelligence agent did not expose a profile() export — the agent bundle may be stale. Run `pnpm build:agent` and rebuild.'
      )
    }

    let report: AppIntelligenceReport
    try {
      report = (await profileFn({
        injection: method,
        identifier: opts.identifier ?? null
      })) as AppIntelligenceReport
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      bus.emit('frida:console', {
        sessionId,
        level: 'error',
        text: `[auto-pwn] profiling failed: ${msg}`
      })
      throw new Error(`Auto-Pwn failed: ${msg}`)
    }
    report.injection = method
    if (opts.identifier) report.identifier = opts.identifier

    // Apply the safe bypass stack separately — a strategy that exits the app
    // must never cost us the already-captured report.
    let results: StrategyResult[] = []
    const autoApplyFn = script.exports.autoApply
    if (typeof autoApplyFn === 'function') {
      bus.emit('frida:console', {
        sessionId,
        level: 'info',
        text: '[auto-pwn] applying the safe bypass stack…'
      })
      try {
        results = (await autoApplyFn()) as StrategyResult[]
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        bus.emit('frida:console', {
          sessionId,
          level: 'warn',
          text: `[auto-pwn] bypass application did not complete (the app may have exited or detected instrumentation): ${msg}`
        })
      }
    }

    const totalHooks = results.reduce((n, r) => n + r.hooksInstalled, 0)
    const applied = results.filter((r) => r.applied).length
    bus.emit('frida:console', {
      sessionId,
      level: 'info',
      text: `[auto-pwn] complete — framework=${report.framework.label}, ${applied}/${results.length} strategy(ies) applied, ${totalHooks} hook(s)`
    })
    return { sessionId, report, results }
  }

  /** Apply specific strategies to an existing agent session (manual control). */
  async applyStrategies(sessionId: string, ids: string[]): Promise<ApplyStrategiesResult> {
    const fn = this.agentExport(sessionId, 'applyStrategies')
    const results = (await fn(ids)) as StrategyResult[]
    const totalHooks = results.reduce((n, r) => n + r.hooksInstalled, 0)
    bus.emit('frida:console', {
      sessionId,
      level: 'info',
      text: `[bypass] applied ${results.length} strategy(ies), ${totalHooks} hook(s)`
    })
    return { sessionId, results }
  }

  /** Enumerate strategies + applicability for an existing agent session. */
  async listStrategies(sessionId: string): Promise<StrategyInfo[]> {
    const fn = this.agentExport(sessionId, 'listStrategies')
    return (await fn()) as StrategyInfo[]
  }

  /** Generic typed call into an agent rpc export on a live session. */
  private async callAgent<T>(sessionId: string, name: string, ...args: unknown[]): Promise<T> {
    const fn = this.agentExport(sessionId, name)
    return (await fn(...args)) as T
  }

  // --- Deep discovery & live tracing ---------------------------------
  listTracers(sessionId: string): Promise<TracerInfo[]> {
    return this.callAgent<TracerInfo[]>(sessionId, 'listTracers')
  }
  startTracer(sessionId: string, id: string): Promise<TracerInfo[]> {
    return this.callAgent<TracerInfo[]>(sessionId, 'startTracer', id)
  }
  stopTracer(sessionId: string, id: string): Promise<TracerInfo[]> {
    return this.callAgent<TracerInfo[]>(sessionId, 'stopTracer', id)
  }
  enumerateClasses(sessionId: string, filter: string, limit?: number): Promise<ClassSearchResult> {
    return this.callAgent<ClassSearchResult>(sessionId, 'enumerateClasses', filter, limit)
  }
  listMethods(sessionId: string, className: string): Promise<ClassMethodInfo> {
    return this.callAgent<ClassMethodInfo>(sessionId, 'listMethods', className)
  }
  traceClass(sessionId: string, className: string): Promise<{ ok: boolean; hooked: number }> {
    return this.callAgent<{ ok: boolean; hooked: number }>(sessionId, 'traceClass', className)
  }
  untraceClass(sessionId: string, className: string): Promise<void> {
    return this.callAgent<void>(sessionId, 'untraceClass', className)
  }
  chooseInstances(sessionId: string, className: string, limit?: number): Promise<HeapInstance[]> {
    return this.callAgent<HeapInstance[]>(sessionId, 'chooseInstances', className, limit)
  }
  traceNative(sessionId: string, moduleName: string, symbol: string): Promise<{ ok: boolean }> {
    return this.callAgent<{ ok: boolean }>(sessionId, 'traceNative', moduleName, symbol)
  }
  untraceNative(sessionId: string, moduleName: string, symbol: string): Promise<void> {
    return this.callAgent<void>(sessionId, 'untraceNative', moduleName, symbol)
  }
  listActiveTraces(sessionId: string): Promise<ActiveTrace[]> {
    return this.callAgent<ActiveTrace[]>(sessionId, 'listActiveTraces')
  }

  /** Evaluate a JS expression in the session's Frida runtime context.
   *  Works for both agent sessions and user scripts (the REPL shim is
   *  appended to all user-provided sources at load time). */
  async evalCode(sessionId: string, code: string): Promise<{ ok: boolean; value: string }> {
    const entry = this.sessions.get(sessionId)
    if (!entry || !entry.script) throw new Error(`No active session: ${sessionId}`)
    const evalFn = entry.script.exports.rpcEval
    if (typeof evalFn !== 'function') {
      throw new Error(
        'REPL eval is not available for this session. The script may have loaded before this feature was added — detach and re-attach to enable it.'
      )
    }
    const result = await evalFn(code)
    return result as { ok: boolean; value: string }
  }

  async detach(sessionId: string): Promise<void> {
    const entry = this.sessions.get(sessionId)
    if (!entry) return
    try {
      await entry.script?.unload()
    } catch {
      // ignore
    }
    try {
      await entry.session.detach()
    } catch {
      // ignore
    }
    this.sessions.delete(sessionId)
  }

  async loadScript(sessionId: string, source: string): Promise<void> {
    const entry = this.sessions.get(sessionId)
    if (!entry) throw new Error(`No active session ${sessionId}`)
    if (entry.script) {
      try {
        await entry.script.unload()
      } catch {
        // ignore
      }
      entry.script = null
    }
    const script = await entry.session.createScript(withReplShim(withJavaBridge(source)))
    this.wireScriptMessages(sessionId, script)
    await script.load()
    entry.script = script
  }

  async listBuiltinScripts(): Promise<FridaScript[]> {
    // Built-in scripts ship as files under `resources/frida-scripts/`. We
    // read them lazily because some are sizeable and the renderer rarely
    // needs all six at once.
    const dir = locateBuiltinScriptsDir()
    if (!dir) return []
    const { readdirSync, readFileSync } = await import('node:fs')
    const out: FridaScript[] = []
    for (const filename of readdirSync(dir)) {
      if (!filename.endsWith('.js')) continue
      const fullPath = join(dir, filename)
      const text = readFileSync(fullPath, 'utf8')
      const meta = parseScriptMetadata(text, filename)
      out.push({
        id: filename.replace(/\.js$/, ''),
        name: meta.name,
        description: meta.description,
        source: text,
        category: 'builtin'
      })
    }
    return out.sort((a, b) => a.name.localeCompare(b.name))
  }

  private async bindSession(session: Session, source: string): Promise<{ sessionId: string }> {
    const sessionId = randomUUID()
    this.sessions.set(sessionId, { session, script: null })
    session.detached.connect((reason) => {
      getLogger().info('frida session detached', { sessionId, reason })
      this.sessions.delete(sessionId)
      bus.emit('frida:console', {
        sessionId,
        level: 'warn',
        text: `[session detached: ${reason}]`
      })
    })
    const script = await session.createScript(withReplShim(withJavaBridge(source)))
    this.wireScriptMessages(sessionId, script)
    await script.load()
    const entry = this.sessions.get(sessionId)
    if (entry) entry.script = script
    return { sessionId }
  }

  private wireScriptMessages(sessionId: string, script: Script): void {
    script.message.connect((message, data) => {
      // frida-node's typed Message union only declares 'send' and 'error',
      // but some builds also emit `type: 'log'` through this channel
      // (especially when no logHandler is installed yet). Reading the type
      // through a widening cast lets us defensively handle the third case
      // without TS narrowing us into `never`.
      const type = (message as { type?: string }).type
      if (type === 'send') {
        const payload = (message as { payload?: unknown }).payload
        // Structured MobSec intelligence-agent envelope? Route it by kind.
        // Plain-string / arbitrary-JSON payloads from user & CodeShare
        // scripts fall through to the existing console path untouched, so
        // nothing about the legacy behaviour changes.
        if (isAgentMessage(payload)) {
          this.routeAgentMessage(sessionId, payload)
          return
        }
        const text =
          typeof payload === 'string' ? payload : JSON.stringify(payload ?? null, null, 2)
        bus.emit('frida:console', {
          sessionId,
          level: 'info',
          text: data && data.length ? `${text} [+ ${data.length} bytes]` : text
        })
      } else if (type === 'error') {
        const err = message as {
          description?: string
          stack?: string
          fileName?: string
          lineNumber?: number
        }
        const text = [
          err.description ?? 'error',
          err.fileName ? `@ ${err.fileName}:${err.lineNumber ?? '?'}` : '',
          err.stack
        ]
          .filter(Boolean)
          .join('\n')
        bus.emit('frida:scriptError', { sessionId, error: text })
        bus.emit('frida:console', { sessionId, level: 'error', text })
      } else if (type === 'log') {
        const m = message as { level?: string; payload?: unknown }
        const text = typeof m.payload === 'string' ? m.payload : JSON.stringify(m.payload ?? null)
        const level: 'info' | 'warn' | 'error' =
          m.level === 'error' ? 'error' : m.level === 'warning' ? 'warn' : 'info'
        bus.emit('frida:console', { sessionId, level, text })
      }
    })
    // Frida's script forwards `console.log` via logHandler when one is set —
    // the `message` handler above never sees `type: 'log'` in that case.
    script.logHandler = (level: string, text: string) => {
      const mapped = level === 'error' || level === 'warning' ? level : 'info'
      bus.emit('frida:console', {
        sessionId,
        level: mapped === 'warning' ? 'warn' : (mapped as 'info' | 'error'),
        text
      })
    }
  }

  /**
   * Route a structured `{ __mobsec: 1 }` message from the intelligence
   * agent into the Frida console. Channel-tagged (`[recon]`, `[bypass]`…)
   * so the renderer can colour-code and filter. Never throws.
   */
  private routeAgentMessage(sessionId: string, msg: AgentMessage): void {
    if (msg.kind === 'log') {
      const level: 'info' | 'warn' | 'error' =
        msg.level === 'error' ? 'error' : msg.level === 'warn' ? 'warn' : 'info'
      bus.emit('frida:console', { sessionId, level, text: `[${msg.channel}] ${msg.text}` })
    } else if (msg.kind === 'ready') {
      bus.emit('frida:console', {
        sessionId,
        level: 'info',
        text: `[agent] ready v${msg.agentVersion} (rpc: ${msg.api.join(', ')})`
      })
    } else if (msg.kind === 'finding') {
      const level: 'info' | 'warn' | 'error' =
        msg.severity === 'critical' || msg.severity === 'high'
          ? 'error'
          : msg.severity === 'medium'
            ? 'warn'
            : 'info'
      bus.emit('frida:console', {
        sessionId,
        level,
        text: `[${msg.channel}] ${msg.title} — ${msg.detail}`
      })
    } else if (msg.kind === 'event') {
      // Structured instrumentation event → the Live Events feed.
      bus.emit('frida:event', {
        sessionId,
        channel: msg.channel,
        category: msg.category,
        summary: msg.summary,
        detail: msg.detail,
        meta: msg.meta,
        severity: msg.severity,
        ts: msg.ts
      })
    }
  }

  private setStatus(next: FridaStatus): void {
    this.status = next
    bus.emit('frida:status', next)
  }
}

/**
 * Resolve a frida-server binary that matches the active device's ABI.
 *
 * Lookup order:
 *   1. Per-ABI cache: `tools/frida/<abi>/frida-server` — populated by
 *      previous downloads. Returns immediately if present & valid.
 *   2. Legacy single-binary location: `tools/frida/frida-server`.
 *      Only used when the device's ABI matches what the user originally
 *      installed via the toolchain manifest (we can't tell from disk;
 *      we rely on the user picking a matching emulator). If the
 *      binary's ABI looks wrong for the device, we ignore it and
 *      download a fresh one to the per-ABI cache instead.
 *   3. Download from GitHub releases. We stream the .xz through
 *      `xz-decompress` so a 30 MB binary lands in ~3–8 seconds on a
 *      typical broadband connection. Progress shows in the Frida
 *      console.
 */
async function ensureFridaServerForAbi(
  deviceAbi: string | null,
  log: ReturnType<typeof getLogger>
): Promise<string> {
  const fridaAbi = mapAbiToFridaName(deviceAbi)
  if (!fridaAbi) {
    // No ABI info from the device — fall back to whichever binary the
    // user already installed. Better than throwing on the unknown ABI.
    const fallback = locateLegacyFridaServerBinary()
    if (fallback) return fallback
    throw new Error(
      `Cannot pick a frida-server binary for device ABI "${deviceAbi ?? 'unknown'}". Plug in a device adb can identify, or install Frida from Settings → External tools.`
    )
  }

  const cachedDir = join(getPaths().tools, 'frida', fridaAbi)
  const cachedPath = join(cachedDir, 'frida-server')
  if (existsSync(cachedPath)) {
    const stat = statSync(cachedPath)
    if (stat.size > 1_000_000) {
      log.info('frida: using cached server', { abi: fridaAbi, path: cachedPath })
      return cachedPath
    }
    // Truncated cache — overwrite below.
  }

  // Legacy path — fall through to download regardless, but mention it
  // in the log so a user who's been hitting it knows we noticed.
  const legacy = locateLegacyFridaServerBinary()
  if (legacy) {
    log.info(
      'frida: legacy single-binary install detected — downloading ABI-specific copy on top',
      {
        legacy,
        desired: fridaAbi
      }
    )
  }

  const url = `${FRIDA_RELEASE_BASE}/${FRIDA_VERSION}/frida-server-${FRIDA_VERSION}-android-${fridaAbi}.xz`
  log.info('frida: downloading server', { abi: fridaAbi, url })
  bus.emit('frida:console', {
    sessionId: 'install',
    level: 'info',
    text: `[install] downloading frida-server ${FRIDA_VERSION} for android-${fridaAbi} (~30 MB)…`
  })

  await mkdir(cachedDir, { recursive: true })
  await downloadAndDecompressXz(url, cachedPath, log)
  await chmod(cachedPath, 0o755).catch(() => undefined)

  const stat = statSync(cachedPath)
  log.info('frida: server cached', { abi: fridaAbi, path: cachedPath, bytes: stat.size })
  bus.emit('frida:console', {
    sessionId: 'install',
    level: 'info',
    text: `[install] frida-server-android-${fridaAbi} ready (${(stat.size / 1024 / 1024).toFixed(1)} MB at ${cachedPath})`
  })
  return cachedPath
}

function locateLegacyFridaServerBinary(): string | null {
  const candidates = [
    join(getPaths().tools, 'frida', 'frida-server'),
    join(getPaths().tools, 'frida-server')
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

/**
 * Map Android's reported primary ABI (`ro.product.cpu.abi`) to the
 * naming convention Frida uses in its release artefact filenames.
 *
 *   arm64-v8a   → arm64    (the modern default; nearly every phone)
 *   armeabi-v7a → arm      (legacy 32-bit ARM)
 *   armeabi     → arm      (rare; pre-VFP)
 *   x86_64      → x86_64   (emulator)
 *   x86         → x86      (legacy emulator)
 *
 * Returns null when we can't map the input — the caller falls back to
 * whatever the user already installed.
 */
function mapAbiToFridaName(abi: string | null): string | null {
  if (!abi) return null
  const normalised = abi.toLowerCase().replace(/_/g, '-')
  if (normalised === 'arm64-v8a') return 'arm64'
  if (normalised === 'armeabi-v7a' || normalised === 'armeabi') return 'arm'
  if (normalised === 'x86-64' || abi.toLowerCase() === 'x86_64') return 'x86_64'
  if (normalised === 'x86') return 'x86'
  return null
}

/**
 * Stream-decompress a .xz file from `url` directly into `dest`. We use
 * `fetch` (Node 20+ has it globally) so we get redirect-following for
 * free against GitHub release URLs, and pipe through xz-decompress's
 * web-stream API.
 */
async function downloadAndDecompressXz(
  url: string,
  dest: string,
  log: ReturnType<typeof getLogger>
): Promise<void> {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status} for ${url}`)
  }
  if (!response.body) {
    throw new Error(`Download failed: empty response body for ${url}`)
  }
  const xzStream = new XzReadableStream(response.body as unknown as ReadableStream<Uint8Array>)
  const reader = xzStream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    total += value.byteLength
  }
  const combined = Buffer.alloc(total)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.byteLength
  }
  // Cheap integrity check before we even write: every frida-server
  // binary starts with the ELF magic. A corrupted download lands on
  // disk perfectly readable but won't run on the device — better to
  // fail here than after the push.
  if (
    combined[0] !== 0x7f ||
    combined[1] !== 0x45 ||
    combined[2] !== 0x4c ||
    combined[3] !== 0x46
  ) {
    throw new Error(
      `Downloaded frida-server is not an ELF binary (magic ${combined.subarray(0, 4).toString('hex')}). The .xz decompression probably failed; retry the install.`
    )
  }
  writeFileSync(dest, combined)
  log.debug('frida: download complete', { url, dest, bytes: total })
}

function locateBuiltinScriptsDir(): string | null {
  const candidates = [
    join(getPaths().bundledResources, 'frida-scripts'),
    join(getPaths().bundledResources, 'resources', 'frida-scripts')
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

/** Locate the esbuild-bundled intelligence agent (resources/frida-agent/agent.js). */
function locateFridaAgentSource(): string | null {
  const candidates = [
    join(getPaths().bundledResources, 'frida-agent', 'agent.js'),
    join(getPaths().bundledResources, 'resources', 'frida-agent', 'agent.js')
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

/** Read the agent bundle, with an actionable error when it's missing. */
function loadFridaAgentSource(): string {
  const path = locateFridaAgentSource()
  if (!path) {
    throw new Error(
      'Frida intelligence agent bundle not found (expected resources/frida-agent/agent.js). Run `pnpm build:agent` and rebuild.'
    )
  }
  return readFileSync(path, 'utf8')
}

/** Locate the standalone Java-bridge shim bundle. */
function locateJavaBridgeSource(): string | null {
  const candidates = [
    join(getPaths().bundledResources, 'frida-agent', 'java-bridge.js'),
    join(getPaths().bundledResources, 'resources', 'frida-agent', 'java-bridge.js')
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

let cachedJavaBridge: string | null = null
function javaBridgeSource(): string {
  if (cachedJavaBridge !== null) return cachedJavaBridge
  const path = locateJavaBridgeSource()
  cachedJavaBridge = path ? readFileSync(path, 'utf8') : ''
  return cachedJavaBridge
}

/**
 * Frida 17 dropped the global `Java`/`ObjC` bridges, so raw built-in/user/
 * CodeShare scripts that reference `Java` see `undefined`. Prepend the
 * bundled bridge shim (which installs the global) to any such script.
 *
 * No-op for: the intelligence agent (it self-bundles the bridge), the shim
 * itself, and native-only scripts that never touch `Java`.
 */
function withJavaBridge(source: string): string {
  if (source.indexOf('MOBSEC_FRIDA_AGENT') !== -1) return source
  if (source.indexOf('MOBSEC_JAVA_BRIDGE') !== -1) return source
  if (!/\bJava\b/.test(source)) return source
  const bridge = javaBridgeSource()
  return bridge ? `${bridge}\n;\n${source}` : source
}

/** Appended to every user-written script so the interactive REPL console can
 *  call `rpcEval` even when the MobSec intelligence agent isn't loaded.
 *  Skipped for agent bundles (they expose rpcEval natively) and for scripts
 *  that already carry the shim. */
const REPL_SHIM = `
// MOBSEC_REPL_SHIM
;(function(){
  if (typeof rpc === 'undefined') return;
  var __prev = rpc.exports || {};
  if (typeof __prev.rpcEval === 'function') return;
  function __str(v) {
    if (v === undefined) return 'undefined';
    if (v === null) return 'null';
    if (typeof v === 'boolean' || typeof v === 'number') return String(v);
    if (typeof v === 'string') return JSON.stringify(v);
    if (typeof v === 'function') return '[Function: ' + (v.name || 'anonymous') + ']';
    try {
      return JSON.stringify(v, function(_k, x) {
        if (typeof x === 'function') return '[Function]';
        if (x !== null && typeof x === 'object') {
          try { var s = String(x); if (s !== '[object Object]') return s; } catch(e) {}
        }
        return x;
      }, 2);
    } catch(e2) { return String(v); }
  }
  rpc.exports = Object.assign(__prev, {
    rpcEval: function(code) {
      try {
        /* jshint ignore:start */
        var r = eval(code); // eslint-disable-line no-eval
        /* jshint ignore:end */
        if (r && typeof r === 'object' && typeof r.then === 'function') {
          return r.then(function(v){ return { ok: true, value: __str(v) }; })
                  .catch(function(e){ return { ok: false, value: String(e) }; });
        }
        return { ok: true, value: __str(r) };
      } catch(e) {
        return { ok: false, value: String(e) };
      }
    }
  });
})();
`

function withReplShim(source: string): string {
  if (source.indexOf('MOBSEC_FRIDA_AGENT') !== -1) return source
  if (source.indexOf('MOBSEC_REPL_SHIM') !== -1) return source
  return `${source}\n;\n${REPL_SHIM}`
}

interface BuiltinScriptMetadata {
  name: string
  description: string
}

/**
 * Extract a friendly name + one-line description from the leading JSDoc
 * block of a built-in script:
 *
 *     // @name SSL Pinning Bypass (universal)
 *     // @description Disables certificate pinning across OkHttp, Conscrypt, …
 */
function parseScriptMetadata(source: string, fallbackId: string): BuiltinScriptMetadata {
  const nameMatch = source.match(/^[ \t]*\/\/\s*@name\s+(.+)$/m)
  const descMatch = source.match(/^[ \t]*\/\/\s*@description\s+(.+)$/m)
  return {
    name: nameMatch?.[1]?.trim() ?? fallbackId,
    description: descMatch?.[1]?.trim() ?? ''
  }
}

function extractAppIdentifier(p: Process): string | null {
  // Frida's `metadata` scope returns `parameters.application` for app
  // processes; everything else (e.g. system services) returns undefined.
  const params = (p as Process & { parameters?: Record<string, unknown> }).parameters
  if (params && typeof params['application'] === 'string') {
    return params['application'] as string
  }
  return null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const fridaService = new FridaService()
