/**
 * Live logcat streaming.
 *
 * Spawns `adb -s <serial> logcat -v threadtime` against the active device,
 * parses each line into a structured `LogcatLine`, and emits batches onto
 * the event bus (`logcat:lines`) every ~120 ms so the renderer never gets
 * hammered with one IPC message per log line.
 *
 * Device-side filtering (buffers, `--pid` scope, and a `*:<minLevel>`
 * floor) keeps the volume down at the source; the renderer layers on the
 * rich level/tag/text filtering. The stream follows the active device and
 * survives an `adb root` restart.
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { isSafeAndroidPackageName, quoteShellArg, resolveAdbPath, runAdb, shell } from './adb'
import { deviceService } from './device'
import { bus } from '../utils/event-bus'
import { getLogger } from '../utils/logger'
import type { LogcatBuffer, LogcatLine, LogcatOptions, LogcatStatus, LogLevel } from '@shared/types'

const DEFAULT_OPTIONS: LogcatOptions = {
  buffers: ['main', 'system', 'crash'],
  minLevel: 'V',
  pid: null,
  tail: 500
}

const FLUSH_MS = 120
const VALID_LEVELS = new Set<LogLevel>(['V', 'D', 'I', 'W', 'E', 'F'])
const VALID_BUFFERS = new Set<LogcatBuffer>([
  'main',
  'system',
  'crash',
  'events',
  'radio',
  'kernel'
])

// threadtime format: "MM-DD HH:MM:SS.mmm   PID   TID L TAG: message"
const LINE_RE =
  /^(\d\d)-(\d\d) (\d\d):(\d\d):(\d\d)\.(\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEF])\s+(.*?):\s?(.*)$/

class LogcatService {
  private child: ChildProcess | null = null
  private remainder = ''
  private seq = 0
  private pending: LogcatLine[] = []
  private flushTimer: NodeJS.Timeout | null = null
  private options: LogcatOptions = { ...DEFAULT_OPTIONS }
  private serial: string | null = null
  private errorMessage: string | undefined

  constructor() {
    // An `adb root` restart severs the logcat socket — respawn on the same
    // device so the stream is self-healing.
    bus.on('device:adbRestarted', ({ serial }) => {
      if (this.child && this.serial === serial) {
        getLogger().info('logcat: adbd restarted — respawning', { serial })
        this.spawnStream()
      }
    })
    // Follow the active device: re-point the stream when it changes, stop
    // when there's no device left.
    bus.on('device:activeChanged', ({ serial }) => {
      if (!this.child) return
      if (serial && serial !== this.serial) {
        this.serial = serial
        this.spawnStream()
      } else if (!serial) {
        void this.stop()
      }
    })
  }

  getStatus(): LogcatStatus {
    return {
      running: this.child !== null,
      serial: this.serial,
      buffers: this.options.buffers,
      minLevel: this.options.minLevel,
      pid: this.options.pid,
      errorMessage: this.errorMessage
    }
  }

  async start(options?: Partial<LogcatOptions>): Promise<LogcatStatus> {
    this.options = { ...DEFAULT_OPTIONS, ...normalize(options) }
    const active = deviceService.getActive()
    this.serial = active && active.state === 'online' ? active.serial : null
    if (!this.serial) {
      throw new Error('No active device. Connect a phone or start the emulator first.')
    }
    this.errorMessage = undefined
    this.spawnStream()
    return this.getStatus()
  }

  async stop(): Promise<LogcatStatus> {
    this.killChild()
    this.stopFlush(true)
    bus.emit('logcat:status', this.getStatus())
    return this.getStatus()
  }

  /** Clear the device-side logcat buffers (`adb logcat -c`). */
  async clear(): Promise<void> {
    const active = deviceService.getActive()
    const serial = this.child
      ? this.serial
      : active && active.state === 'online'
        ? active.serial
        : null
    if (!serial) throw new Error('No active device.')
    const bufferArgs = this.options.buffers.flatMap((b) => ['-b', b])
    await runAdb(['-s', serial, 'logcat', ...bufferArgs, '-c'], 10_000)
  }

  /** Resolve a package's main pid for `--pid` scoping; null when not running. */
  async resolvePid(packageName: string): Promise<number | null> {
    const active = deviceService.getActive()
    const serial = active && active.state === 'online' ? active.serial : null
    const pkg = packageName.trim()
    if (!serial || !pkg) return null
    if (!isSafeAndroidPackageName(pkg)) {
      throw new Error('Enter a valid Android package name, for example com.example.app.')
    }
    const res = await shell(serial, `pidof ${quoteShellArg(pkg)}`).catch(() => null)
    if (!res || res.exitCode !== 0) return null
    const first = res.stdout.trim().split(/\s+/)[0]
    const pid = Number(first)
    return Number.isFinite(pid) && pid > 0 ? pid : null
  }

  // --- internals -----------------------------------------------------------

  private spawnStream(): void {
    this.killChild()
    const bin = resolveAdbPath()
    if (!bin) return this.fail('adb is not installed. Run the first-time setup in Settings.')
    if (!this.serial) return this.fail('No active device.')

    const args = ['-s', this.serial, 'logcat', '-v', 'threadtime', '-T', String(this.options.tail)]
    for (const b of this.options.buffers) args.push('-b', b)
    if (this.options.pid) args.push('--pid', String(this.options.pid))
    args.push(`*:${this.options.minLevel}`)

    getLogger().info('logcat: spawning', { args: args.join(' ') })
    let child: ChildProcess
    try {
      child = spawn(bin, args, { windowsHide: true })
    } catch (err) {
      return this.fail(err instanceof Error ? err.message : String(err))
    }

    this.child = child
    this.remainder = ''
    this.errorMessage = undefined
    let stderrTail = ''
    child.stdout?.on('data', (chunk: Buffer) => this.onData(chunk))
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8')
      stderrTail = trimTail(stderrTail + text)
      const trimmed = text.trim()
      if (trimmed) getLogger().debug('logcat: stderr', { text: trimmed })
    })
    child.on('error', (err) => {
      if (this.child === child) this.fail(err.message)
    })
    child.on('close', (code, signal) => {
      if (this.child !== child) return // superseded by a fresh spawn
      this.child = null
      this.stopFlush(true)
      getLogger().info('logcat: stream closed', { code, signal })
      if ((code && code !== 0) || signal) {
        this.errorMessage =
          stderrTail.trim() ||
          (signal ? `logcat exited after signal ${signal}` : `logcat exited with code ${code}`)
      }
      bus.emit('logcat:status', this.getStatus())
    })

    this.startFlush()
    bus.emit('logcat:status', this.getStatus())
  }

  private onData(chunk: Buffer): void {
    const text = this.remainder + chunk.toString('utf8')
    const parts = text.split('\n')
    this.remainder = parts.pop() ?? ''
    for (const raw of parts) {
      const line = raw.replace(/\r$/, '')
      if (line.length === 0) continue
      this.pending.push(this.parse(line))
    }
  }

  private parse(line: string): LogcatLine {
    const m = LINE_RE.exec(line)
    if (m) {
      const level = (m[9] && VALID_LEVELS.has(m[9] as LogLevel) ? m[9] : 'I') as LogLevel
      return {
        seq: this.seq++,
        timestamp: toTimestamp(m),
        level,
        pid: Number(m[7] ?? 0),
        tid: Number(m[8] ?? 0),
        tag: (m[10] ?? '').trim(),
        message: m[11] ?? ''
      }
    }
    // Separators ("--------- beginning of crash") and anything that doesn't
    // match are kept verbatim (no data loss) under a synthetic tag.
    const isSeparator = line.startsWith('---------')
    return {
      seq: this.seq++,
      timestamp: Date.now(),
      level: 'I',
      pid: 0,
      tid: 0,
      tag: isSeparator ? 'system' : 'raw',
      message: isSeparator ? line.replace(/^-+\s*/, '').replace(/\s*-+$/, '') : line
    }
  }

  private startFlush(): void {
    if (this.flushTimer) return
    this.flushTimer = setInterval(() => this.flush(), FLUSH_MS)
  }

  private stopFlush(finalFlush: boolean): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
    if (finalFlush) this.flush()
  }

  private flush(): void {
    if (this.pending.length === 0) return
    const batch = this.pending
    this.pending = []
    bus.emit('logcat:lines', batch)
  }

  private killChild(): void {
    if (this.child) {
      try {
        this.child.kill('SIGKILL')
      } catch {
        /* already gone */
      }
      this.child = null
    }
  }

  private fail(message: string): void {
    this.errorMessage = message
    this.killChild()
    this.stopFlush(false)
    getLogger().warn(`logcat: ${message}`)
    bus.emit('logcat:status', this.getStatus())
  }
}

function normalize(o?: Partial<LogcatOptions>): Partial<LogcatOptions> {
  if (!o) return {}
  const out: Partial<LogcatOptions> = {}
  if (Array.isArray(o.buffers) && o.buffers.length > 0) {
    const buffers = [...new Set(o.buffers)].filter((b): b is LogcatBuffer =>
      VALID_BUFFERS.has(b as LogcatBuffer)
    )
    if (buffers.length > 0) out.buffers = buffers
  }
  if (o.minLevel && VALID_LEVELS.has(o.minLevel)) out.minLevel = o.minLevel
  out.pid = typeof o.pid === 'number' && o.pid > 0 ? o.pid : null
  if (typeof o.tail === 'number' && o.tail >= 0) out.tail = Math.min(o.tail, 5000)
  return out
}

function trimTail(value: string, max = 2000): string {
  return value.length > max ? value.slice(value.length - max) : value
}

/** logcat dates have no year; assume the current one (back off if it lands
 *  in the future, e.g. parsing a December log on Jan 1). */
function toTimestamp(m: RegExpExecArray): number {
  const now = new Date()
  const year = now.getFullYear()
  const month = Number(m[1] ?? 1) - 1
  const day = Number(m[2] ?? 1)
  const hour = Number(m[3] ?? 0)
  const min = Number(m[4] ?? 0)
  const sec = Number(m[5] ?? 0)
  const ms = Number(m[6] ?? 0)
  let t = new Date(year, month, day, hour, min, sec, ms).getTime()
  if (t - now.getTime() > 86_400_000)
    t = new Date(year - 1, month, day, hour, min, sec, ms).getTime()
  return t
}

export const logcatService = new LogcatService()
