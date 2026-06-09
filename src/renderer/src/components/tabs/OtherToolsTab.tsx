import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileArchive,
  FileSearch,
  Hash,
  Loader2,
  Power,
  RefreshCw,
  Rocket,
  Shield,
  Smartphone,
  Terminal,
  Unlock,
  Upload,
  Wrench
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import type {
  FirmwareDownloadResult,
  FirmwareSearchResult,
  MagiskFlashPartition,
  MagiskPatchedImageSearchResult,
  RootActionResult,
  RootToolResult
} from '@shared/types'
import { Button } from '../ui/button'
import { selectActiveDevice, useDeviceStore } from '@/stores/useDeviceStore'
import { cn, formatBytes } from '@/lib/utils'

type BusyAction =
  | 'check'
  | 'root'
  | 'recovery'
  | 'bootloader'
  | 'system'
  | 'fastboot'
  | 'flash'
  | 'detect-patched'
  | 'start-magisk-root'
  | 'find-firmware'
  | 'download-firmware'
  | null

const PARTITIONS: MagiskFlashPartition[] = ['boot', 'init_boot', 'recovery']

export function OtherToolsTab(): JSX.Element {
  const activeDevice = useDeviceStore(selectActiveDevice)
  const refreshDevices = useDeviceStore((s) => s.refresh)
  const [result, setResult] = useState<RootToolResult | null>(null)
  const [actionResult, setActionResult] = useState<RootActionResult | null>(null)
  const [firmwareSearch, setFirmwareSearch] = useState<FirmwareSearchResult | null>(null)
  const [firmwareDownload, setFirmwareDownload] = useState<FirmwareDownloadResult | null>(null)
  const [patchedSearch, setPatchedSearch] = useState<MagiskPatchedImageSearchResult | null>(null)
  const [manualFirmwareUrl, setManualFirmwareUrl] = useState('')
  const [acceptedFirmwareTerms, setAcceptedFirmwareTerms] = useState(false)
  const [pushToDevice, setPushToDevice] = useState(true)
  const [busy, setBusy] = useState<BusyAction>(null)
  const [patchedImagePath, setPatchedImagePath] = useState('')
  const [partition, setPartition] = useState<MagiskFlashPartition>('boot')
  const [flashConfirmed, setFlashConfirmed] = useState(false)
  const [rebootAfterFlash, setRebootAfterFlash] = useState(true)

  const recommendedPartition = useMemo<MagiskFlashPartition>(
    () => ((activeDevice?.sdkLevel ?? 0) >= 33 ? 'init_boot' : 'boot'),
    [activeDevice?.sdkLevel]
  )

  useEffect(() => {
    setResult(null)
    setActionResult(null)
    setFirmwareSearch(null)
    setFirmwareDownload(null)
    setPatchedSearch(null)
    setManualFirmwareUrl('')
    setAcceptedFirmwareTerms(false)
    setPatchedImagePath('')
    setPartition(recommendedPartition)
    setFlashConfirmed(false)
    setRebootAfterFlash(true)
  }, [activeDevice?.serial, recommendedPartition])

  const online = activeDevice?.state === 'online'
  const targetKind = result?.targetKind ?? null
  const magiskPath = result?.workflow.kind === 'magisk-real-device'
  const adbRootPath = result?.workflow.kind === 'adb-root'

  const runCheck = async (): Promise<void> => {
    setBusy('check')
    try {
      const res = await window.api.otherTools.rootCheck()
      if (res.ok) {
        setResult(res.value)
        setActionResult(null)
      } else {
        toast.error('Root check failed', { description: res.error })
      }
    } finally {
      setBusy(null)
    }
  }

  const tryAdbRoot = async (): Promise<void> => {
    setBusy('root')
    try {
      const res = await window.api.otherTools.tryAdbRoot()
      if (res.ok) {
        setResult(res.value)
        await refreshDevices()
        if (res.value.adbRootSucceeded) toast.success('ADB root enabled')
        else toast.warning('ADB root not available', { description: res.value.message })
      } else {
        toast.error('ADB root failed', { description: res.error })
      }
    } finally {
      setBusy(null)
    }
  }

  const findFirmware = async (): Promise<void> => {
    setBusy('find-firmware')
    try {
      const res = await window.api.otherTools.findFirmwareImages()
      if (res.ok) {
        setFirmwareSearch(res.value)
        if (res.value.candidates.length > 0) toast.success('Firmware source found')
        else toast.warning('No exact firmware found', { description: res.value.message })
      } else {
        toast.error('Firmware lookup failed', { description: res.error })
      }
    } finally {
      setBusy(null)
    }
  }

  const downloadFirmware = async (): Promise<void> => {
    setBusy('download-firmware')
    try {
      const res = await window.api.otherTools.downloadFirmwareImage({
        url: manualFirmwareUrl.trim() || undefined,
        acceptedTerms: acceptedFirmwareTerms,
        pushToDevice
      })
      if (res.ok) {
        setFirmwareDownload(res.value)
        toast.success('Firmware image ready', { description: res.value.message })
      } else {
        toast.error('Firmware download failed', { description: res.error })
      }
    } finally {
      setBusy(null)
    }
  }

  const rebootForRoot = async (mode: 'recovery' | 'bootloader' | 'system'): Promise<void> => {
    setBusy(mode)
    try {
      const res = await window.api.otherTools.rebootForRoot(mode)
      if (res.ok) {
        setActionResult(res.value)
        toast.success(res.value.message)
      } else {
        toast.error('Reboot command failed', { description: res.error })
      }
    } finally {
      setBusy(null)
    }
  }

  const detectFastboot = async (): Promise<void> => {
    setBusy('fastboot')
    try {
      const res = await window.api.otherTools.listFastbootDevices()
      if (res.ok) {
        setActionResult(res.value)
        if ((res.value.fastbootDevices?.length ?? 0) > 0) toast.success(res.value.message)
        else toast.warning(res.value.message)
      } else {
        toast.error('Fastboot detection failed', { description: res.error })
      }
    } finally {
      setBusy(null)
    }
  }

  const choosePatchedImage = async (): Promise<void> => {
    const res = await window.api.dialog.showOpen({
      title: 'Select Magisk patched image',
      filters: [
        { name: 'Android boot images', extensions: ['img'] },
        { name: 'All files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })
    if (res.ok && res.value[0]) {
      setPatchedImagePath(res.value[0])
      setPatchedSearch(null)
      setFlashConfirmed(false)
    } else if (!res.ok) {
      toast.error('Could not open file picker', { description: res.error })
    }
  }

  const detectPatchedImage = async (): Promise<void> => {
    setBusy('detect-patched')
    try {
      const res = await window.api.otherTools.detectMagiskPatchedImages()
      if (res.ok) {
        setPatchedSearch(res.value)
        setActionResult(null)
        if (res.value.selected) {
          setPatchedImagePath(res.value.selected.path)
          setFlashConfirmed(false)
          toast.success('Patched image loaded', { description: res.value.message })
        } else {
          toast.warning('No patched image found', { description: res.value.message })
        }
      } else {
        toast.error('Patched image detection failed', { description: res.error })
      }
    } finally {
      setBusy(null)
    }
  }

  const flashImage = async (): Promise<void> => {
    setBusy('flash')
    try {
      const res = await window.api.otherTools.flashMagiskPatchedImage({
        imagePath: patchedImagePath,
        partition,
        confirmed: flashConfirmed
      })
      if (res.ok) {
        setActionResult(res.value)
        toast.success(res.value.message)
      } else {
        toast.error('Fastboot flash failed', { description: res.error })
      }
    } finally {
      setBusy(null)
    }
  }

  const startMagiskRoot = async (): Promise<void> => {
    setBusy('start-magisk-root')
    try {
      const res = await window.api.otherTools.startMagiskRoot({
        imagePath: patchedImagePath.trim() || undefined,
        partition,
        confirmed: flashConfirmed,
        rebootAfterFlash
      })
      if (res.ok) {
        setActionResult(res.value)
        if (res.value.patchedImage) setPatchedImagePath(res.value.patchedImage.path)
        toast.success(res.value.message)
        await refreshDevices()
      } else {
        toast.error('Magisk root failed', { description: res.error })
      }
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-6xl px-8 py-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <Wrench className="h-3.5 w-3.5" />
              Other Tools
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Root Workbench</h1>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Device-aware root preparation for emulators, debug builds, and Magisk-based real
              device workflows.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={!online || busy !== null}
              onClick={() => void runCheck()}
            >
              {busy === 'check' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Check
            </Button>
            <Button size="sm" disabled={!online || busy !== null} onClick={() => void tryAdbRoot()}>
              {busy === 'root' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Hash className="h-3.5 w-3.5" />
              )}
              ADB root
            </Button>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <MetricCard
            icon={<Smartphone className="h-4 w-4" />}
            label="Target"
            value={
              result
                ? targetKind === 'emulator'
                  ? 'Emulator'
                  : targetKind === 'real-device'
                    ? 'Real device'
                    : 'Unknown'
                : 'Unchecked'
            }
            detail={activeDevice?.label ?? 'No active device'}
          />
          <MetricCard
            icon={<Unlock className="h-4 w-4" />}
            label="Root"
            value={result?.rooted ? 'Available' : result ? 'Not available' : 'Unchecked'}
            detail={result?.rootMethod ?? result?.workflow.title ?? 'Run Check'}
            good={!!result?.rooted}
          />
          <MetricCard
            icon={<Shield className="h-4 w-4" />}
            label="Recommended path"
            value={magiskPath ? 'Magisk' : adbRootPath ? 'ADB root' : 'Pending'}
            detail={
              magiskPath
                ? `${recommendedPartition}.img workflow`
                : adbRootPath
                  ? 'Emulator/debug build'
                  : 'Classify target first'
            }
          />
        </section>

        {!online && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Connect an online device or start the emulator before using root tools.
          </div>
        )}

        <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
          <Panel
            title="Firmware Image"
            icon={<FileArchive className="h-3.5 w-3.5" />}
            action={
              <Button
                size="sm"
                variant="ghost"
                disabled={!online || busy !== null}
                onClick={() => void findFirmware()}
              >
                {busy === 'find-firmware' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Find
              </Button>
            }
          >
            <div className="space-y-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Official Pixel images are matched by device codename and build ID. Other devices can
                use a manual official firmware URL.
              </p>

              {firmwareSearch && (
                <div className="rounded-md border border-border bg-surface/40 p-3">
                  <div className="text-xs font-medium">{firmwareSearch.message}</div>
                  <div className="mt-2 grid gap-1 text-2xs text-muted-foreground">
                    <span>Codename: {firmwareSearch.deviceCodename ?? 'unknown'}</span>
                    <span>Build: {firmwareSearch.buildId ?? 'unknown'}</span>
                    <span>Recommended: {firmwareSearch.recommendedPartition}.img</span>
                  </div>
                  {firmwareSearch.candidates[0] && (
                    <div className="mt-2 truncate font-mono text-2xs text-primary">
                      {firmwareSearch.candidates[0].filename}
                    </div>
                  )}
                </div>
              )}

              <input
                value={manualFirmwareUrl}
                onChange={(e) => setManualFirmwareUrl(e.target.value)}
                placeholder="Manual official firmware URL (.zip)"
                className="h-9 w-full rounded-md border border-border bg-surface px-3 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary"
              />

              <div className="grid gap-2 text-xs text-muted-foreground">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={acceptedFirmwareTerms}
                    onChange={(e) => setAcceptedFirmwareTerms(e.currentTarget.checked)}
                  />
                  <span>
                    I confirm this is official firmware for my exact device/build and I accept the
                    vendor terms.
                  </span>
                </label>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={pushToDevice}
                    onChange={(e) => setPushToDevice(e.currentTarget.checked)}
                  />
                  <span>
                    Push the extracted stock image to the phone and open Magisk when available.
                  </span>
                </label>
              </div>

              <Button
                size="sm"
                disabled={busy !== null || !acceptedFirmwareTerms}
                onClick={() => void downloadFirmware()}
              >
                {busy === 'download-firmware' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Download and prepare
              </Button>

              {firmwareDownload && (
                <div className="rounded-md border border-success/30 bg-success/10 p-3 text-xs">
                  <div className="flex items-center gap-2 font-medium text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Stock image ready
                  </div>
                  <div className="mt-2 space-y-1 text-muted-foreground">
                    {firmwareDownload.extractedImages.map((image) => (
                      <div key={image.path} className="truncate font-mono text-2xs">
                        {image.partition}: {image.path} ({formatBytes(image.sizeBytes)})
                      </div>
                    ))}
                    {firmwareDownload.pushedToDevicePath && (
                      <div className="truncate font-mono text-2xs">
                        Phone: {firmwareDownload.pushedToDevicePath}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Magisk and Fastboot" icon={<Terminal className="h-3.5 w-3.5" />}>
            <div className="space-y-3">
              {result?.workflow.warnings.length ? (
                <div className="space-y-1 rounded-md border border-warning/30 bg-warning/10 p-2">
                  {result.workflow.warnings.map((warning) => (
                    <div key={warning} className="flex items-start gap-2 text-xs text-warning">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{warning}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  For real devices, patch the extracted stock image in Magisk, then flash the
                  Magisk-patched image from bootloader mode.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <RootActionButton
                  busy={busy === 'recovery'}
                  disabled={busy !== null}
                  onClick={() => void rebootForRoot('recovery')}
                >
                  Recovery
                </RootActionButton>
                <RootActionButton
                  busy={busy === 'bootloader'}
                  disabled={busy !== null}
                  onClick={() => void rebootForRoot('bootloader')}
                >
                  Bootloader
                </RootActionButton>
                <RootActionButton
                  busy={busy === 'fastboot'}
                  disabled={busy !== null}
                  onClick={() => void detectFastboot()}
                >
                  Detect fastboot
                </RootActionButton>
                <RootActionButton
                  busy={busy === 'system'}
                  disabled={busy !== null}
                  onClick={() => void rebootForRoot('system')}
                >
                  Reboot system
                </RootActionButton>
              </div>

              <div className="grid gap-3 rounded-md border border-border bg-surface/40 p-3">
                <div className="grid gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() => void detectPatchedImage()}
                    >
                      {busy === 'detect-patched' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FileSearch className="h-3.5 w-3.5" />
                      )}
                      Detect patched image
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() => void choosePatchedImage()}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Select
                    </Button>
                  </div>
                  <div className="truncate rounded-sm border border-border bg-background/40 px-2 py-1.5 font-mono text-2xs text-muted-foreground">
                    {patchedImagePath || 'No magisk_patched*.img selected'}
                  </div>
                </div>

                {patchedSearch && (
                  <div className="rounded-md border border-border bg-background/30 p-2 text-xs">
                    <div className="font-medium">{patchedSearch.message}</div>
                    {patchedSearch.selected && (
                      <div className="mt-1 grid gap-0.5 text-2xs text-muted-foreground">
                        <span>
                          Source:{' '}
                          {patchedSearch.selected.pulledFromDevice
                            ? 'phone Downloads'
                            : 'host storage'}
                        </span>
                        <span>Size: {formatBytes(patchedSearch.selected.sizeBytes)}</span>
                        <span>
                          Modified: {new Date(patchedSearch.selected.modifiedAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {patchedSearch.candidates.length > 1 && (
                      <div className="mt-2 space-y-1">
                        {patchedSearch.candidates.slice(0, 3).map((candidate) => (
                          <div
                            key={`${candidate.source}:${candidate.path}`}
                            className="truncate font-mono text-2xs text-muted-foreground"
                          >
                            {candidate.filename} ({candidate.source})
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Partition</span>
                  {PARTITIONS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPartition(item)}
                      className={cn(
                        'h-7 rounded-sm border px-2 font-mono text-2xs transition-colors',
                        partition === item
                          ? 'border-primary/60 bg-primary/10 text-primary'
                          : 'border-border bg-surface text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {item}
                      {item === recommendedPartition ? ' *' : ''}
                    </button>
                  ))}
                </div>

                <label className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-2 text-xs text-warning">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={flashConfirmed}
                    onChange={(e) => setFlashConfirmed(e.currentTarget.checked)}
                  />
                  <span>
                    The selected or auto-detected patched image matches this phone, and the selected
                    partition is correct.
                  </span>
                </label>

                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={rebootAfterFlash}
                    onChange={(e) => setRebootAfterFlash(e.currentTarget.checked)}
                  />
                  <span>Reboot Android automatically after the fastboot flash completes.</span>
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    disabled={!flashConfirmed || busy !== null}
                    onClick={() => void startMagiskRoot()}
                  >
                    {busy === 'start-magisk-root' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Rocket className="h-3.5 w-3.5" />
                    )}
                    Start Magisk root
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!patchedImagePath || !flashConfirmed || busy !== null}
                    onClick={() => void flashImage()}
                  >
                    {busy === 'flash' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Hash className="h-3.5 w-3.5" />
                    )}
                    Flash only
                  </Button>
                </div>
              </div>

              {actionResult && (
                <div className="rounded-md border border-border bg-surface/40 p-3">
                  <div className="text-xs font-medium">{actionResult.message}</div>
                  <div className="mt-2 space-y-1 text-2xs text-muted-foreground">
                    {actionResult.details.map((detail) => (
                      <div key={detail} className="whitespace-pre-wrap break-words">
                        {detail}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Panel>
        </section>
      </div>
    </div>
  )
}

function Panel({
  title,
  icon,
  action,
  children
}: {
  title: string
  icon: JSX.Element
  action?: JSX.Element
  children: ReactNode
}): JSX.Element {
  return (
    <section className="rounded-lg border border-border bg-surface/50">
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-border px-4 py-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {title}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  good = false
}: {
  icon: JSX.Element
  label: string
  value: string
  detail: string
  good?: boolean
}): JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-surface/50 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={cn('mt-3 text-lg font-semibold tracking-tight', good && 'text-success')}>
        {value}
      </div>
      <div className="mt-1 truncate text-xs text-muted-foreground">{detail}</div>
    </div>
  )
}

function RootActionButton({
  busy,
  disabled,
  onClick,
  children
}: {
  busy: boolean
  disabled: boolean
  onClick: () => void
  children: ReactNode
}): JSX.Element {
  return (
    <Button size="sm" variant="ghost" disabled={disabled} onClick={onClick}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
      {children}
    </Button>
  )
}
