import { existsSync, readFileSync } from 'node:fs'
import { delimiter, dirname, join } from 'node:path'
import { AdbServerClient, type Adb } from '@yume-chan/adb'
import { AdbServerNodeTcpConnector } from '@yume-chan/adb-server-node-tcp'
import {
  ScrcpyOptions3_1,
  ScrcpyVideoCodecId,
  type AndroidKeyCode,
  type AndroidKeyEventAction,
  type AndroidMotionEventAction
} from '@yume-chan/scrcpy'
import {
  ReadableStream,
  WritableStream,
  type WritableStreamDefaultWriter,
  type MaybeConsumable
} from '@yume-chan/stream-extra'
import type { MirrorStatus, MirrorTouchEvent } from '@shared/types'
import { runAdb } from './adb'
import { bus } from '../utils/event-bus'
import { getLogger } from '../utils/logger'
import { getPaths } from '../utils/paths'

/**
 * In-app screen mirroring.
 *
 * We push scrcpy's `scrcpy-server` jar onto the connected emulator, launch it
 * via `app_process`, and open ADB tunneled sockets to its video and control
 * streams. The encoded video packets are forwarded to the renderer over IPC;
 * the renderer decodes them with `WebCodecs.VideoDecoder` and paints onto a
 * `<canvas>`. Touch/key events from the canvas come back to us via IPC and
 * are serialized onto the control socket using scrcpy's own message format.
 */

const SCRCPY_SERVER_VERSION = '3.1'
const DEVICE_SERVER_PATH = '/data/local/tmp/mobsec-scrcpy-server.jar'

class MirrorService {
  private status: MirrorStatus = { state: 'idle', width: null, height: null }
  private client: AdbServerClient | null = null
  private adb: Adb | null = null
  private serverAbort: AbortController | null = null
  private cancelStreams: AbortController | null = null
  private controlWriter: WritableStreamDefaultWriter<MaybeConsumable<Uint8Array>> | null = null
  private options: ScrcpyOptions3_1<true> | null = null

  getStatus(): MirrorStatus {
    return { ...this.status }
  }

  async start(serial: string): Promise<void> {
    if (this.status.state === 'running' || this.status.state === 'connecting') {
      return
    }
    this.setStatus({ state: 'connecting', width: null, height: null })

    const log = getLogger()
    this.cancelStreams = new AbortController()

    try {
      // 1. Validate prereqs before doing anything fancy.
      const serverPath = locateBundledScrcpyServer()
      if (!serverPath) {
        throw new Error(
          'scrcpy-server not found. Install scrcpy from Settings -> External tools first.'
        )
      }
      log.debug('mirror: located scrcpy-server', { path: serverPath })

      // 2. Make sure the local ADB server is reachable. `adb start-server`
      //    is idempotent — it brings the server up if not running and exits 0
      //    if it already is. Without this, the AdbServerNodeTcpConnector
      //    fails with ECONNREFUSED on fresh boots.
      try {
        await runAdb(['start-server'], 10_000)
      } catch (err) {
        log.warn('mirror: adb start-server failed (continuing)', {
          error: err instanceof Error ? err.message : String(err)
        })
      }

      // 3. Connect to ADB server and resolve the device.
      this.client = new AdbServerClient(
        new AdbServerNodeTcpConnector({ host: '127.0.0.1', port: 5037 })
      )
      try {
        this.adb = await this.client.createAdb({ serial })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (/ECONNREFUSED|connect/i.test(msg)) {
          throw new Error(
            `Could not reach the local ADB server on 127.0.0.1:5037. Run "adb start-server" manually, then retry.`
          )
        }
        throw err
      }
      log.debug('mirror: connected to device via ADB server', { serial })

      const shellSvc = this.adb.subprocess.shellProtocol
      if (!shellSvc) {
        throw new Error(
          'Device does not support the ADB shell-v2 protocol. Update the emulator system image.'
        )
      }

      // 4. Push the jar, then verify it landed on the device. Spotting an
      //    "empty file" or wrong-size push here saves an opaque server crash.
      await pushFile(this.adb, serverPath, DEVICE_SERVER_PATH)
      const ls = await shellSvc.spawnWaitText(`ls -la ${DEVICE_SERVER_PATH}`)
      if (ls.exitCode !== 0) {
        throw new Error(
          `Could not stat scrcpy-server on device after push (exit=${ls.exitCode}): ${ls.stderr.trim() || '(no output)'}`
        )
      }
      log.info('mirror: pushed scrcpy-server to device', {
        device: serial,
        listing: ls.stdout.trim()
      })

      // SCID quirk: scrcpy-server 3.1 calls `Integer.parseInt(value, 16)` on
      // this option AND requires the parsed result to fit in a signed int32.
      // That means the hex string we hand it must represent a value
      // ≤ 0x7FFFFFFF, otherwise we get NumberFormatException from the JVM.
      // We generate a 31-bit unsigned integer and use its 8-char zero-padded
      // hex form both as the `scid=` argument and as the socket-name suffix
      // scrcpy uses internally.
      const scidInt = Math.floor(Math.random() * 0x7fffffff)
      const scidHex = scidInt.toString(16).padStart(8, '0')
      const options = new ScrcpyOptions3_1<true>({
        scid: scidHex,
        video: true,
        audio: false,
        control: true,
        // Performance-focused defaults. The software-GPU emulator can't
        // sustainably produce more than ~30fps at 1080p, so we cap the
        // longest edge to 720, limit fps to 30, and use 2 Mbps — plenty for
        // a UI mirror, much less work for MediaCodec.
        maxSize: 720,
        maxFps: 30,
        videoBitRate: 2_000_000,
        videoCodec: 'h264',
        sendDeviceMeta: true,
        // `sendDummyByte` MUST be false. scrcpy-server emits a 1-byte alive
        // signal at the start of the video stream when this is true, but
        // @yume-chan/scrcpy@2.3's `parseVideoStreamMetadata` never consumes
        // it — every subsequent read (device name, codec id, width, height,
        // frame meta) ends up off by one byte, producing garbage. Disabling
        // the dummy byte aligns the stream with the parser's expectations.
        sendDummyByte: false,
        sendCodecMeta: true,
        sendFrameMeta: true,
        cleanup: true,
        logLevel: 'info',
        clipboardAutosync: false,
        // CRITICAL: scrcpy-server defaults to reverse tunnel, where the
        // device-side server tries to connect *out* to a host-side socket
        // (set up via `adb reverse`). We don't set up a reverse tunnel, so
        // we use forward mode: the server creates a LocalServerSocket on the
        // abstract address and we connect to it through the regular ADB
        // `localabstract:` service. Without this flag the abstract socket is
        // never created on device, and our retries see "closed".
        tunnelForward: true
      })
      this.options = options

      // 5. Spawn the server. We deliberately don't bind the spawn to a signal
      //    here because the @yume-chan signal handling tears the subprocess
      //    down before the abstract socket has time to accept connections —
      //    we kill it ourselves from stop() instead.
      this.serverAbort = new AbortController()
      const serializedOpts = options.serialize()
      const cmd = `CLASSPATH=${DEVICE_SERVER_PATH} app_process / com.genymobile.scrcpy.Server ${SCRCPY_SERVER_VERSION} ${serializedOpts.join(' ')}`
      log.info('mirror: spawning scrcpy-server', {
        version: SCRCPY_SERVER_VERSION,
        scidHex,
        cmd
      })

      const subprocess = await shellSvc.spawn(cmd)
      // Capture stderr/stdout into a buffer AND mirror to the logger, so if
      // the server dies we can surface its output in the error message.
      const serverOutput: string[] = []
      const collectStream = (
        stream: ReadableStream<Uint8Array>,
        tag: 'stdout' | 'stderr'
      ): Promise<void> =>
        stream.pipeTo(
          new WritableStream<Uint8Array>({
            write: (chunk) => {
              const text = new TextDecoder().decode(chunk)
              serverOutput.push(text)
              for (const line of text.split(/\r?\n/)) {
                if (line.trim()) log.info(`[scrcpy-server:${tag}] ${line}`)
              }
            }
          })
        )
      void collectStream(subprocess.stderr, 'stderr').catch(() => undefined)
      void collectStream(subprocess.stdout, 'stdout').catch(() => undefined)

      // 6. Open the device sockets, but race against the subprocess exit so
      //    a crashing server surfaces a real error instead of a 15s timeout.
      const exitedRejection = subprocess.exited.then((code) => {
        const out = serverOutput.join('').trim()
        throw new Error(
          `scrcpy-server exited with code ${code} before binding the abstract socket.${
            out ? ` Output:\n${out}` : ' (no output)'
          }`
        )
      })

      const videoSocket = await Promise.race([
        openWithRetry(this.adb, `localabstract:scrcpy_${scidHex}`, 15_000, log),
        exitedRejection
      ])
      log.debug('mirror: opened video socket')
      const controlSocket = await Promise.race([
        openWithRetry(this.adb, `localabstract:scrcpy_${scidHex}`, 15_000, log),
        exitedRejection
      ])
      log.debug('mirror: opened control socket')

      // 7. Parse the video metadata header with a watchdog so a stuck stream
      //    surfaces a real error instead of hanging on "connecting".
      const videoMeta = await withTimeout(
        Promise.resolve(options.parseVideoStreamMetadata(videoSocket.readable)),
        15_000,
        'Timed out parsing scrcpy video metadata. The server may have failed to start — check the dev console for [scrcpy-server] log lines.'
      )

      const codec = videoMeta.metadata.codec
      const width = videoMeta.metadata.width ?? 0
      const height = videoMeta.metadata.height ?? 0
      log.info('mirror: video stream ready', { codec, width, height })

      this.setStatus({ state: 'running', width: width || null, height: height || null })
      bus.emit('mirror:videoInit', {
        codec: codecForWebCodecs(codec),
        width,
        height
      })

      // The Node Web Streams `closed` promise is typed `Promise<void>` while
      // yume-chan declares it `Promise<undefined>`. Same runtime contract, so
      // we cast through unknown to satisfy the strict structural check.
      this.controlWriter = controlSocket.writable.getWriter() as unknown as WritableStreamDefaultWriter<
        MaybeConsumable<Uint8Array>
      >

      // Note: we deliberately do NOT send RESET_VIDEO here. scrcpy-server is
      // mid-handshake (just finished sending codec metadata, about to push
      // the first IDR), and a control byte arriving inside that window
      // restarts the encoder pipeline and trashes the stream. If we need a
      // fresh keyframe later we send RESET_VIDEO via `requestKeyframe()`
      // after the first packet has flowed.

      void pumpPackets(
        videoMeta.stream.pipeThrough(options.createMediaStreamTransformer()),
        this.cancelStreams.signal,
        log
      ).catch((err) => {
        if (this.cancelStreams?.signal.aborted) return
        log.warn('mirror: video stream ended', {
          error: err instanceof Error ? err.message : String(err)
        })
        this.setStatus({
          state: 'error',
          width: this.status.width,
          height: this.status.height,
          errorMessage: err instanceof Error ? err.message : String(err)
        })
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.error('Mirror failed to start', { error: message })
      // Keep the error visible in the UI — only `cleanupResources` runs so
      // we don't leak the partial state. `stop()` from the user side is the
      // path that resets back to idle.
      this.cleanupResources()
      this.setStatus({ state: 'error', width: null, height: null, errorMessage: message })
      throw err
    }
  }

  async stop(): Promise<void> {
    if (this.status.state === 'idle') return
    this.setStatus({ state: 'stopping', width: null, height: null })
    this.cleanupResources()
    this.setStatus({ state: 'idle', width: null, height: null })
  }

  /**
   * Stop + start in one shot. Used after `adb root` (which restarts adbd and
   * severs every live ADB socket, including our video and control streams).
   * The brief settle gives adbd a moment to come back up so the immediate
   * reconnect doesn't ECONNREFUSED.
   */
  async restart(serial: string): Promise<void> {
    const log = getLogger()
    log.info('mirror: restart requested', { serial })
    try {
      await this.stop()
    } catch (err) {
      log.warn('mirror: stop during restart failed (continuing)', {
        error: err instanceof Error ? err.message : String(err)
      })
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
    await this.start(serial)
  }

  /** Tear down sockets and ADB handles without flipping status. Use this
   *  from inside the start() error handler so the user keeps seeing the
   *  underlying failure reason. */
  private cleanupResources(): void {
    this.cancelStreams?.abort()
    this.cancelStreams = null

    try {
      void this.controlWriter?.close()
    } catch {
      // ignore — the underlying socket may already be closed.
    }
    this.controlWriter = null

    try {
      this.serverAbort?.abort()
    } catch {
      // ignore
    }
    this.serverAbort = null
    this.options = null
    this.adb = null
    this.client = null
  }

  async sendTouch(event: MirrorTouchEvent): Promise<void> {
    if (!this.controlWriter || !this.options || this.status.state !== 'running') return
    const width = this.status.width ?? 1
    const height = this.status.height ?? 1
    const bytes = this.options.serializeInjectTouchControlMessage({
      type: 2,
      action: event.action as AndroidMotionEventAction,
      pointerId: BigInt(event.pointerId),
      pointerX: Math.max(0, Math.min(width - 1, Math.round(event.x * width))),
      pointerY: Math.max(0, Math.min(height - 1, Math.round(event.y * height))),
      videoWidth: width,
      videoHeight: height,
      pressure: Math.max(0, Math.min(1, event.pressure)),
      actionButton: 1,
      buttons: 1
    })
    await this.writeControl(bytes)
  }

  async sendKey(keycode: number, action: 'down' | 'up'): Promise<void> {
    if (!this.controlWriter || !this.options || this.status.state !== 'running') return
    // ScrcpyInjectKeyCodeControlMessage wire format (big-endian, 14 bytes):
    //   u8  type      = 0 (INJECT_KEYCODE)
    //   u8  action    = 0 down / 1 up
    //   u32 keyCode
    //   u32 repeat
    //   u32 metaState
    // The earlier version used u32 for action, which corrupted the control
    // stream by leaving 3 stale bytes that misaligned the next message and
    // crashed the server.
    const buf = new Uint8Array(1 + 1 + 4 + 4 + 4)
    const view = new DataView(buf.buffer)
    buf[0] = 0
    buf[1] = action === 'down' ? 0 : 1
    view.setUint32(2, keycode)
    view.setUint32(6, 0)
    view.setUint32(10, 0)
    await this.writeControl(buf)
    void ({} as AndroidKeyCode)
    void ({} as AndroidKeyEventAction)
  }

  /**
   * Write to the scrcpy control socket, treating "ended by other party" /
   * "WRITE_AFTER_END" as a peer-side hangup. When that happens we cleanly
   * flip to error so the caller (and renderer) sees a real status instead
   * of a misleading exception, and the next restart() rebuilds the sockets.
   *
   * The most common cause is `adb root` racing ahead of us — adbd restarts
   * and severs every live forward socket. main/index.ts auto-restarts the
   * mirror on `device:adbRestarted`, but if a UI touch lands inside that
   * brief window we don't want to blow up.
   */
  private async writeControl(payload: Uint8Array): Promise<void> {
    if (!this.controlWriter) return
    try {
      await this.controlWriter.write(payload)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/ended by the other party|WRITE_AFTER_END|premature close|closed/i.test(msg)) {
        getLogger().warn('mirror: control socket closed by peer — tearing down', {
          error: msg
        })
        this.cleanupResources()
        this.setStatus({
          state: 'error',
          width: null,
          height: null,
          errorMessage: 'Mirror control socket closed (peer hangup). Restarting…'
        })
        return
      }
      throw err
    }
  }

  /**
   * Send the RESET_VIDEO control message. scrcpy-server responds by emitting
   * a fresh IDR + SPS+PPS bundle, which lets the renderer recover when the
   * boot keyframe was missed due to a subscription-timing race.
   */
  async requestKeyframe(): Promise<void> {
    if (!this.controlWriter || this.status.state !== 'running') return
    await this.controlWriter.write(new Uint8Array([17])) // RESET_VIDEO
  }

  private setStatus(next: MirrorStatus): void {
    this.status = next
    bus.emit('mirror:status', next)
  }
}

function codecForWebCodecs(codec: ScrcpyVideoCodecId): string {
  if (codec === ScrcpyVideoCodecId.H265) return 'hev1.1.6.L93.B0'
  if (codec === ScrcpyVideoCodecId.AV1) return 'av01.0.05M.08'
  // H.264 high profile @ level 4.0 — covers what scrcpy-server emits at the
  // default 4 Mbps / 1080p ceiling. The decoder reconfigures from in-band SPS.
  return 'avc1.640028'
}

function locateBundledScrcpyServer(): string | null {
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

  for (const p of candidates) {
    if (p && existsSync(p)) return p
  }
  return null
}

function findOnPath(binary: string): string | null {
  for (const dir of (process.env['PATH'] ?? '').split(delimiter)) {
    if (!dir) continue
    const candidate = join(dir, binary)
    if (existsSync(candidate)) return candidate
  }
  return null
}

async function pushFile(adb: Adb, localPath: string, devicePath: string): Promise<void> {
  const sync = await adb.sync()
  try {
    const bytes = readFileSync(localPath)
    await sync.write({
      filename: devicePath,
      file: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes)
          controller.close()
        }
      }),
      permission: 0o644
    })
  } finally {
    await sync.dispose()
  }
}

async function pumpPackets(
  stream: ReadableStream<{ type: string; data?: Uint8Array; keyframe?: boolean; pts?: bigint }>,
  signal: AbortSignal,
  log: ReturnType<typeof getLogger>
): Promise<void> {
  const reader = stream.getReader()
  signal.addEventListener('abort', () => void reader.cancel().catch(() => undefined), {
    once: true
  })
  let total = 0
  let keyframes = 0
  let bytes = 0
  // When `sendCodecMeta: true`, scrcpy emits the SPS+PPS as a standalone
  // `configuration` packet ahead of the first IDR. WebCodecs in Annex-B mode
  // needs SPS+PPS to be present **in the same access unit** as the IDR slice,
  // so we cache the last config and prepend it to every keyframe we forward.
  // (Re-prepending on every keyframe is also good practice — it lets the
  // decoder recover if it ever loses state.)
  let pendingConfig: Uint8Array | null = null
  const started = Date.now()
  while (!signal.aborted) {
    const { done, value } = await reader.read()
    if (done) {
      log.warn('mirror: packet stream ended', { totalPackets: total })
      return
    }
    if (value.type === 'configuration' && value.data) {
      const copy = new Uint8Array(value.data.byteLength)
      copy.set(value.data)
      pendingConfig = copy
      log.info('mirror: codec configuration received', { bytes: copy.byteLength })
      continue
    }
    if (value.type !== 'data' || !value.data) continue

    // Build the wire payload. Keyframes get SPS+PPS prepended (if we have
    // any cached). Non-keyframes pass through unchanged.
    let data: Uint8Array
    if (value.keyframe && pendingConfig) {
      data = new Uint8Array(pendingConfig.byteLength + value.data.byteLength)
      data.set(pendingConfig, 0)
      data.set(value.data, pendingConfig.byteLength)
    } else {
      data = new Uint8Array(value.data.byteLength)
      data.set(value.data)
    }

    total++
    bytes += data.byteLength
    if (value.keyframe) keyframes++
    if (total === 1) {
      log.info('mirror: first video packet received', {
        size: data.byteLength,
        keyframe: !!value.keyframe,
        prependedConfig: pendingConfig?.byteLength ?? 0
      })
    }
    if (total % 60 === 0) {
      const seconds = Math.max(1, (Date.now() - started) / 1000)
      log.debug('mirror: streaming', {
        packets: total,
        keyframes,
        avgKBs: Math.round(bytes / seconds / 1024)
      })
    }
    bus.emit('mirror:videoPacket', {
      pts: Number(value.pts ?? 0n),
      keyframe: !!value.keyframe,
      data
    })
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Open a localabstract socket on the device, retrying for up to `maxWaitMs`.
 * scrcpy-server binds its socket asynchronously after JVM startup, so the
 * first few attempts often fail with "Connection refused" or similar.
 */
async function openWithRetry(
  adb: Adb,
  service: string,
  maxWaitMs: number,
  log: ReturnType<typeof getLogger>
): Promise<{ readable: ReadableStream<Uint8Array>; writable: WritableStream<MaybeConsumable<Uint8Array>> }> {
  const start = Date.now()
  let lastErr: unknown = null
  let attempt = 0
  while (Date.now() - start < maxWaitMs) {
    attempt++
    try {
      const socket = await adb.createSocket(service)
      return {
        readable: socket.readable as ReadableStream<Uint8Array>,
        writable: socket.writable as WritableStream<MaybeConsumable<Uint8Array>>
      }
    } catch (err) {
      lastErr = err
      if (attempt === 1) {
        log.debug('mirror: socket not yet available, retrying…', { service })
      }
      await wait(250)
    }
  }
  const detail = lastErr instanceof Error ? lastErr.message : String(lastErr)
  throw new Error(
    `Could not connect to scrcpy abstract socket "${service}" after ${maxWaitMs}ms: ${detail}`
  )
}

function withTimeout<T>(promise: Promise<T> | PromiseLike<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}

export const mirrorService = new MirrorService()
