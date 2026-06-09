/**
 * Theme controller. The app's colours are CSS-variable tokens; switching
 * themes just toggles the `.dark` class on <html> (Tailwind `darkMode:
 * 'class'`), which re-resolves every token instantly and cheaply.
 *
 * Modes: 'light' | 'dark' | 'system' (follows the OS preference live).
 * The preference is persisted in localStorage so boot is synchronous and
 * flash-free (see `initThemeEarly`).
 */

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'mobsec.theme'

export function readStoredMode(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* localStorage may be unavailable very early — fall through */
  }
  return 'system'
}

export function storeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    /* ignore quota/availability errors */
  }
}

export function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : true
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return mode
}

/**
 * Apply a mode to the document. When `animate`, briefly adds the
 * `theme-transition` class so the switch crossfades, then removes it — so
 * there's no ongoing transition cost during normal use.
 */
export function applyTheme(mode: ThemeMode, animate = false): ResolvedTheme {
  const resolved = resolveTheme(mode)
  const root = document.documentElement
  if (animate) {
    root.classList.add('theme-transition')
    window.setTimeout(() => root.classList.remove('theme-transition'), 260)
  }
  root.classList.toggle('dark', resolved === 'dark')
  return resolved
}

/** Synchronous boot apply — call before React renders to avoid FOUC. */
export function initThemeEarly(): void {
  applyTheme(readStoredMode(), false)
}
