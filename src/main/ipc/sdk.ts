import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { SdkSetupOptions } from '@shared/types'
import { deleteAvd } from '../services/avdmanager'
import { sdkSetupService } from '../services/sdk-setup'
import { safe } from '../utils/result'

function sanitizeOptions(raw: unknown): Partial<SdkSetupOptions> {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as Record<string, unknown>
  const out: Partial<SdkSetupOptions> = {}
  if (typeof o.apiLevel === 'number') out.apiLevel = o.apiLevel
  if (o.variant === 'google_apis' || o.variant === 'google_apis_playstore') out.variant = o.variant
  if (o.abi === 'x86_64' || o.abi === 'arm64-v8a') out.abi = o.abi
  if (typeof o.deviceProfile === 'string') out.deviceProfile = o.deviceProfile
  if (typeof o.avdName === 'string') out.avdName = o.avdName
  if (typeof o.ramMb === 'number') out.ramMb = o.ramMb
  if (typeof o.diskGb === 'number') out.diskGb = o.diskGb
  return out
}

export function registerSdkIpc(): void {
  ipcMain.handle(IPC.sdk.runFullSetup, (_e, raw: unknown) =>
    safe('sdk.runFullSetup', () => sdkSetupService.runFullSetup(sanitizeOptions(raw)))
  )

  ipcMain.handle(IPC.sdk.getProgress, () => sdkSetupService.getProgress())

  ipcMain.handle(IPC.sdk.cancelSetup, () =>
    safe('sdk.cancelSetup', () => sdkSetupService.cancel())
  )

  ipcMain.handle(IPC.sdk.createAvd, (_e, raw: unknown) =>
    safe('sdk.createAvd', () => {
      const opts = sanitizeOptions(raw)
      // createAvd requires the full options shape; runFullSetup is the
      // friendlier path for new users.
      return sdkSetupService.runFullSetup(opts)
    })
  )

  ipcMain.handle(IPC.sdk.deleteAvd, (_e, raw: unknown) =>
    safe('sdk.deleteAvd', () => {
      if (typeof raw !== 'string') throw new Error('AVD name must be a string')
      return deleteAvd(raw)
    })
  )

  ipcMain.handle(IPC.sdk.listSystemImages, () =>
    safe('sdk.listSystemImages', async (): Promise<string[]> => {
      // Phase 2.5 enhancement; for now return an empty list and rely on
      // DEFAULT_SDK_SETUP defaults.
      return []
    })
  )
}
