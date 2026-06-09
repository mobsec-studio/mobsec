import { create } from 'zustand'
import type { CaInstallResult } from '@shared/types'

/**
 * Tracks the most recent CA-install outcome and whether the wizard is
 * open. The wizard auto-opens when the result lands in the
 * `user-action-required` state for the first time per session, then the
 * user can dismiss it manually. They can also re-open it from the Proxy
 * tab's "Re-install CA" button.
 */
interface CaInstallState {
  result: CaInstallResult | null
  wizardOpen: boolean
  /**
   * The hash/path/transport-id we last auto-opened on. We refuse to
   * auto-open again for the same install attempt; reopening requires
   * either a fresh attempt (different result) or the user explicitly
   * clicking Re-install.
   */
  lastAutoOpenedToken: string | null
  inflight: boolean

  setResult: (r: CaInstallResult | null) => void
  openWizard: () => void
  closeWizard: () => void
  hydrate: () => Promise<void>
  reinstall: () => Promise<CaInstallResult | null>
}

function tokenFor(r: CaInstallResult | null): string | null {
  if (!r) return null
  return `${r.state}|${r.path ?? ''}|${r.certPathOnDevice ?? ''}`
}

export const useCaInstallStore = create<CaInstallState>((set, get) => ({
  result: null,
  wizardOpen: false,
  lastAutoOpenedToken: null,
  inflight: false,
  setResult: (r) => {
    set((state) => {
      // Auto-open the wizard the first time we land in user-action-required
      // for a given install attempt. The token guards against re-opening
      // on every push event for the same outcome.
      const next: Partial<CaInstallState> = { result: r }
      if (r?.state === 'user-action-required') {
        const token = tokenFor(r)
        if (token !== state.lastAutoOpenedToken) {
          next.wizardOpen = true
          next.lastAutoOpenedToken = token
        }
      }
      return next
    })
  },
  openWizard: () => set({ wizardOpen: true }),
  closeWizard: () => set({ wizardOpen: false }),
  hydrate: async () => {
    const res = await window.api.proxy.getCaInstallResult()
    if (res.ok) set({ result: res.value })
  },
  reinstall: async () => {
    set({ inflight: true })
    try {
      const res = await window.api.proxy.reinstallCa()
      if (res.ok) {
        get().setResult(res.value)
        return res.value
      }
      return null
    } finally {
      set({ inflight: false })
    }
  }
}))
