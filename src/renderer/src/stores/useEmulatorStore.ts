import { create } from 'zustand'
import type { AndroidSdk, AvdInfo, EmulatorBootProgress, EmulatorStatus } from '@shared/types'

interface EmulatorState {
  status: EmulatorStatus
  avds: AvdInfo[]
  selectedAvd: string | null
  sdk: AndroidSdk | null
  bootProgress: EmulatorBootProgress | null
  setStatus: (s: EmulatorStatus) => void
  setBootProgress: (p: EmulatorBootProgress) => void
  hydrate: () => Promise<void>
  refreshAvds: () => Promise<void>
  selectAvd: (name: string) => Promise<void>
  start: () => Promise<void>
  stop: () => Promise<void>
  restart: () => Promise<void>
  sendKey: (key: string) => Promise<void>
}

const initial: EmulatorStatus = { state: 'idle', avdName: null, serial: null }

export const useEmulatorStore = create<EmulatorState>((set, get) => ({
  status: initial,
  avds: [],
  selectedAvd: null,
  sdk: null,
  bootProgress: null,
  setStatus: (s) => {
    set({ status: s })
    // Clear boot progress once the emulator settles.
    if (s.state === 'running' || s.state === 'idle' || s.state === 'error') {
      set({ bootProgress: null })
    }
  },
  setBootProgress: (p) => set({ bootProgress: p }),
  hydrate: async () => {
    const [status, sdkRes, selectedAvdRes] = await Promise.all([
      window.api.emulator.getStatus(),
      window.api.emulator.detectSdk(),
      window.api.emulator.getSelectedAvd()
    ])
    set({
      status,
      sdk: sdkRes.ok ? sdkRes.value : null,
      selectedAvd: selectedAvdRes.ok ? selectedAvdRes.value : null
    })
    await get().refreshAvds()
  },
  refreshAvds: async () => {
    const res = await window.api.emulator.listAvds()
    set({ avds: res.ok ? res.value : [] })
  },
  selectAvd: async (name) => {
    const res = await window.api.emulator.selectAvd(name)
    if (!res.ok) throw new Error(res.error)
    set({ selectedAvd: name })
  },
  start: async () => {
    const res = await window.api.emulator.start()
    if (!res.ok) throw new Error(res.error)
  },
  stop: async () => {
    const res = await window.api.emulator.stop()
    if (!res.ok) throw new Error(res.error)
  },
  restart: async () => {
    const res = await window.api.emulator.restart()
    if (!res.ok) throw new Error(res.error)
  },
  sendKey: async (key) => {
    const res = await window.api.emulator.sendKey(key)
    if (!res.ok) throw new Error(res.error)
  }
}))
