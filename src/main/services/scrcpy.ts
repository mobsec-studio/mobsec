import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import { createWriteStream, existsSync, type WriteStream } from 'node:fs'
import { delimiter, join } from 'node:path'
import { platform } from 'node:os'
import { getLogger } from '../utils/logger'
import { getPaths } from '../utils/paths'

/**
 * scrcpy launcher.
 *
 * Phase 2 spawns scrcpy as a detached process — its native window is what the
 * user actually interacts with for now. Embedding the window inside Electron
 * (or replacing it with a WebCodecs-decoded H.264 stream rendered in canvas) is
 * a Phase 7 polish item; both approaches are intrusive and OS-specific.
 *
 * Binary discovery:
 *   1. Our bundled tools dir (userData/tools/scrcpy/scrcpy(.exe))
 *   2. PATH (macOS users typically install via Homebrew, Linux via apt)
 */

const SCRCPY_BIN = platform() === 'win32' ? 'scrcpy.exe' : 'scrcpy'

function resolveScrcpyPath(): string | null {
  const bundled = join(getPaths().tools, 'scrcpy', SCRCPY_BIN)
  if (existsSync(bundled)) return bundled
  for (const dir of (process.env['PATH'] ?? '').split(delimiter)) {
    if (!dir) continue
    const candidate = join(dir, SCRCPY_BIN)
    if (existsSync(candidate)) return candidate
  }
  return null
}

export function isScrcpyInstalled(): boolean {
  return resolveScrcpyPath() !== null
}

class ScrcpyService {
  private process: ChildProcess | null = null
  private stdoutStream: WriteStream | null = null
  private stderrStream: WriteStream | null = null

  isRunning(): boolean {
    return this.process !== null
  }

  /**
   * Start scrcpy against a specific device serial. Idempotent — if scrcpy is
   * already running we stop the previous instance first.
   */
  async start(serial: string): Promise<void> {
    if (this.process) await this.stop()

    const bin = resolveScrcpyPath()
    if (!bin) {
      throw new Error(
        'scrcpy is not installed. Open Settings → Tools to install it (or `brew install scrcpy` on macOS).'
      )
    }

    const log = getLogger()
    const logsDir = getPaths().logs
    this.stdoutStream = createWriteStream(join(logsDir, 'scrcpy.stdout.log'), { flags: 'a' })
    this.stderrStream = createWriteStream(join(logsDir, 'scrcpy.stderr.log'), { flags: 'a' })

    const args = [
      '-s',
      serial,
      '--window-title=MobSec Studio Emulator',
      '--stay-awake',
      '--keyboard=uhid',
      '--no-audio',
      '--render-driver=opengl'
    ]
    log.info('Launching scrcpy', { bin, args })

    const proc = spawn(bin, args, {
      windowsHide: false,
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    proc.stdout?.pipe(this.stdoutStream)
    proc.stderr?.pipe(this.stderrStream)
    this.process = proc

    proc.on('exit', (code, signal) => {
      log.info('scrcpy exited', { code, signal })
      this.process = null
      this.stdoutStream?.end()
      this.stderrStream?.end()
      this.stdoutStream = null
      this.stderrStream = null
    })
    proc.on('error', (err) => {
      log.warn('scrcpy error', { error: err.message })
      this.process = null
    })
  }

  async stop(): Promise<void> {
    if (!this.process) return
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/PID', String(this.process.pid), '/T', '/F'], {
          windowsHide: true
        })
      } else {
        this.process.kill('SIGTERM')
      }
    } catch (err) {
      getLogger().warn('Failed to kill scrcpy', {
        error: err instanceof Error ? err.message : String(err)
      })
    }
    this.process = null
  }
}

export const scrcpyService = new ScrcpyService()
