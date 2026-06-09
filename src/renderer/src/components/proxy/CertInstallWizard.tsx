import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Smartphone
} from 'lucide-react'
import { useEffect } from 'react'
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
import { useCaInstallStore } from '@/stores/useCaInstallStore'
import { selectActiveDevice, useDeviceStore } from '@/stores/useDeviceStore'
import { cn } from '@/lib/utils'

/**
 * Walks the user through finishing a CA cert install on the device.
 *
 * Why a wizard at all? Android does not let an app (or adb) install a
 * trusted CA without the user physically tapping "OK" on the device.
 * That's a deliberate platform security boundary, not something we can
 * bypass. So the best UX is to:
 *
 *   - Push the cert and launch the right Settings page automatically.
 *   - Tell the user exactly what to tap on the phone, with the steps
 *     tailored to their Android version (the modern Android 11+ flow
 *     looks completely different from Android 9).
 *   - Let them re-launch the installer if they dismissed it by accident.
 *   - Hand them a "Done — verify" path that confirms HTTPS is now being
 *     intercepted, so they don't have to guess.
 *
 * The wizard auto-opens when `ensureCaInstalled` returns
 * `user-action-required` for the active device. It's idempotent — opening
 * a second time without a state change is a no-op.
 */
export function CertInstallWizard(): JSX.Element {
  const result = useCaInstallStore((s) => s.result)
  const wizardOpen = useCaInstallStore((s) => s.wizardOpen)
  const inflight = useCaInstallStore((s) => s.inflight)
  const closeWizard = useCaInstallStore((s) => s.closeWizard)
  const reinstall = useCaInstallStore((s) => s.reinstall)
  const hydrate = useCaInstallStore((s) => s.hydrate)
  const active = useDeviceStore(selectActiveDevice)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  if (!result) return <Dialog open={false} onOpenChange={() => undefined} />

  const isUserAction = result.state === 'user-action-required'
  const isInstalled = result.state === 'installed' || result.state === 'already-installed'
  const isError = result.state === 'error'

  const onReinstall = async (): Promise<void> => {
    const r = await reinstall()
    if (!r) {
      toast.error('Re-install failed')
      return
    }
    if (r.state === 'installed' || r.state === 'already-installed') {
      toast.success(
        r.state === 'already-installed'
          ? 'Cert already installed — nothing to do.'
          : 'Cert installed.'
      )
    } else if (r.state === 'user-action-required') {
      toast.info('Look at your phone — installer dialog should be open.')
    } else if (r.state === 'error') {
      toast.error('Cert install failed', { description: r.message })
    }
  }

  return (
    <Dialog open={wizardOpen} onOpenChange={(o) => (!o ? closeWizard() : null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isInstalled ? (
              <ShieldCheck className="h-4 w-4 text-success" />
            ) : isError ? (
              <AlertCircle className="h-4 w-4 text-destructive" />
            ) : (
              <Smartphone className="h-4 w-4 text-primary" />
            )}
            {isInstalled
              ? 'HTTPS interception ready'
              : isError
                ? 'Certificate install failed'
                : 'Finish certificate install on your phone'}
          </DialogTitle>
          <DialogDescription>
            {pickHeaderBlurb(result.path, result.state)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <StepList result={result} />

          {result.guidance && (
            <div className="rounded-lg border border-border bg-surface/50 p-3 text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap font-mono">
              {result.guidance}
            </div>
          )}

          {result.certPathOnDevice && (
            <div className="rounded-lg border border-border bg-surface/30 p-3 text-2xs text-muted-foreground">
              <div className="mb-1 uppercase tracking-wider text-foreground/70">
                Cert on device
              </div>
              <div className="font-mono break-all text-foreground">
                {result.certPathOnDevice}
              </div>
            </div>
          )}

          {active && !active.capabilities.rooted && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-2xs leading-relaxed text-warning">
              <span className="font-semibold">Heads up — this is the user trust store.</span>{' '}
              Browsers (Chrome included) honour it. Most production apps with their own
              Network Security Config (banking, messaging, anti-MitM SDKs) won&apos;t. Root the
              device or attach Frida Gadget to those apps for full HTTPS visibility.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={closeWizard}>
            Close
          </Button>
          {isUserAction && (
            <Button
              variant="outline"
              size="sm"
              disabled={inflight}
              onClick={() => void onReinstall()}
            >
              {inflight ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Re-launching…
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" /> Re-launch installer
                </>
              )}
            </Button>
          )}
          {isUserAction && (
            <Button size="sm" onClick={closeWizard}>
              <CheckCircle2 className="h-3.5 w-3.5" /> I&apos;ve installed it
            </Button>
          )}
          {isError && (
            <Button size="sm" disabled={inflight} onClick={() => void onReinstall()}>
              {inflight ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Retrying…
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" /> Retry
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function pickHeaderBlurb(
  path: string | undefined,
  state: string
): string {
  if (state === 'installed' || state === 'already-installed') {
    if (path === 'magisk-module') {
      return 'Cert is live now AND persisted via Magisk. HTTPS interception works for every app.'
    }
    if (path === 'system-store') {
      return 'Cert is in the system trust store. Every app on the device trusts it.'
    }
    if (path === 'user-store') {
      return 'Cert is in the user trust store. Apps that opt into the user store (browsers, dev builds) trust it.'
    }
    return 'Cert installed.'
  }
  if (state === 'error') {
    return 'Something went wrong while installing the certificate. The exact error and the steps to recover are below.'
  }
  if (path === 'user-store') {
    return "Android won't let any app silently install a trusted CA — that's a platform security feature. We pushed the cert and opened Settings on your phone. Tap through to finish."
  }
  return ''
}

interface StepListProps {
  result: NonNullable<ReturnType<typeof useCaInstallStore.getState>['result']>
}

function StepList({ result }: StepListProps): JSX.Element {
  // For the user-store path we render the three-stage journey:
  //   1. Cert pushed
  //   2. Installer launched
  //   3. User taps through on device
  // For other paths it's a single done/error line.
  if (result.path === 'user-store') {
    return (
      <ol className="space-y-2">
        <StepRow done label="Certificate pushed to device" detail="mobsec-ca.crt in /sdcard/Download/" />
        <StepRow
          done
          label="Installer launched on phone"
          detail="If you don't see anything, hit Re-launch below."
        />
        <StepRow
          pending={result.state === 'user-action-required'}
          done={result.state === 'installed' || result.state === 'already-installed'}
          label="Tap through on the phone"
          detail="Follow the steps below — they're tailored to your Android version."
        />
      </ol>
    )
  }
  return (
    <ol className="space-y-2">
      <StepRow done={result.state === 'installed' || result.state === 'already-installed'} label={result.message} />
    </ol>
  )
}

interface StepRowProps {
  done?: boolean
  pending?: boolean
  label: string
  detail?: string
}

function StepRow({ done, pending, label, detail }: StepRowProps): JSX.Element {
  return (
    <li className="flex items-start gap-2.5">
      <div
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
          done
            ? 'border-success/40 bg-success/15 text-success'
            : pending
              ? 'border-primary/40 bg-primary/15 text-primary'
              : 'border-border bg-surface text-muted-foreground'
        )}
      >
        {done ? (
          <CheckCircle2 className="h-3 w-3" />
        ) : pending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-foreground">{label}</div>
        {detail && <div className="mt-0.5 text-2xs text-muted-foreground">{detail}</div>}
      </div>
    </li>
  )
}
