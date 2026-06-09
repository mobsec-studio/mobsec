import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type ToolId =
  | 'dashboard'
  | 'proxy'
  | 'repeater'
  | 'frida'
  | 'apk'
  | 'jadx'
  | 'logcat'
  | 'tools'
  | 'settings'

export type SettingsSectionId = 'overview' | 'projects' | 'devices' | 'tools' | 'sdk' | 'about'

interface UIState {
  activeTool: ToolId
  activeSettingsSection: SettingsSectionId
  sidebarCollapsed: boolean
  emulatorPanelSize: number
  emulatorPanelVisible: boolean
  commandPaletteOpen: boolean
  setActiveTool: (id: ToolId) => void
  setActiveSettingsSection: (id: SettingsSectionId) => void
  openSettingsSection: (id: SettingsSectionId) => void
  toggleSidebar: () => void
  setEmulatorPanelSize: (size: number) => void
  toggleEmulatorPanel: () => void
  setCommandPaletteOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      activeTool: 'dashboard',
      activeSettingsSection: 'overview',
      sidebarCollapsed: false,
      emulatorPanelSize: 30,
      emulatorPanelVisible: true,
      commandPaletteOpen: false,
      setActiveTool: (id) => set({ activeTool: id }),
      setActiveSettingsSection: (id) => set({ activeSettingsSection: id }),
      openSettingsSection: (id) => set({ activeTool: 'settings', activeSettingsSection: id }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setEmulatorPanelSize: (size) => set({ emulatorPanelSize: size }),
      toggleEmulatorPanel: () => set((s) => ({ emulatorPanelVisible: !s.emulatorPanelVisible })),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open })
    }),
    {
      name: 'mobsec.ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        activeTool: s.activeTool,
        sidebarCollapsed: s.sidebarCollapsed,
        activeSettingsSection: s.activeSettingsSection,
        emulatorPanelSize: s.emulatorPanelSize,
        emulatorPanelVisible: s.emulatorPanelVisible
      })
    }
  )
)
