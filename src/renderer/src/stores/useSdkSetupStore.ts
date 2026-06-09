import { create } from 'zustand'
import type { SdkSetupOptions, SdkSetupProgress } from '@shared/types'

interface SdkSetupState {
  progress: SdkSetupProgress
  options: SdkSetupOptions
  /** Running flag derived from progress.phase — exposed for convenience. */
  isRunning: boolean
  setProgress: (p: SdkSetupProgress) => void
  setOptions: (next: Partial<SdkSetupOptions>) => void
  hydrate: () => Promise<void>
  start: () => Promise<void>
  cancel: () => Promise<void>
}

const DEFAULTS: SdkSetupOptions = {
  apiLevel: 33,
  variant: 'google_apis',
  abi: 'x86_64',
  deviceProfile: 'pixel_5',
  avdName: 'MobSec_Pixel5_API33',
  ramMb: 2048,
  diskGb: 6
}

const initialProgress: SdkSetupProgress = {
  phase: 'idle',
  overallPercent: 0,
  stepPercent: 0,
  message: ''
}

function runningFromPhase(phase: SdkSetupProgress['phase']): boolean {
  return phase !== 'idle' && phase !== 'done' && phase !== 'error'
}

export const useSdkSetupStore = create<SdkSetupState>((set, get) => ({
  progress: initialProgress,
  options: DEFAULTS,
  isRunning: false,
  setProgress: (p) => set({ progress: p, isRunning: runningFromPhase(p.phase) }),
  setOptions: (next) => set({ options: { ...get().options, ...next } }),
  hydrate: async () => {
    const p = await window.api.sdk.getProgress()
    set({ progress: p, isRunning: runningFromPhase(p.phase) })
  },
  start: async () => {
    const res = await window.api.sdk.runFullSetup(get().options)
    if (!res.ok) throw new Error(res.error)
  },
  cancel: async () => {
    await window.api.sdk.cancelSetup()
  }
}))
