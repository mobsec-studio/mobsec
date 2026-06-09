/**
 * Typed access to Frida runtime APIs that @types/frida-gum v19 dropped or
 * reshaped but the frida-17 runtime still exposes (notably the *static*
 * Module export/base lookups). We narrow through `unknown` to a precise
 * shape — no `any` — so callers stay type-checked.
 */

interface ModuleStatics {
  findExportByName(moduleName: string | null, exportName: string): NativePointer | null
  findBaseAddress(name: string): NativePointer | null
}

/** The frida-17 static Module API (`Module.findExportByName(null, 'open')`). */
export const ModuleRT = Module as unknown as ModuleStatics

/**
 * Keep NativeCallbacks (and anything else) alive for the process lifetime
 * so they aren't garbage-collected out from under a live hook. Typed as
 * `unknown` to dodge NativeCallback's strict generic variance.
 */
const pinned: unknown[] = []

export function pin(value: unknown): void {
  pinned.push(value)
}
