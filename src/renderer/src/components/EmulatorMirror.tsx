import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useMirrorStore } from '@/stores/useMirrorStore'
import { cn } from '@/lib/utils'

/**
 * Walk an H.264 Annex-B byte stream looking for the first SPS NAL (type 7)
 * and return the three bytes that determine the codec string:
 *   profile_idc | constraint_set_flags | level_idc
 * If no SPS is found, returns null.
 */
function findSpsCodecBytes(annexB: Uint8Array): { profile: number; constraints: number; level: number } | null {
  let i = 0
  while (i + 3 < annexB.length) {
    const long = annexB[i] === 0 && annexB[i + 1] === 0 && annexB[i + 2] === 0 && annexB[i + 3] === 1
    const short = annexB[i] === 0 && annexB[i + 1] === 0 && annexB[i + 2] === 1
    if (!long && !short) {
      i++
      continue
    }
    const nalStart = i + (long ? 4 : 3)
    if (nalStart >= annexB.length) return null
    const header = annexB[nalStart]!
    const nalType = header & 0x1f
    if (nalType === 7 && nalStart + 3 < annexB.length) {
      return {
        profile: annexB[nalStart + 1]!,
        constraints: annexB[nalStart + 2]!,
        level: annexB[nalStart + 3]!
      }
    }
    i = nalStart + 1
  }
  return null
}

function hex(n: number): string {
  return n.toString(16).padStart(2, '0').toUpperCase()
}

function codecStringFromSps(sps: { profile: number; constraints: number; level: number }): string {
  return `avc1.${hex(sps.profile)}${hex(sps.constraints)}${hex(sps.level)}`
}

/** A short list of fallback codec strings tried if SPS parsing fails. */
const FALLBACK_CODECS = [
  'avc1.42E01E', // Constrained Baseline @ level 3.0 — the most common default
  'avc1.42001E', // Baseline @ level 3.0
  'avc1.4D401E', // Main @ level 3.0
  'avc1.64001E', // High @ level 3.0
  'avc1.640028' // High @ level 4.0
]

async function chooseSupportedCodec(candidates: string[]): Promise<string | null> {
  for (const codec of candidates) {
    try {
      const result = await VideoDecoder.isConfigSupported({ codec })
      if (result.supported) return codec
    } catch {
      // try next
    }
  }
  return null
}

/**
 * In-app screen mirror. Subscribes to encoded video packets streamed from the
 * main process, feeds them into a WebCodecs `VideoDecoder`, and paints each
 * decoded `VideoFrame` onto a `<canvas>`. Pointer events are normalized to
 * 0..1 over the video dimensions and forwarded back as touch messages.
 */
export function EmulatorMirror(): JSX.Element {
  const status = useMirrorStore((s) => s.status)
  const videoInit = useMirrorStore((s) => s.videoInit)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const decoderRef = useRef<VideoDecoder | null>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  /** Becomes the resolved codec string once the first keyframe has been
   *  inspected and the decoder configured. Until then we drop packets. */
  const configuredCodecRef = useRef<string | null>(null)
  const [decoderError, setDecoderError] = useState<string | null>(null)
  const [resolvedCodec, setResolvedCodec] = useState<string | null>(null)
  // Hot counters live in refs and are flushed to state on a 500ms tick.
  // Doing setState on every video packet causes ~30 React re-renders per
  // second — pure overhead since the canvas paints itself out of band.
  const packetCountRef = useRef(0)
  const framesDrawnRef = useRef(0)
  const [packetCount, setPacketCount] = useState(0)
  const [framesDrawn, setFramesDrawn] = useState(0)
  useEffect(() => {
    const id = setInterval(() => {
      setPacketCount(packetCountRef.current)
      setFramesDrawn(framesDrawnRef.current)
    }, 500)
    return () => clearInterval(id)
  }, [])

  // Set up the canvas + a fresh (un-configured) decoder whenever videoInit
  // changes. The decoder is configured later from the first keyframe's SPS.
  useEffect(() => {
    if (!videoInit) return
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = videoInit.width || 1080
    canvas.height = videoInit.height || 1920
    ctxRef.current = canvas.getContext('2d') ?? null

    if (typeof VideoDecoder === 'undefined') {
      setDecoderError('WebCodecs VideoDecoder is unavailable in this build.')
      return
    }

    try {
      decoderRef.current?.close()
    } catch {
      // ignore
    }

    const decoder = new VideoDecoder({
      output: (frame) => {
        const ctx = ctxRef.current
        if (!ctx) {
          frame.close()
          return
        }
        ctx.drawImage(frame, 0, 0, ctx.canvas.width, ctx.canvas.height)
        frame.close()
        framesDrawnRef.current += 1
      },
      error: (err) => {
        setDecoderError(err.message)
      }
    })

    framesDrawnRef.current = 0
    packetCountRef.current = 0
    setFramesDrawn(0)
    setPacketCount(0)

    decoderRef.current = decoder
    configuredCodecRef.current = null
    setResolvedCodec(null)
    setDecoderError(null)

    return () => {
      try {
        decoder.close()
      } catch {
        // ignore
      }
      if (decoderRef.current === decoder) decoderRef.current = null
      configuredCodecRef.current = null
    }
  }, [videoInit])

  // Stream packets in. We block until the first keyframe arrives, then parse
  // the SPS to learn the actual profile/constraints/level the device chose
  // and configure the decoder accordingly. After that, packets flow through.
  useEffect(() => {
    let configuring = false

    const off = window.api.on.onMirrorVideoPacket((packet) => {
      const decoder = decoderRef.current
      if (!decoder) return
      packetCountRef.current += 1

      if (!configuredCodecRef.current) {
        // Configuration strategy: instead of waiting for `packet.keyframe`
        // (which can race with the renderer mounting late and missing the
        // boot IDR), we scan every incoming packet for an SPS NAL. The SPS
        // determines the codec string AND signals that the packet is
        // decodable from scratch.
        if (configuring) return
        const sps = findSpsCodecBytes(packet.data)
        if (!sps && !packet.keyframe) {
          // No SPS and not flagged a keyframe — almost certainly a P/B-frame.
          // Drop it; the next IDR (which always carries SPS+PPS+slice) will
          // configure us.
          return
        }
        configuring = true

        void (async () => {
          try {
            const candidates = sps
              ? [codecStringFromSps(sps), ...FALLBACK_CODECS]
              : [...FALLBACK_CODECS]
            const unique = Array.from(new Set(candidates))
            const codec = await chooseSupportedCodec(unique)
            if (!codec) {
              setDecoderError(
                `No supported H.264 profile (SPS=${sps ? codecStringFromSps(sps) : 'parse-failed'})`
              )
              configuring = false
              return
            }
            try {
              decoder.configure({ codec, optimizeForLatency: true })
              configuredCodecRef.current = codec
              setResolvedCodec(codec)
              setDecoderError(null)
              decoder.decode(
                new EncodedVideoChunk({
                  type: 'key',
                  timestamp: packet.pts,
                  data: packet.data
                })
              )
            } catch (err) {
              setDecoderError(err instanceof Error ? err.message : String(err))
            }
          } finally {
            configuring = false
          }
        })()
        return
      }

      try {
        decoder.decode(
          new EncodedVideoChunk({
            type: packet.keyframe ? 'key' : 'delta',
            timestamp: packet.pts,
            data: packet.data
          })
        )
      } catch (err) {
        setDecoderError(err instanceof Error ? err.message : String(err))
      }
    })
    return off
  }, [])


  // Pointer → device coordinate translation.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const active = new Set<number>()

    function pointerCoords(e: PointerEvent): { x: number; y: number } {
      const rect = canvas!.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width
      const y = (e.clientY - rect.top) / rect.height
      return {
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y))
      }
    }

    function onDown(e: PointerEvent): void {
      if (status.state !== 'running') return
      canvas!.setPointerCapture(e.pointerId)
      active.add(e.pointerId)
      const { x, y } = pointerCoords(e)
      void window.api.mirror.sendTouch({
        action: 0,
        pointerId: e.pointerId,
        x,
        y,
        pressure: e.pressure || 1
      })
    }
    function onMove(e: PointerEvent): void {
      if (!active.has(e.pointerId)) return
      const { x, y } = pointerCoords(e)
      void window.api.mirror.sendTouch({
        action: 2,
        pointerId: e.pointerId,
        x,
        y,
        pressure: e.pressure || 1
      })
    }
    function onUp(e: PointerEvent): void {
      if (!active.delete(e.pointerId)) return
      const { x, y } = pointerCoords(e)
      void window.api.mirror.sendTouch({
        action: 1,
        pointerId: e.pointerId,
        x,
        y,
        pressure: 0
      })
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
    }
  }, [status.state])

  const aspect = videoInit && videoInit.width && videoInit.height
    ? `${videoInit.width} / ${videoInit.height}`
    : '9 / 19'

  return (
    <div className="flex h-full w-full items-center justify-center">
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.18 }}
        className="relative h-full max-h-full"
        style={{ aspectRatio: aspect }}
      >
        <canvas
          ref={canvasRef}
          className={cn(
            'block h-full w-full select-none rounded-[18px] bg-black',
            status.state === 'running' ? 'cursor-crosshair' : 'cursor-default'
          )}
          style={{ touchAction: 'none' }}
        />
        {status.state !== 'running' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            {status.state === 'connecting' && 'Connecting to scrcpy-server…'}
            {status.state === 'stopping' && 'Disconnecting…'}
            {status.state === 'error' && (
              <span className="text-destructive">{status.errorMessage ?? 'Mirror failed'}</span>
            )}
            {status.state === 'idle' && 'Waiting for emulator…'}
          </div>
        )}
        {status.state === 'running' && framesDrawn === 0 && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <div className="font-mono text-foreground/80">
              {packetCount === 0
                ? 'Connected — waiting for first video packet…'
                : configuredCodecRef.current
                  ? `Decoded 0/${packetCount} frames`
                  : `Buffering ${packetCount} packets, waiting for first keyframe…`}
            </div>
            <div className="text-2xs text-muted-foreground/70">
              If this stays here, the device may not be producing video — check the dev console for{' '}
              <span className="font-mono">mirror: first video packet</span>.
            </div>
          </div>
        )}
        {decoderError && status.state === 'running' && (
          <div className="absolute inset-x-2 bottom-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-2xs text-destructive">
            Decoder error: {decoderError}
          </div>
        )}
        {resolvedCodec && status.state === 'running' && !decoderError && (
          <div className="pointer-events-none absolute right-2 top-2 rounded border border-border bg-surface-overlay/70 px-1.5 py-0.5 font-mono text-2xs text-muted-foreground backdrop-blur">
            {resolvedCodec}
          </div>
        )}
      </motion.div>
    </div>
  )
}
