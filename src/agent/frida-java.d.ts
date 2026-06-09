/**
 * Ambient declaration for Frida's global `Java` bridge.
 *
 * Why this exists: `@types/frida-gum` v17+ split the Java/ObjC bridges out
 * of the global namespace (they're now the separate `frida-java-bridge`
 * package). But the frida-server runtime we target (17.9.x) STILL exposes
 * `Java` as a global, and we rely on it. Rather than bundle the bridge
 * package, we declare the slice of the global API the agent actually uses.
 * esbuild leaves `Java` as a free runtime global — this file is types-only.
 *
 * Members are intentionally loosely typed (`any`) because ART wrappers are
 * dynamic by nature; the index signature is what makes `wrapper.getName()`,
 * `field.value`, etc. type-check without a declaration per class.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare namespace Java {
  interface Wrapper {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [name: string]: any
    class: Wrapper
    $className: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $new(...args: any[]): Wrapper
    $dispose(): void
  }

  const available: boolean
  const androidVersion: string

  function perform(fn: () => void): void
  function performNow(fn: () => void): void
  function use(className: string): Wrapper
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function cast(handle: any, klass: Wrapper): Wrapper
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function registerClass(spec: any): Wrapper
  function enumerateLoadedClassesSync(): string[]
  function enumerateClassLoadersSync(): Wrapper[]
  function choose(
    className: string,
    callbacks: { onMatch: (instance: Wrapper) => void; onComplete: () => void }
  ): void
  function scheduleOnMainThread(fn: () => void): void
}
