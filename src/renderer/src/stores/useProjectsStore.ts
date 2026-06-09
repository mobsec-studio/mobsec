import { create } from 'zustand'
import type { Project } from '@shared/types'

interface ProjectsState {
  projects: Project[]
  active: Project | null
  loading: boolean
  /** Bumps whenever the active project changes. Other stores listen on this
   *  so they can re-hydrate without us coupling them to projects directly. */
  activeEpoch: number
  hydrate: () => Promise<void>
  create: (name: string) => Promise<Project>
  rename: (id: string, name: string) => Promise<Project>
  remove: (id: string) => Promise<void>
  setActive: (id: string) => Promise<void>
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  active: null,
  loading: false,
  activeEpoch: 0,
  hydrate: async () => {
    set({ loading: true })
    const [listRes, activeRes] = await Promise.all([
      window.api.db.listProjects(),
      window.api.db.getActiveProject()
    ])
    set({
      projects: listRes.ok ? listRes.value : [],
      active: activeRes.ok ? activeRes.value : null,
      loading: false
    })
  },
  create: async (name) => {
    const res = await window.api.db.createProject(name)
    if (!res.ok) throw new Error(res.error)
    set((s) => ({ projects: [res.value, ...s.projects] }))
    return res.value
  },
  rename: async (id, name) => {
    const res = await window.api.db.renameProject(id, name)
    if (!res.ok) throw new Error(res.error)
    set((s) => ({
      projects: s.projects.map((p) => (p.id === res.value.id ? res.value : p)),
      active: s.active?.id === res.value.id ? res.value : s.active
    }))
    return res.value
  },
  remove: async (id) => {
    const res = await window.api.db.deleteProject(id)
    if (!res.ok) throw new Error(res.error)
    const wasActive = get().active?.id === id
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }))
    if (wasActive) {
      // Pick the first remaining (or fall through to backend's auto-create).
      const remaining = get().projects[0]
      if (remaining) {
        await get().setActive(remaining.id)
      } else {
        // Force backend to create a fresh Untitled and re-hydrate.
        await get().hydrate()
        set((s) => ({ activeEpoch: s.activeEpoch + 1 }))
      }
    }
  },
  setActive: async (id) => {
    const cur = get().active
    if (cur?.id === id) return
    const res = await window.api.db.setActiveProject(id)
    if (!res.ok) throw new Error(res.error)
    const next = get().projects.find((p) => p.id === id) ?? null
    set((s) => ({ active: next, activeEpoch: s.activeEpoch + 1 }))
  }
}))
