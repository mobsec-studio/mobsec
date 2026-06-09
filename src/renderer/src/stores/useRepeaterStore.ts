import { create } from 'zustand'
import type { RepeaterTab } from '@shared/types'

// Hard caps on what we'll feed into Monaco. The editor is generally robust
// to large inputs but a giant binary response (think a megabyte of UTF-16
// noise from interpreting JPEG bytes as text) can OOM the renderer and
// blank the entire window. We sanitize on hydrate so a previously-saved
// "poisoned" tab can't reproduce the crash on the next launch.
const MAX_DISPLAY_BODY = 256 * 1024 // 256 KiB
const MAX_DISPLAY_HEADERS = 64 * 1024 // 64 KiB

function clip(text: string | null | undefined, max: number, kind: string): string {
  if (!text) return ''
  if (text.length <= max) return text
  const head = text.slice(0, max)
  return `${head}\n…(${kind} truncated from ${text.length} chars)`
}

function sanitizeTab(tab: RepeaterTab): RepeaterTab {
  return {
    ...tab,
    headers: clip(tab.headers, MAX_DISPLAY_HEADERS, 'headers'),
    body: clip(tab.body, MAX_DISPLAY_BODY, 'body'),
    lastResponse: tab.lastResponse
      ? {
          ...tab.lastResponse,
          headers: clip(tab.lastResponse.headers, MAX_DISPLAY_HEADERS, 'response headers'),
          body: clip(tab.lastResponse.body, MAX_DISPLAY_BODY, 'response body')
        }
      : null
  }
}

interface RepeaterState {
  tabs: RepeaterTab[]
  activeTabId: string | null
  loading: boolean
  /** True while a Send is in-flight for the given tab. */
  sending: Set<string>
  hydrate: () => Promise<void>
  createTab: (fromRequestId?: string) => Promise<RepeaterTab>
  /**
   * Create a fresh tab seeded with a URL (and optional method/body).
   * Used by every "send to repeater" entry point — APK Analyzer
   * endpoints, future request-tree imports, etc. Persists the seeded
   * fields and selects the new tab.
   */
  importFromUrl: (opts: {
    url: string
    method?: string
    headers?: string
    body?: string
  }) => Promise<RepeaterTab>
  updateTab: (tab: RepeaterTab) => Promise<void>
  saveTab: (tab: RepeaterTab) => Promise<void>
  deleteTab: (id: string) => Promise<void>
  /** Nuke every tab — recovery hatch if a saved tab is somehow crashing. */
  deleteAllTabs: () => Promise<void>
  sendTab: (tab: RepeaterTab) => Promise<RepeaterTab | null>
  selectTab: (id: string | null) => void
  /** Update a tab in memory without round-tripping through the DB. */
  patchTab: (id: string, patch: Partial<RepeaterTab>) => void
}

export const useRepeaterStore = create<RepeaterState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  loading: false,
  sending: new Set(),
  hydrate: async () => {
    set({ loading: true })
    const res = await window.api.repeater.listTabs()
    const raw = res.ok ? res.value : []
    const tabs = raw.map(sanitizeTab)
    set({
      tabs,
      loading: false,
      activeTabId: tabs[0]?.id ?? null
    })
  },
  createTab: async (fromRequestId) => {
    const res = await window.api.repeater.createTab(fromRequestId)
    if (!res.ok) throw new Error(res.error)
    set((s) => ({ tabs: [res.value, ...s.tabs], activeTabId: res.value.id }))
    return res.value
  },
  importFromUrl: async ({ url, method, headers, body }) => {
    // Seed a blank tab from the existing createTab IPC, then patch the
    // fields in one updateTab round-trip so the new tab is persisted
    // with the imported values. We deliberately don't reuse
    // `fromRequestId` (which keys off captured proxy traffic) — this
    // path needs to work from any "I have a URL" context.
    const blank = await window.api.repeater.createTab()
    if (!blank.ok) throw new Error(blank.error)
    const host = safeHost(url)
    const seeded: RepeaterTab = {
      ...blank.value,
      name: host || trimUrl(url),
      method: (method ?? 'GET').toUpperCase(),
      url,
      headers: headers ?? defaultHeadersForUrl(url),
      body: body ?? ''
    }
    const saved = await window.api.repeater.updateTab(seeded)
    if (!saved.ok) throw new Error(saved.error)
    set((s) => ({ tabs: [saved.value, ...s.tabs], activeTabId: saved.value.id }))
    return saved.value
  },
  updateTab: async (tab) => {
    const res = await window.api.repeater.updateTab(tab)
    if (!res.ok) throw new Error(res.error)
    set((s) => ({ tabs: s.tabs.map((t) => (t.id === res.value.id ? res.value : t)) }))
  },
  /** Persist the current edits without bumping `updatedAt` on the server
   *  more than necessary — used by the autosave debounce hook. */
  saveTab: async (tab) => {
    await get().updateTab(tab)
  },
  deleteTab: async (id) => {
    const res = await window.api.repeater.deleteTab(id)
    if (!res.ok) throw new Error(res.error)
    set((s) => {
      const remaining = s.tabs.filter((t) => t.id !== id)
      const nextActive =
        s.activeTabId === id ? (remaining[0]?.id ?? null) : s.activeTabId
      return { tabs: remaining, activeTabId: nextActive }
    })
  },
  deleteAllTabs: async () => {
    const ids = get().tabs.map((t) => t.id)
    for (const id of ids) {
      await window.api.repeater.deleteTab(id).catch(() => undefined)
    }
    set({ tabs: [], activeTabId: null })
  },
  sendTab: async (tab) => {
    set((s) => {
      const next = new Set(s.sending)
      next.add(tab.id)
      return { sending: next }
    })
    try {
      const res = await window.api.repeater.send(tab)
      if (!res.ok) throw new Error(res.error)
      const sanitized = sanitizeTab(res.value)
      set((s) => ({ tabs: s.tabs.map((t) => (t.id === sanitized.id ? sanitized : t)) }))
      return sanitized
    } finally {
      set((s) => {
        const next = new Set(s.sending)
        next.delete(tab.id)
        return { sending: next }
      })
    }
  },
  selectTab: (id) => set({ activeTabId: id }),
  patchTab: (id, patch) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t))
    }))
}))

function safeHost(url: string): string | null {
  try {
    return new URL(url).host
  } catch {
    return null
  }
}

function trimUrl(url: string): string {
  return url.length > 60 ? url.slice(0, 57) + '…' : url
}

/**
 * Boilerplate headers for an imported URL. We set Host (required for
 * many servers anyway), a friendly User-Agent, and a wildcard Accept.
 * The user can edit them in the Headers pane.
 */
function defaultHeadersForUrl(url: string): string {
  const host = safeHost(url) ?? ''
  return [
    host ? `Host: ${host}` : '',
    'User-Agent: MobSec/0.1 (Repeater)',
    'Accept: */*'
  ]
    .filter(Boolean)
    .join('\n')
}
