// Bundles the TypeScript Frida agent (src/agent/index.ts) into a single
// self-contained IIFE that the device-side Frida runtime can load verbatim.
//
// Why a separate build step (not electron-vite):
//   - The agent targets Frida's GumJS runtime, not Node or a browser, so it
//     can't share the renderer/main Vite pipelines or their lib/types.
//   - Frida loads one flat script string; esbuild's `iife` + `bundle` give us
//     exactly that with zero external requires.
//
// Output: resources/frida-agent/agent.js — picked up at runtime by
// frida.ts via getPaths().bundledResources (dev: ./resources, packaged:
// tools-cache, where electron-builder copies all of resources/).

import { build } from 'esbuild'
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const watch = process.argv.includes('--watch')

/** @type {Omit<import('esbuild').BuildOptions, 'entryPoints' | 'outfile' | 'banner'>} */
const common = {
  bundle: true,
  // Frida evaluates a single script in global scope; an IIFE keeps our
  // module internals private while still letting us assign the global
  // `rpc.exports` / call the global `send()`.
  format: 'iife',
  // Not node, not browser — Frida's embedded JS engine.
  platform: 'neutral',
  // GumJS (QuickJS / V8) comfortably runs ES2020; stay conservative so
  // the same bundle works across every frida-server build.
  target: 'es2020',
  // Resolve the repo's path aliases the same way the app does. esbuild
  // applies these as prefix matches, so `@shared/frida-intel` → the file.
  alias: {
    '@shared': resolve(root, 'src/shared'),
    '@agent': resolve(root, 'src/agent')
  },
  minify: false,
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'info'
}

const targets = [
  {
    // The full intelligence agent (self-bundles the Java bridge).
    entryPoints: [resolve(root, 'src/agent/index.ts')],
    outfile: resolve(root, 'resources/frida-agent/agent.js'),
    banner: {
      js: '/* MOBSEC_FRIDA_AGENT generated; edit src/agent/** */'
    },
    ...common
  },
  {
    // Standalone Java-bridge bootstrap (Frida 17 removed the global `Java`).
    // Prepended to raw built-in/user/CodeShare scripts that touch `Java`.
    entryPoints: [resolve(root, 'src/agent/core/bridge.ts')],
    outfile: resolve(root, 'resources/frida-agent/java-bridge.js'),
    banner: {
      js: '/* MOBSEC_JAVA_BRIDGE Frida-17 global-Java polyfill; generated */'
    },
    ...common
  }
]

async function run() {
  await mkdir(dirname(targets[0].outfile), { recursive: true })

  if (watch) {
    const esbuild = await import('esbuild')
    for (const t of targets) {
      const ctx = await esbuild.context(t)
      await ctx.watch()
    }
    // eslint-disable-next-line no-console
    console.log('[build-agent] watching src/agent for changes…')
  } else {
    for (const t of targets) {
      await build(t)
      // eslint-disable-next-line no-console
      console.log(`[build-agent] wrote ${t.outfile}`)
    }
  }
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[build-agent] failed:', err)
  process.exit(1)
})
