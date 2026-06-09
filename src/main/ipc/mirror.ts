import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc-channels'
import { mirrorService } from '../services/mirror'
import { deviceService } from '../services/device'
import type { MirrorTouchEvent } from '@shared/types'
import { safe } from '../utils/result'

function isTouchEvent(raw: unknown): raw is MirrorTouchEvent {
  if (!raw || typeof raw !== 'object') return false
  const e = raw as Record<string, unknown>
  return (
    (e.action === 0 || e.action === 1 || e.action === 2) &&
    typeof e.pointerId === 'number' &&
    typeof e.x === 'number' &&
    typeof e.y === 'number' &&
    typeof e.pressure === 'number'
  )
}

export function registerMirrorIpc(): void {
  ipcMain.handle(IPC.mirror.getStatus, () => mirrorService.getStatus())

  ipcMain.handle(IPC.mirror.start, () =>
    safe('mirror.start', async () => {
      const device = deviceService.getActive()
      if (!device || device.state !== 'online') {
        throw new Error(
          'No active device. Plug in a USB device, connect over WiFi, or start the embedded emulator.'
        )
      }
      await mirrorService.start(device.serial)
    })
  )

  ipcMain.handle(IPC.mirror.stop, () => safe('mirror.stop', () => mirrorService.stop()))

  ipcMain.handle(IPC.mirror.sendTouch, (_e, raw: unknown) =>
    safe('mirror.sendTouch', () => {
      if (!isTouchEvent(raw)) throw new Error('Invalid touch event payload')
      return mirrorService.sendTouch(raw)
    })
  )

  ipcMain.handle(IPC.mirror.sendKey, (_e, keycode: unknown, action: unknown) =>
    safe('mirror.sendKey', () => {
      if (typeof keycode !== 'number') throw new Error('Keycode must be a number')
      if (action !== 'down' && action !== 'up') throw new Error('Action must be down or up')
      return mirrorService.sendKey(keycode, action)
    })
  )
}
