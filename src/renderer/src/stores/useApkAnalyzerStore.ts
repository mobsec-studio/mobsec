import { create } from 'zustand'
import type { ApkAnalysisSummary } from '@shared/types'

/**
 * Renderer state for the APK Analyzer.
 *
 * `summary` is the full payload the backend returned for the currently
 * loaded APK; `analyzing` gates the UI between drop-zone and analyzer
 * view. Custom regex patterns live here too because they're scoped to
 * the user's session — we deliberately don't persist them (yet) to
 * keep the surface small.
 */
export interface CustomPattern {
  id: string
  label: string
  regex: string
}

interface ApkAnalyzerState {
  filePath: string | null
  summary: ApkAnalysisSummary | null
  analyzing: boolean
  /** Last error from a failed analyze() call. Surfaced as an overlay. */
  error: string | null
  /** Active subtab in the analyzer UI. */
  tab: AnalyzerTab
  customPatterns: CustomPattern[]

  loadFromPath: (path: string) => Promise<void>
  reanalyzeWithCustom: () => Promise<void>
  reset: () => void
  setTab: (tab: AnalyzerTab) => void
  addCustomPattern: (p: Omit<CustomPattern, 'id'>) => void
  removeCustomPattern: (id: string) => void
}

export type AnalyzerTab =
  | 'overview'
  | 'intelligence'
  | 'surface'
  | 'network'
  | 'inventory'
  | 'manifest'
  | 'permissions'
  | 'components'
  | 'security'
  | 'secrets'
  | 'endpoints'
  | 'trackers'
  | 'native'
  | 'strings'

export const useApkAnalyzerStore = create<ApkAnalyzerState>((set, get) => ({
  filePath: null,
  summary: null,
  analyzing: false,
  error: null,
  tab: 'overview',
  customPatterns: [],

  loadFromPath: async (path: string) => {
    set({ analyzing: true, error: null, filePath: path })
    try {
      const res = await window.api.apk.analyze(path)
      if (res.ok) set({ summary: res.value, analyzing: false })
      else set({ error: res.error, analyzing: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
        analyzing: false
      })
    }
  },

  reanalyzeWithCustom: async () => {
    const { filePath, customPatterns } = get()
    if (!filePath) return
    set({ analyzing: true, error: null })
    try {
      const patterns = customPatterns.map((p) => p.regex)
      const res = await window.api.apk.searchSecrets(filePath, patterns)
      if (res.ok) {
        const summary = get().summary
        if (summary) set({ summary: { ...summary, secrets: res.value }, analyzing: false })
        else set({ analyzing: false })
      } else {
        set({ error: res.error, analyzing: false })
      }
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
        analyzing: false
      })
    }
  },

  reset: () => set({ filePath: null, summary: null, error: null, tab: 'overview' }),
  setTab: (tab) => set({ tab }),
  addCustomPattern: (p) =>
    set((s) => ({
      customPatterns: [...s.customPatterns, { ...p, id: `custom-${Date.now()}` }]
    })),
  removeCustomPattern: (id) =>
    set((s) => ({ customPatterns: s.customPatterns.filter((p) => p.id !== id) }))
}))
