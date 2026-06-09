/**
 * Shared reconnaissance context. Built once (inside `Java.perform`) and
 * handed to every detector so expensive enumerations — loaded native
 * modules, loaded classes — happen a single time and class lookups are
 * cached. Detectors must treat this as read-only.
 */

import { channel, type ChannelLogger } from './log'
import { getSystemProperty, tryUse } from './java'
import { safeOr } from './safe'

export interface ModuleSummary {
  name: string
  path: string
  size: number
}

export interface ReconContext {
  /** Every native module mapped into the target process. */
  modules: ModuleSummary[]
  /** Case-insensitive substring test over module names. */
  hasModule(substr: string): boolean
  /** First module whose name contains `substr` (case-insensitive). */
  findModule(substr: string): ModuleSummary | null
  /** True if a Java class is loadable. Cached. */
  hasClass(name: string): boolean
  /** Cached `Java.use`; null when the class is absent. */
  useClass(name: string): Java.Wrapper | null
  /** Read an Android system property, or null. */
  systemProperty(key: string): string | null
  /** All loaded class names (cached). May be large; capped by callers. */
  loadedClasses(): string[]
  log: ChannelLogger
}

export function buildContext(): ReconContext {
  const log = channel('recon')

  const modules: ModuleSummary[] = safeOr<ModuleSummary[]>([], () =>
    Process.enumerateModules().map((m) => ({ name: m.name, path: m.path, size: m.size }))
  )

  const classCache = new Map<string, Java.Wrapper | null>()
  let loaded: string[] | null = null

  const useClass = (name: string): Java.Wrapper | null => {
    const cached = classCache.get(name)
    if (cached !== undefined) return cached
    const wrapper = tryUse(name)
    classCache.set(name, wrapper)
    return wrapper
  }

  const hasModule = (substr: string): boolean => {
    const needle = substr.toLowerCase()
    return modules.some((m) => m.name.toLowerCase().indexOf(needle) !== -1)
  }

  const findModule = (substr: string): ModuleSummary | null => {
    const needle = substr.toLowerCase()
    return modules.find((m) => m.name.toLowerCase().indexOf(needle) !== -1) ?? null
  }

  const loadedClasses = (): string[] => {
    if (loaded) return loaded
    loaded = safeOr<string[]>([], () => Java.enumerateLoadedClassesSync())
    return loaded
  }

  return {
    modules,
    hasModule,
    findModule,
    useClass,
    hasClass: (name) => useClass(name) !== null,
    systemProperty: getSystemProperty,
    loadedClasses,
    log
  }
}
