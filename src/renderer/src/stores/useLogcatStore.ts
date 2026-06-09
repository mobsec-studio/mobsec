import { create } from 'zustand'
import type { LogcatLine, LogcatStatus, LogLevel } from '@shared/types'

/** Ring-buffer cap. 10k lines keeps memory bounded yet covers long sessions. */
const MAX_LINES = 10_000

export interface LogcatFilters {
  levels: Record<LogLevel, boolean>
  search: string
  regex: boolean
  caseSensitive: boolean
  /** Space/comma-separated substrings; a line's tag must match ANY to pass. */
  tagInclude: string
  /** Space/comma-separated substrings; a line is hidden if its tag matches ANY. */
  tagExclude: string
}

const DEFAULT_FILTERS: LogcatFilters = {
  levels: { V: true, D: true, I: true, W: true, E: true, F: true },
  search: '',
  regex: false,
  caseSensitive: false,
  tagInclude: '',
  tagExclude: ''
}

const DEFAULT_STATUS: LogcatStatus = {
  running: false,
  serial: null,
  buffers: ['main', 'system', 'crash'],
  minLevel: 'V',
  pid: null
}

interface LogcatState {
  lines: LogcatLine[]
  status: LogcatStatus
  filters: LogcatFilters
  /** Soft-wrap long messages (off = fixed-height rows, virtualized). */
  wrap: boolean
  /** Freeze the visible stream while the backend keeps capturing. */
  paused: boolean
  /** Number of incoming lines suppressed while paused. */
  pausedCount: number
  appendLines: (lines: LogcatLine[]) => void
  clearLines: () => void
  setStatus: (status: LogcatStatus) => void
  setFilters: (patch: Partial<LogcatFilters>) => void
  toggleLevel: (level: LogLevel) => void
  resetFilters: () => void
  setWrap: (wrap: boolean) => void
  setPaused: (paused: boolean) => void
  hydrate: () => Promise<void>
}

export const useLogcatStore = create<LogcatState>((set) => ({
  lines: [],
  status: DEFAULT_STATUS,
  filters: DEFAULT_FILTERS,
  wrap: false,
  paused: false,
  pausedCount: 0,
  appendLines: (incoming) =>
    set((s) => {
      if (incoming.length === 0) return s
      if (s.paused) return { pausedCount: s.pausedCount + incoming.length }
      const merged = [...s.lines, ...incoming]
      return { lines: merged.length > MAX_LINES ? merged.slice(-MAX_LINES) : merged }
    }),
  clearLines: () => set({ lines: [], pausedCount: 0 }),
  setStatus: (status) => set({ status }),
  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
  toggleLevel: (level) =>
    set((s) => ({
      filters: { ...s.filters, levels: { ...s.filters.levels, [level]: !s.filters.levels[level] } }
    })),
  resetFilters: () => set({ filters: DEFAULT_FILTERS }),
  setWrap: (wrap) => set({ wrap }),
  setPaused: (paused) => set({ paused, pausedCount: 0 }),
  hydrate: async () => {
    const r = await window.api.logcat.getStatus()
    if (r.ok) set({ status: r.value })
  }
}))
