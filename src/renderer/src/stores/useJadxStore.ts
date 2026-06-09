import { create } from 'zustand'
import type {
  JadxDecompileOptions,
  JadxFileEntry,
  JadxProgress,
  JadxProjectSummary,
  JadxReadFileResult,
  JadxSearchResult,
  JadxStatus
} from '@shared/types'

interface JadxState {
  status: JadxStatus | null
  project: JadxProjectSummary | null
  tree: JadxFileEntry[]
  selectedPath: string | null
  selectedContent: string
  selectedFile: JadxReadFileResult | null
  searchQuery: string
  searchResults: JadxSearchResult[]
  progress: JadxProgress | null
  inputPath: string | null
  options: Omit<JadxDecompileOptions, 'inputPath'>
  loadingStatus: boolean
  decompiling: boolean
  reading: boolean
  searching: boolean
  error: string | null
  refreshStatus: () => Promise<void>
  setProgress: (progress: JadxProgress) => void
  setInputPath: (path: string | null) => void
  patchOptions: (patch: Partial<Omit<JadxDecompileOptions, 'inputPath'>>) => void
  decompile: () => Promise<void>
  selectFile: (path: string) => Promise<void>
  search: (query: string) => Promise<void>
  revealOutput: () => Promise<void>
  deleteProject: () => Promise<void>
  reset: () => void
}

const DEFAULT_OPTIONS: Omit<JadxDecompileOptions, 'inputPath'> = {
  clean: true,
  deobfuscate: true,
  showBadCode: true,
  noResources: false,
  exportGradle: false,
  mode: 'auto',
  threads: 4
}

export const useJadxStore = create<JadxState>((set, get) => ({
  status: null,
  project: null,
  tree: [],
  selectedPath: null,
  selectedContent: '',
  selectedFile: null,
  searchQuery: '',
  searchResults: [],
  progress: null,
  inputPath: null,
  options: DEFAULT_OPTIONS,
  loadingStatus: false,
  decompiling: false,
  reading: false,
  searching: false,
  error: null,

  refreshStatus: async () => {
    set({ loadingStatus: true, error: null })
    const res = await window.api.jadx.status()
    set({
      status: res.ok ? res.value : null,
      loadingStatus: false,
      error: res.ok ? null : res.error
    })
  },

  setProgress: (progress) => set({ progress }),
  setInputPath: (path) => set({ inputPath: path, error: null }),
  patchOptions: (patch) => set((state) => ({ options: { ...state.options, ...patch } })),

  decompile: async () => {
    const { inputPath, options } = get()
    if (!inputPath) {
      set({ error: 'Choose an APK, DEX, AAB, XAPK, APKS, APKM, JAR, AAR, or ZIP first.' })
      return
    }
    set({
      decompiling: true,
      error: null,
      selectedPath: null,
      selectedContent: '',
      selectedFile: null,
      progress: {
        projectId: null,
        inputPath,
        outputDir: null,
        phase: 'preparing',
        percent: 1,
        message: 'Preparing JADX workspace'
      },
      searchResults: []
    })
    const res = await window.api.jadx.decompile({ ...options, inputPath })
    if (!res.ok) {
      set({
        decompiling: false,
        error: res.error,
        progress: {
          projectId: null,
          inputPath,
          outputDir: null,
          phase: 'error',
          percent: 100,
          message: 'JADX decompile failed',
          detail: res.error
        }
      })
      return
    }
    const tree = await window.api.jadx.listTree(res.value.id)
    set({
      project: res.value,
      tree: tree.ok ? tree.value : [],
      decompiling: false,
      progress: {
        projectId: res.value.id,
        inputPath: res.value.inputPath,
        outputDir: res.value.outputDir,
        phase: 'done',
        percent: 100,
        message: res.value.completedWithErrors
          ? 'JADX completed with recoverable errors'
          : 'JADX decompile complete'
      },
      error: tree.ok ? null : tree.error
    })
  },

  selectFile: async (path) => {
    const project = get().project
    if (!project) return
    set({ reading: true, selectedPath: path, selectedFile: null, error: null })
    const res = await window.api.jadx.readFile(project.id, path)
    set({
      selectedPath: res.ok ? res.value.path : path,
      selectedContent: res.ok ? res.value.content : '',
      selectedFile: res.ok ? res.value : null,
      reading: false,
      error: res.ok ? null : res.error
    })
  },

  search: async (query) => {
    const project = get().project
    set({ searchQuery: query })
    if (!project || query.trim().length < 2) {
      set({ searchResults: [], searching: false })
      return
    }
    set({ searching: true, error: null })
    const res = await window.api.jadx.search(project.id, query, 200)
    set({
      searchResults: res.ok ? res.value : [],
      searching: false,
      error: res.ok ? null : res.error
    })
  },

  revealOutput: async () => {
    const project = get().project
    if (!project) return
    const res = await window.api.jadx.revealOutput(project.id)
    if (!res.ok) set({ error: res.error })
  },

  deleteProject: async () => {
    const project = get().project
    if (!project) return
    const res = await window.api.jadx.deleteProject(project.id)
    if (!res.ok) {
      set({ error: res.error })
      return
    }
    set({
      project: null,
      tree: [],
      selectedPath: null,
      selectedContent: '',
      selectedFile: null,
      searchResults: [],
      searchQuery: '',
      progress: null
    })
  },

  reset: () =>
    set({
      project: null,
      tree: [],
      selectedPath: null,
      selectedContent: '',
      selectedFile: null,
      searchResults: [],
      searchQuery: '',
      inputPath: null,
      progress: null,
      error: null
    })
}))
