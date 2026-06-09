import { create } from 'zustand'
import type { AppInfo, Project } from '@shared/types'

interface AppState {
  info: AppInfo | null
  activeProject: Project | null
  isMaximized: boolean
  hydrate: () => Promise<void>
  refreshProject: () => Promise<void>
  setMaximized: (max: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  info: null,
  activeProject: null,
  isMaximized: false,
  hydrate: async () => {
    const [info, project, isMaximized] = await Promise.all([
      window.api.app.getInfo(),
      window.api.db.getActiveProject(),
      window.api.app.isMaximized()
    ])
    set({
      info,
      activeProject: project.ok ? project.value : null,
      isMaximized
    })
  },
  refreshProject: async () => {
    const project = await window.api.db.getActiveProject()
    set({ activeProject: project.ok ? project.value : null })
  },
  setMaximized: (max) => set({ isMaximized: max })
}))
