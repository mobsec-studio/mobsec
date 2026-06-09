import { create } from 'zustand'
import {
  applyTheme,
  readStoredMode,
  resolveTheme,
  storeMode,
  type ResolvedTheme,
  type ThemeMode
} from '@/lib/theme'

interface ThemeState {
  mode: ThemeMode
  /** The concrete theme in effect (system resolved to light/dark). */
  resolved: ResolvedTheme
  setMode: (mode: ThemeMode) => void
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const initialMode = readStoredMode()

  // Live-follow the OS preference, but only while in 'system' mode.
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', () => {
      if (get().mode !== 'system') return
      set({ resolved: applyTheme('system', true) })
    })
  }

  return {
    mode: initialMode,
    resolved: resolveTheme(initialMode),
    setMode: (mode) => {
      storeMode(mode)
      set({ mode, resolved: applyTheme(mode, true) })
    }
  }
})

/** Convenience selector for components that only need the effective theme. */
export function useResolvedTheme(): ResolvedTheme {
  return useThemeStore((s) => s.resolved)
}
