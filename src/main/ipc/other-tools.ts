import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { MagiskFlashPartition, RootRebootMode } from '@shared/types'
import { otherToolsService } from '../services/other-tools'
import { safe } from '../utils/result'

export function registerOtherToolsIpc(): void {
  ipcMain.handle(IPC.otherTools.rootCheck, () =>
    safe('otherTools.rootCheck', () => otherToolsService.rootCheck())
  )

  ipcMain.handle(IPC.otherTools.tryAdbRoot, () =>
    safe('otherTools.tryAdbRoot', () => otherToolsService.tryAdbRoot())
  )

  ipcMain.handle(IPC.otherTools.rebootForRoot, (_e, mode: unknown) =>
    safe('otherTools.rebootForRoot', () => {
      if (!isRootRebootMode(mode)) throw new Error('Invalid reboot mode')
      return otherToolsService.rebootForRoot(mode)
    })
  )

  ipcMain.handle(IPC.otherTools.listFastbootDevices, () =>
    safe('otherTools.listFastbootDevices', () => otherToolsService.listFastbootDevices())
  )

  ipcMain.handle(IPC.otherTools.flashMagiskPatchedImage, (_e, raw: unknown) =>
    safe('otherTools.flashMagiskPatchedImage', () => {
      if (!raw || typeof raw !== 'object') throw new Error('Invalid payload')
      const r = raw as Record<string, unknown>
      if (typeof r.imagePath !== 'string') throw new Error('Image path must be a string')
      if (!isMagiskFlashPartition(r.partition)) throw new Error('Invalid partition')
      return otherToolsService.flashMagiskPatchedImage({
        imagePath: r.imagePath,
        partition: r.partition,
        confirmed: r.confirmed === true
      })
    })
  )

  ipcMain.handle(IPC.otherTools.detectMagiskPatchedImages, () =>
    safe('otherTools.detectMagiskPatchedImages', () =>
      otherToolsService.detectMagiskPatchedImages()
    )
  )

  ipcMain.handle(IPC.otherTools.startMagiskRoot, (_e, raw: unknown) =>
    safe('otherTools.startMagiskRoot', () => {
      if (!raw || typeof raw !== 'object') throw new Error('Invalid payload')
      const r = raw as Record<string, unknown>
      if (r.imagePath !== undefined && typeof r.imagePath !== 'string') {
        throw new Error('Image path must be a string')
      }
      if (!isMagiskFlashPartition(r.partition)) throw new Error('Invalid partition')
      return otherToolsService.startMagiskRoot({
        imagePath: typeof r.imagePath === 'string' ? r.imagePath : undefined,
        partition: r.partition,
        confirmed: r.confirmed === true,
        rebootAfterFlash: r.rebootAfterFlash !== false
      })
    })
  )

  ipcMain.handle(IPC.otherTools.findFirmwareImages, () =>
    safe('otherTools.findFirmwareImages', () => otherToolsService.findFirmwareImages())
  )

  ipcMain.handle(IPC.otherTools.downloadFirmwareImage, (_e, raw: unknown) =>
    safe('otherTools.downloadFirmwareImage', () => {
      if (!raw || typeof raw !== 'object') throw new Error('Invalid payload')
      const r = raw as Record<string, unknown>
      return otherToolsService.downloadFirmwareImage({
        url: typeof r.url === 'string' ? r.url : undefined,
        acceptedTerms: r.acceptedTerms === true,
        pushToDevice: r.pushToDevice === true
      })
    })
  )
}

function isRootRebootMode(value: unknown): value is RootRebootMode {
  return value === 'recovery' || value === 'bootloader' || value === 'system'
}

function isMagiskFlashPartition(value: unknown): value is MagiskFlashPartition {
  return value === 'boot' || value === 'init_boot' || value === 'recovery'
}
