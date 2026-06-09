import type { MobsecApi } from '@shared/api'

declare global {
  interface Window {
    api: MobsecApi
  }
}

export {}
