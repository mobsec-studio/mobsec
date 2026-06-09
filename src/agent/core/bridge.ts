/**
 * Frida 17 removed the global `Java` / `ObjC` bridges from the GumJS
 * runtime — a raw injected script now sees `Java === undefined`. We bundle
 * `frida-java-bridge` with esbuild and re-expose it as the global `Java`
 * that the rest of the agent (and the ambient frida-java.d.ts) relies on.
 *
 * This MUST be the agent's first import so the global exists before any
 * other module touches it.
 */
import Java from 'frida-java-bridge'

const target = globalThis as unknown as { Java?: unknown }
if (typeof target.Java === 'undefined') {
  target.Java = Java
}

export {}
