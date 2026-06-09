import { create } from 'zustand'
import type { CapturedRequest, ProxyStatus } from '@shared/types'

type ProxyResourceFilter =
  | 'all'
  | 'document'
  | 'xhr'
  | 'script'
  | 'style'
  | 'image'
  | 'font'
  | 'media'
  | 'other'

type ProxySignalFilter = 'all' | 'interesting' | 'auth' | 'cookies' | 'errors'

interface ProxyFilters {
  search: string
  method: string | 'all'
  statusClass: 'all' | '2xx' | '3xx' | '4xx' | '5xx' | 'pending'
  scheme: 'all' | 'http' | 'https'
  resource: ProxyResourceFilter
  signal: ProxySignalFilter
}

interface ProxyState {
  status: ProxyStatus
  requests: CapturedRequest[]
  selectedRequestId: string | null
  filters: ProxyFilters
  setStatus: (s: ProxyStatus) => void
  appendRequest: (r: CapturedRequest) => void
  updateRequest: (r: CapturedRequest) => void
  clearRequests: () => void
  selectRequest: (id: string | null) => void
  setFilters: (next: Partial<ProxyFilters>) => void
  hydrate: () => Promise<void>
}

const defaultFilters: ProxyFilters = {
  search: '',
  method: 'all',
  statusClass: 'all',
  scheme: 'all',
  resource: 'all',
  signal: 'all'
}

export const useProxyStore = create<ProxyState>((set, get) => ({
  status: { state: 'stopped', port: 8080 },
  requests: [],
  selectedRequestId: null,
  filters: defaultFilters,
  setStatus: (s) => set({ status: s }),
  appendRequest: (r) =>
    set((state) => {
      // De-dupe in case the same request id arrives twice (response can
      // race into appendRequest if listeners fire out of order on first run).
      if (state.requests.some((existing) => existing.id === r.id)) {
        return {
          requests: state.requests.map((existing) => (existing.id === r.id ? r : existing))
        }
      }
      if (state.requests.length >= 5000) {
        return { requests: [r, ...state.requests.slice(0, 4999)] }
      }
      return { requests: [r, ...state.requests] }
    }),
  updateRequest: (r) =>
    set((state) => {
      const seen = state.requests.some((existing) => existing.id === r.id)
      if (!seen) return { requests: [r, ...state.requests] }
      return {
        requests: state.requests.map((existing) => (existing.id === r.id ? r : existing))
      }
    }),
  clearRequests: () => set({ requests: [], selectedRequestId: null }),
  selectRequest: (id) => set({ selectedRequestId: id }),
  setFilters: (next) => set((state) => ({ filters: { ...state.filters, ...next } })),
  hydrate: async () => {
    const [status, list] = await Promise.all([
      window.api.proxy.getStatus(),
      window.api.proxy.listRequests({ limit: 500 })
    ])
    const requests = list.ok ? list.value : []
    const selected = get().selectedRequestId
    set({
      status,
      requests,
      selectedRequestId: selected && requests.some((req) => req.id === selected) ? selected : null
    })
  }
}))

export type { ProxyFilters }
