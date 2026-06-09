/**
 * Crypto monitor. Surfaces the JCA boundary so keys, IVs, plaintext and
 * ciphertext are visible as the app uses them — the fastest way to defeat
 * "but it's encrypted" and to recover hardcoded/derived keys. Emits
 * structured events to the Live Events feed.
 */

import type { Tracer } from '../core/registry'
import type { ReconContext } from '../core/context'
import { channel } from '../core/log'
import { HookSet } from '../core/hookset'
import { bytesPreview } from '../core/bytes'
import { safe, safeOr } from '../core/safe'
import { traceMethod } from './common'

const hooks = new HookSet()
const log = channel('crypto')

function algoOf(self: Java.Wrapper): string {
  return safeOr<string>('?', () => String(self.getAlgorithm()))
}

function encodedOf(value: unknown): string | null {
  const key = value as { getEncoded?: () => unknown } | null
  const fn = key?.getEncoded
  if (typeof fn !== 'function') return null
  return safeOr<string | null>(null, () => bytesPreview(fn.call(key)))
}

export const cryptoTracer: Tracer = {
  id: 'crypto',
  label: 'Crypto monitor',
  description: 'Cipher / MessageDigest / Mac / Signature with algorithm, key material, IV and in/out previews.',
  channel: 'crypto',
  start(_ctx: ReconContext): void {
    safe('crypto:Cipher', () => {
      const Cipher = Java.use('javax.crypto.Cipher')
      traceMethod(hooks, Cipher.doFinal, (self, args, result) => {
        const algorithm = algoOf(self)
        log.event('cipher', `Cipher.doFinal · ${algorithm}`, undefined, {
          algorithm,
          in: args.length > 0 ? bytesPreview(args[0]) : '(buffered)',
          out: bytesPreview(result)
        })
      })
      traceMethod(hooks, Cipher.init, (self, args) => {
        const algorithm = algoOf(self)
        const key = args.length > 1 ? encodedOf(args[1]) : null
        const meta: Record<string, string> = { algorithm, mode: String(args[0]) }
        if (key) meta.key = key
        log.event('cipher.init', `Cipher.init · ${algorithm}`, undefined, meta, key ? 'warn' : 'info')
      })
    })

    safe('crypto:MessageDigest', () => {
      const MD = Java.use('java.security.MessageDigest')
      traceMethod(hooks, MD.digest, (self, args, result) => {
        const algorithm = algoOf(self)
        const meta: Record<string, string> = { algorithm, out: bytesPreview(result) }
        if (args.length > 0) meta.in = bytesPreview(args[0])
        log.event('digest', `MessageDigest.digest · ${algorithm}`, undefined, meta)
      })
    })

    safe('crypto:Mac', () => {
      const Mac = Java.use('javax.crypto.Mac')
      traceMethod(hooks, Mac.doFinal, (self, _args, result) => {
        const algorithm = algoOf(self)
        log.event('mac', `Mac.doFinal · ${algorithm}`, undefined, { algorithm, out: bytesPreview(result) })
      })
    })

    safe('crypto:Signature', () => {
      const Sig = Java.use('java.security.Signature')
      traceMethod(hooks, Sig.sign, (self) => {
        const algorithm = algoOf(self)
        log.event('signature', `Signature.sign · ${algorithm}`, undefined, { algorithm })
      })
      traceMethod(hooks, Sig.verify, (self, _args, result) => {
        const algorithm = algoOf(self)
        log.event('signature', `Signature.verify · ${algorithm} → ${String(result)}`, undefined, {
          algorithm,
          result: String(result)
        })
      })
    })

    safe('crypto:SecretKeySpec', () => {
      const SKS = Java.use('javax.crypto.spec.SecretKeySpec')
      traceMethod(hooks, SKS.$init, (_self, args) => {
        const algorithm = args.length > 1 ? String(args[args.length - 1]) : ''
        log.event(
          'key',
          `SecretKeySpec${algorithm ? ` · ${algorithm}` : ''}`,
          undefined,
          { key: bytesPreview(args[0]), algorithm },
          'warn'
        )
      })
    })

    safe('crypto:IvParameterSpec', () => {
      const IV = Java.use('javax.crypto.spec.IvParameterSpec')
      traceMethod(hooks, IV.$init, (_self, args) =>
        log.event('iv', 'IvParameterSpec', undefined, { iv: bytesPreview(args[0]) })
      )
    })

    log.info(`crypto monitor active (${hooks.count} hook(s))`)
  },
  stop(): void {
    hooks.revert()
    log.info('crypto monitor stopped')
  }
}
