import { create } from 'zustand'
import type { Device, DeviceList, WirelessConnectProgress } from '@shared/types'

/**
 * Renderer-side mirror of the main-process device list. Subscribes to
 * `device:listChanged` and `device:activeChanged` push events; never
 * holds state the main process doesn't know about.
 *
 * The active device is read from `list.activeSerial` rather than a
 * derived field so an explicit `setActive(null)` (user picks "no device")
 * round-trips correctly.
 */
interface DeviceState {
  devices: Device[]
  activeSerial: string | null
  /** Last wireless wizard status, surfaced inline in the connect dialog. */
  wirelessProgress: WirelessConnectProgress | null
  /** Whether the renderer has finished its first hydrate. */
  hydrated: boolean

  applyList: (list: DeviceList) => void
  setWirelessProgress: (p: WirelessConnectProgress | null) => void
  hydrate: () => Promise<void>
  refresh: () => Promise<void>
  setActive: (serial: string | null) => Promise<void>
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
  devices: [],
  activeSerial: null,
  wirelessProgress: null,
  hydrated: false,
  applyList: (list) =>
    set({ devices: list.devices, activeSerial: list.activeSerial, hydrated: true }),
  setWirelessProgress: (p) => set({ wirelessProgress: p }),
  hydrate: async () => {
    const res = await window.api.device.list()
    if (res.ok) get().applyList(res.value)
  },
  refresh: async () => {
    const res = await window.api.device.refresh()
    if (res.ok) get().applyList(res.value)
  },
  setActive: async (serial) => {
    await window.api.device.setActive(serial)
    // The main process will fire `device:activeChanged` which our
    // subscriber will pick up. We also optimistically update so the UI
    // doesn't flicker between the click and the push.
    set({ activeSerial: serial })
  }
}))

/** Convenience selector: the active Device record, or null. */
export function selectActiveDevice(s: {
  devices: Device[]
  activeSerial: string | null
}): Device | null {
  if (!s.activeSerial) return null
  return s.devices.find((d) => d.serial === s.activeSerial) ?? null
}
