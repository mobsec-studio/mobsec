import { create } from 'zustand'
import type { ToolInfo, ToolInstallProgress } from '@shared/types'

interface ToolchainState {
  tools: ToolInfo[]
  /** Per-tool progress streamed from the install pipeline. */
  progress: Record<string, ToolInstallProgress>
  loading: boolean
  hydrate: () => Promise<void>
  install: (toolId: string) => Promise<void>
  applyProgress: (p: ToolInstallProgress) => void
}

export const useToolchainStore = create<ToolchainState>((set, get) => ({
  tools: [],
  progress: {},
  loading: false,
  hydrate: async () => {
    set({ loading: true })
    const res = await window.api.toolchain.list()
    if (res.ok) {
      set({ tools: res.value, loading: false })
    } else {
      set({ loading: false })
    }
  },
  install: async (toolId) => {
    const res = await window.api.toolchain.install(toolId)
    if (!res.ok) {
      throw new Error(res.error)
    }
    await get().hydrate()
  },
  applyProgress: (p) =>
    set((state) => {
      const progress = { ...state.progress, [p.toolId]: p }
      // Reflect terminal phases in the tool list so consumers can render a
      // green checkmark without re-fetching.
      const tools =
        p.phase === 'done' || p.phase === 'error'
          ? state.tools.map((t) =>
              t.id === p.toolId
                ? {
                    ...t,
                    state: (p.phase === 'done' ? 'installed' : 'error') as ToolInfo['state'],
                    errorMessage: p.phase === 'error' ? p.message : undefined
                  }
                : t
            )
          : state.tools
      return { progress, tools }
    })
}))
