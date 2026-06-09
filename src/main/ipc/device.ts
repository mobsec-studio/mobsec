import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc-channels'
import { deviceService } from '../services/device'
import { safe } from '../utils/result'

export function registerDeviceIpc(): void {
  ipcMain.handle(IPC.device.list, () => safe('device.list', () => deviceService.getSnapshot()))

  ipcMain.handle(IPC.device.getActive, () =>
    safe('device.getActive', () => deviceService.getActive())
  )

  ipcMain.handle(IPC.device.setActive, (_e, raw: unknown) =>
    safe('device.setActive', () => {
      if (raw !== null && typeof raw !== 'string') {
        throw new Error('Serial must be a string or null')
      }
      deviceService.setActive(raw)
    })
  )

  ipcMain.handle(IPC.device.refresh, () => safe('device.refresh', () => deviceService.refresh()))

  ipcMain.handle(IPC.device.enableTcpip, (_e, serial: unknown, port: unknown) =>
    safe('device.enableTcpip', () => {
      if (typeof serial !== 'string') throw new Error('Serial must be a string')
      const p = typeof port === 'number' ? port : undefined
      return deviceService.enableTcpip(serial, p)
    })
  )

  ipcMain.handle(IPC.device.connect, (_e, target: unknown) =>
    safe('device.connect', () => {
      if (typeof target !== 'string') throw new Error('Target must be host:port')
      return deviceService.connect(target)
    })
  )

  ipcMain.handle(IPC.device.disconnect, (_e, serial: unknown) =>
    safe('device.disconnect', () => {
      if (typeof serial !== 'string') throw new Error('Serial must be a string')
      return deviceService.disconnect(serial)
    })
  )

  ipcMain.handle(IPC.device.sendKey, (_e, key: unknown) =>
    safe('device.sendKey', () => {
      if (typeof key !== 'string') throw new Error('Key must be a string')
      return deviceService.sendKey(key)
    })
  )

  ipcMain.handle(IPC.device.wirelessConnect, (_e, raw: unknown) =>
    safe('device.wirelessConnect', () => {
      if (!raw || typeof raw !== 'object') throw new Error('Invalid payload')
      const r = raw as Record<string, unknown>
      return deviceService.wirelessConnect({
        fromSerial: typeof r.fromSerial === 'string' ? r.fromSerial : undefined,
        hostPort: typeof r.hostPort === 'string' ? r.hostPort : undefined,
        port: typeof r.port === 'number' ? r.port : undefined
      })
    })
  )

  ipcMain.handle(IPC.device.pairWireless, (_e, raw: unknown) =>
    safe('device.pairWireless', () => {
      if (!raw || typeof raw !== 'object') throw new Error('Invalid payload')
      const r = raw as Record<string, unknown>
      if (typeof r.pairHostPort !== 'string') {
        throw new Error('Pairing address must be host:port')
      }
      if (typeof r.pairingCode !== 'string') {
        throw new Error('Pairing code must be a string')
      }
      return deviceService.pairWireless({
        pairHostPort: r.pairHostPort,
        pairingCode: r.pairingCode,
        connectHostPort: typeof r.connectHostPort === 'string' ? r.connectHostPort : undefined
      })
    })
  )
}
