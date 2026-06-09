import { create } from 'zustand'
import type { EmulatorInstall } from '@shared/types'

/**
 * Cache + actions for the third-party emulator detection feature.
 * Mirrors the main-process `emulatorInstallsService` so the UI doesn't
 * round-trip an IPC call for every render.
 */
interface EmulatorInstallsState {
  installs: EmulatorInstall[]
  loading: boolean
  /** Set of install ids currently launching (so the UI can disable the
   *  Launch button and show a spinner while we wait for the process to
   *  spawn). */
  launching: Set<string>
  /** Same idea for `connectAll`. */
  connecting: Set<string>

  hydrate: () => Promise<void>
  refresh: () => Promise<void>
  launch: (installId: string) => Promise<void>
  connectAll: (installId: string) => Promise<{ connected: string[]; failed: string[] }>
}

export const useEmulatorInstallsStore = create<EmulatorInstallsState>((set, get) => ({
  installs: [],
  loading: false,
  launching: new Set(),
  connecting: new Set(),

  hydrate: async () => {
    set({ loading: true })
    try {
      const res = await window.api.emulatorInstalls.list()
      if (res.ok) set({ installs: res.value })
    } finally {
      set({ loading: false })
    }
  },

  refresh: async () => {
    set({ loading: true })
    try {
      const res = await window.api.emulatorInstalls.refresh()
      if (res.ok) set({ installs: res.value })
    } finally {
      set({ loading: false })
    }
  },

  launch: async (installId) => {
    set((s) => {
      const next = new Set(s.launching)
      next.add(installId)
      return { launching: next }
    })
    try {
      const res = await window.api.emulatorInstalls.launch(installId)
      if (!res.ok) throw new Error(res.error)
    } finally {
      // Hold the spinner for a couple of seconds so the user notices
      // we kicked off the launcher; the actual emulator boot takes
      // 10–60s and we surface progress via the device picker.
      setTimeout(() => {
        set((s) => {
          const next = new Set(s.launching)
          next.delete(installId)
          return { launching: next }
        })
      }, 2000)
    }
  },

  connectAll: async (installId) => {
    set((s) => {
      const next = new Set(s.connecting)
      next.add(installId)
      return { connecting: next }
    })
    try {
      const res = await window.api.emulatorInstalls.connectAll(installId)
      if (!res.ok) throw new Error(res.error)
      return res.value
    } finally {
      set((s) => {
        const next = new Set(s.connecting)
        next.delete(installId)
        return { connecting: next }
      })
    }
    void get
  }
}))
