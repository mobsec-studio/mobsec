import { CheckCircle2, Loader2, QrCode, Upload, Wifi, XCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../ui/dialog'
import { Button } from '../ui/button'
import { cn } from '@/lib/utils'
import { useDeviceStore } from '@/stores/useDeviceStore'
import type { WirelessConnectProgress } from '@shared/types'

interface Props {
  open: boolean
  onClose: () => void
  promoteFromSerial: string | null
}

type ConnectMode = 'direct' | 'pair' | 'qr'

interface PairingDraft {
  pairHostPort?: string
  pairingCode?: string
  connectHostPort?: string
}

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => {
  detect(source: ImageBitmap): Promise<Array<{ rawValue: string }>>
}

export function WirelessConnectDialog({ open, onClose, promoteFromSerial }: Props): JSX.Element {
  const wirelessProgress = useDeviceStore((s) => s.wirelessProgress)
  const setWirelessProgress = useDeviceStore((s) => s.setWirelessProgress)
  const refresh = useDeviceStore((s) => s.refresh)

  const promoteMode = !!promoteFromSerial
  const [mode, setMode] = useState<ConnectMode>('direct')
  const [hostPort, setHostPort] = useState('')
  const [pairHostPort, setPairHostPort] = useState('')
  const [pairingCode, setPairingCode] = useState('')
  const [connectHostPort, setConnectHostPort] = useState('')
  const [qrPayload, setQrPayload] = useState('')
  const [qrError, setQrError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [decoding, setDecoding] = useState(false)
  const [history, setHistory] = useState<WirelessConnectProgress[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const barcodeDetectorSupported = useMemo(() => getBarcodeDetector() !== null, [])

  useEffect(() => {
    if (!open) return
    setMode('direct')
    setHistory([])
    setWirelessProgress(null)
    const off = window.api.on.onWirelessProgress((p) => {
      setWirelessProgress(p)
      setHistory((h) => [...h, p])
    })
    return () => off()
  }, [open, setWirelessProgress])

  const reset = (): void => {
    setHistory([])
    setWirelessProgress(null)
    setHostPort('')
    setPairHostPort('')
    setPairingCode('')
    setConnectHostPort('')
    setQrPayload('')
    setQrError(null)
    setSubmitting(false)
    setDecoding(false)
    setMode('direct')
  }

  const handleClose = (): void => {
    reset()
    onClose()
  }

  const submitDirect = async (): Promise<void> => {
    setSubmitting(true)
    try {
      const res = await window.api.device.wirelessConnect(
        promoteMode ? { fromSerial: promoteFromSerial! } : { hostPort: hostPort.trim() }
      )
      if (res.ok) {
        toast.success(`Connected ${res.value.serial}`)
        await refresh()
        handleClose()
      } else {
        toast.error('Wireless connect failed', { description: res.error })
      }
    } catch (err) {
      toast.error('Wireless connect failed', {
        description: err instanceof Error ? err.message : String(err)
      })
    } finally {
      setSubmitting(false)
    }
  }

  const submitPair = async (): Promise<void> => {
    setSubmitting(true)
    try {
      const res = await window.api.device.pairWireless({
        pairHostPort: pairHostPort.trim(),
        pairingCode: pairingCode.trim(),
        connectHostPort: connectHostPort.trim() || undefined
      })
      if (res.ok) {
        if (res.value.serial) {
          toast.success(`Paired and connected ${res.value.serial}`)
          await refresh()
          handleClose()
        } else {
          toast.success('Paired successfully', {
            description: 'Enter the connection address to bring the device online.'
          })
          await refresh()
        }
      } else {
        toast.error('Wireless pairing failed', { description: res.error })
      }
    } catch (err) {
      toast.error('Wireless pairing failed', {
        description: err instanceof Error ? err.message : String(err)
      })
    } finally {
      setSubmitting(false)
    }
  }

  const applyQrDraft = (raw: string): void => {
    const draft = parsePairingPayload(raw)
    if (!draft.pairHostPort && !draft.pairingCode) {
      setQrError('No Android pairing target or code was found in that QR payload.')
      return
    }
    if (draft.pairHostPort) setPairHostPort(draft.pairHostPort)
    if (draft.pairingCode) setPairingCode(draft.pairingCode)
    if (draft.connectHostPort) setConnectHostPort(draft.connectHostPort)
    setQrError(null)
    setMode('pair')
    toast.success('QR data imported')
  }

  const decodeQrImage = async (file: File): Promise<void> => {
    const Detector = getBarcodeDetector()
    if (!Detector) {
      setQrError('QR image decoding is not available in this Chromium runtime.')
      return
    }
    setDecoding(true)
    setQrError(null)
    let bitmap: ImageBitmap | null = null
    try {
      bitmap = await createImageBitmap(file)
      const detector = new Detector({ formats: ['qr_code'] })
      const codes = await detector.detect(bitmap)
      const rawValue = codes[0]?.rawValue?.trim()
      if (!rawValue) {
        setQrError('No QR code was detected in that image.')
        return
      }
      setQrPayload(rawValue)
      applyQrDraft(rawValue)
    } catch (err) {
      setQrError(err instanceof Error ? err.message : String(err))
    } finally {
      bitmap?.close()
      setDecoding(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const canSubmitDirect = !submitting && (promoteMode || looksLikeAdbTarget(hostPort))
  const canSubmitPair =
    !submitting && pairHostPort.trim().length > 0 && pairingCode.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? handleClose() : null)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="h-4 w-4 text-primary" />
            {promoteMode ? 'Use this device over WiFi' : 'Connect device over WiFi'}
          </DialogTitle>
          <DialogDescription>
            {promoteMode
              ? `Switch ${promoteFromSerial} to TCP/IP, read its WiFi IP, and connect to it.`
              : 'Use direct connect for already-paired devices, or pair first with Android 11+ Wireless Debugging.'}
          </DialogDescription>
        </DialogHeader>

        {!promoteMode && (
          <div className="grid grid-cols-3 gap-1 rounded-md border border-border bg-surface/40 p-1">
            <ModeButton active={mode === 'direct'} onClick={() => setMode('direct')}>
              Direct
            </ModeButton>
            <ModeButton active={mode === 'pair'} onClick={() => setMode('pair')}>
              Pair code
            </ModeButton>
            <ModeButton active={mode === 'qr'} onClick={() => setMode('qr')}>
              QR
            </ModeButton>
          </div>
        )}

        {promoteMode || mode === 'direct' ? (
          <div className="space-y-2">
            {!promoteMode && (
              <input
                autoFocus
                value={hostPort}
                onChange={(e) => setHostPort(e.target.value)}
                placeholder="192.168.1.10:5555 or localhost:5555"
                className="h-9 w-full rounded-md border border-border bg-surface px-3 font-mono text-sm text-foreground outline-none focus:border-primary"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSubmitDirect) void submitDirect()
                }}
              />
            )}
            <p className="text-2xs leading-relaxed text-muted-foreground">
              Android 11+ usually needs pairing before direct connect. Use the IP and port from the
              main Wireless Debugging screen after the device is paired.
            </p>
          </div>
        ) : null}

        {!promoteMode && mode === 'pair' && (
          <div className="grid gap-3">
            <label className="grid gap-1.5 text-2xs text-muted-foreground">
              Pairing address
              <input
                value={pairHostPort}
                onChange={(e) => setPairHostPort(e.target.value)}
                placeholder="192.168.1.10:37099 or adb-xxxx"
                className="h-9 rounded-md border border-border bg-surface px-3 font-mono text-sm text-foreground outline-none focus:border-primary"
              />
            </label>
            <label className="grid gap-1.5 text-2xs text-muted-foreground">
              Pairing code
              <input
                value={pairingCode}
                onChange={(e) => setPairingCode(e.target.value)}
                placeholder="123456"
                className="h-9 rounded-md border border-border bg-surface px-3 font-mono text-sm text-foreground outline-none focus:border-primary"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSubmitPair) void submitPair()
                }}
              />
            </label>
            <label className="grid gap-1.5 text-2xs text-muted-foreground">
              Connect address
              <input
                value={connectHostPort}
                onChange={(e) => setConnectHostPort(e.target.value)}
                placeholder="192.168.1.10:39351"
                className="h-9 rounded-md border border-border bg-surface px-3 font-mono text-sm text-foreground outline-none focus:border-primary"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSubmitPair) void submitPair()
                }}
              />
            </label>
          </div>
        )}

        {!promoteMode && mode === 'qr' && (
          <div className="grid gap-3">
            <textarea
              value={qrPayload}
              onChange={(e) => setQrPayload(e.target.value)}
              placeholder="Paste Android wireless debugging QR payload"
              className="min-h-24 rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary"
            />
            {qrError && <div className="text-2xs text-destructive">{qrError}</div>}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!qrPayload.trim()}
                onClick={() => applyQrDraft(qrPayload)}
              >
                <QrCode className="h-3.5 w-3.5" /> Parse
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!barcodeDetectorSupported || decoding}
                onClick={() => fileInputRef.current?.click()}
              >
                {decoding ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                Decode image
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void decodeQrImage(file)
                }}
              />
            </div>
          </div>
        )}

        <div className="space-y-1.5 rounded-md border border-border bg-surface/40 p-3">
          {history.length === 0 ? (
            <div className="text-2xs italic text-muted-foreground">
              Progress will appear here once you start.
            </div>
          ) : (
            history.map((p, i) => <ProgressLine key={`${p.phase}-${i}`} progress={p} />)
          )}
          {wirelessProgress?.phase === 'error' && (
            <div className="mt-1 whitespace-pre-line text-2xs text-destructive">
              {wirelessProgress.errorMessage}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            Close
          </Button>
          {promoteMode || mode === 'direct' ? (
            <Button size="sm" disabled={!canSubmitDirect} onClick={() => void submitDirect()}>
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Connecting
                </>
              ) : (
                <>
                  <Wifi className="h-3.5 w-3.5" /> {promoteMode ? 'Switch to WiFi' : 'Connect'}
                </>
              )}
            </Button>
          ) : (
            <Button size="sm" disabled={!canSubmitPair} onClick={() => void submitPair()}>
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Pairing
                </>
              ) : (
                <>
                  <Wifi className="h-3.5 w-3.5" /> Pair and connect
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ModeButton({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-8 rounded-sm text-xs transition-colors',
        active ? 'bg-surface-raised text-foreground' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}

function looksLikeAdbTarget(raw: string): boolean {
  const value = raw.trim()
  if (!value || /[\s\r\n\t]/.test(value)) return false
  if (/^\[[0-9a-fA-F:]+\](?::\d+)?$/.test(value)) return true
  return /^[A-Za-z0-9.-]+(?::\d+)?$/.test(value)
}

function getBarcodeDetector(): BarcodeDetectorCtor | null {
  return (
    (globalThis as typeof globalThis & { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector ??
    null
  )
}

function ProgressLine({ progress }: { progress: WirelessConnectProgress }): JSX.Element {
  const phaseLabels: Record<WirelessConnectProgress['phase'], string> = {
    'enabling-tcpip': 'tcpip',
    'discovering-ip': 'discover-ip',
    pairing: 'pair',
    connecting: 'connect',
    verifying: 'verify',
    done: 'done',
    error: 'error'
  }
  const isError = progress.phase === 'error'
  const isDone = progress.phase === 'done'
  return (
    <div className="flex items-start gap-2 text-2xs">
      {isError ? (
        <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
      ) : isDone ? (
        <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-success" />
      ) : (
        <Loader2 className="mt-0.5 h-3 w-3 shrink-0 animate-spin text-primary" />
      )}
      <div className="min-w-0 flex-1">
        <span
          className={cn(
            'font-mono uppercase tracking-wider',
            isError ? 'text-destructive' : isDone ? 'text-success' : 'text-muted-foreground'
          )}
        >
          {phaseLabels[progress.phase]}
        </span>{' '}
        <span className="whitespace-pre-line text-foreground/80">{progress.message}</span>
      </div>
    </div>
  )
}

function parsePairingPayload(raw: string): PairingDraft {
  const value = raw.trim()
  if (!value) return {}

  const draft: PairingDraft = {}
  const applyRecord = (record: Record<string, unknown>): void => {
    const pairHostPort =
      stringValue(record.pairHostPort) ??
      stringValue(record.pairAddress) ??
      joinHostPort(record.host ?? record.ip ?? record.address, record.port ?? record.pairPort)
    const connectHostPort =
      stringValue(record.connectHostPort) ??
      stringValue(record.connectAddress) ??
      joinHostPort(record.connectHost ?? record.connectIp, record.connectPort)
    const code =
      stringValue(record.pairingCode) ??
      stringValue(record.code) ??
      stringValue(record.password) ??
      stringValue(record.pass)
    if (pairHostPort) draft.pairHostPort = pairHostPort
    if (connectHostPort) draft.connectHostPort = connectHostPort
    if (code) draft.pairingCode = code
  }

  try {
    const parsed = JSON.parse(value) as unknown
    if (parsed && typeof parsed === 'object') applyRecord(parsed as Record<string, unknown>)
  } catch {
    // QR payloads are often WIFI:... or custom URLs, not JSON.
  }

  try {
    const url = new URL(value)
    const params = Object.fromEntries(url.searchParams.entries())
    applyRecord(params)
    if (!draft.pairHostPort && url.hostname) {
      draft.pairHostPort = joinHostPort(url.hostname, url.port)
    }
  } catch {
    // Not a URL.
  }

  if (value.toUpperCase().startsWith('WIFI:')) {
    const fields = parseWifiFields(value)
    if (fields.S && !draft.pairHostPort) draft.pairHostPort = fields.S
    if (fields.P && !draft.pairingCode) draft.pairingCode = fields.P
  }

  const service = value.match(/\badb-[A-Za-z0-9._-]+(?:\._adb-tls-pairing\._tcp\.?)?\b/i)?.[0]
  if (service && !draft.pairHostPort) draft.pairHostPort = service

  const hostPorts = [
    ...value.matchAll(/((?:\d{1,3}\.){3}\d{1,3}|\[[0-9a-fA-F:]+\]|[A-Za-z0-9.-]+):(\d{2,5})/g)
  ].map((m) => m[0])
  if (!draft.pairHostPort && hostPorts[0]) draft.pairHostPort = hostPorts[0]
  if (!draft.connectHostPort && hostPorts[1]) draft.connectHostPort = hostPorts[1]

  const namedCode =
    value.match(/(?:pairingCode|pairing_code|password|pass|code|P)[:=\s]+([^\s;]+)/i)?.[1] ??
    value.match(/\b(\d{6}|\d{8})\b/)?.[1]
  if (namedCode && !draft.pairingCode) draft.pairingCode = namedCode

  return draft
}

function parseWifiFields(value: string): Record<string, string> {
  const fields: Record<string, string> = {}
  const body = value.replace(/^WIFI:/i, '')
  for (const match of body.matchAll(/([A-Z]):((?:\\.|[^;])*)/gi)) {
    fields[match[1]!.toUpperCase()] = unescapeWifiValue(match[2] ?? '')
  }
  return fields
}

function unescapeWifiValue(value: string): string {
  return value.replace(/\\([\\;,:"])/g, '$1')
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function joinHostPort(host: unknown, port: unknown): string | undefined {
  const h = stringValue(host)
  const p = stringValue(port) ?? (typeof port === 'number' ? String(port) : undefined)
  if (!h) return undefined
  return p ? `${h}:${p}` : h
}
