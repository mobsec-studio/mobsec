import { create } from 'zustand'
import type { MirrorStatus, MirrorVideoInit } from '@shared/types'

interface MirrorState {
  status: MirrorStatus
  videoInit: MirrorVideoInit | null
  setStatus: (s: MirrorStatus) => void
  setVideoInit: (v: MirrorVideoInit) => void
  hydrate: () => Promise<void>
}

const initial: MirrorStatus = { state: 'idle', width: null, height: null }

export const useMirrorStore = create<MirrorState>((set) => ({
  status: initial,
  videoInit: null,
  setStatus: (s) => set({ status: s }),
  setVideoInit: (v) => set({ videoInit: v }),
  hydrate: async () => {
    const s = await window.api.mirror.getStatus()
    set({ status: s })
  }
}))
