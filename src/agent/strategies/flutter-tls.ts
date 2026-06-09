/**
 * Flutter TLS bypass (native).
 *
 * Flutter statically links its own BoringSSL and ignores the system proxy
 * and trust store, so the Java SSL hooks don't touch it. The durable fix
 * is to force BoringSSL's certificate-verify function to report success.
 *
 * Release Flutter strips these symbols, so we (1) try the candidate
 * exports — which works on debug builds and some versions — and (2) report
 * honestly when the symbol is stripped, rather than shipping a fabricated
 * byte pattern that silently matches nothing. (Per-version signature
 * scanning is the planned follow-up.)
 */

import type { Strategy } from '../core/registry'
import type { ReconContext } from '../core/context'
import type { StrategyRun } from '../core/strategy'
import { ModuleRT } from '../core/native'

const VERIFY_SYMBOLS = [
  'ssl_crypto_x509_session_verify_cert_chain',
  'X509_verify_cert',
  'SSL_get_verify_result'
]

export const flutterTlsStrategy: Strategy = {
  id: 'flutter-tls',
  label: 'Flutter TLS bypass (BoringSSL)',
  category: 'ssl-pinning',
  description:
    "Forces Flutter's bundled BoringSSL cert verification to succeed so the app honours the proxy/CA. Manual-only — native patching, best-effort (release builds strip the symbol).",
  autoApply: false,
  applies(ctx: ReconContext): boolean {
    return ctx.hasModule('libflutter.so')
  },
  apply(ctx: ReconContext, run: StrategyRun): void {
    const lib = ctx.findModule('libflutter.so')
    if (!lib) {
      run.note('libflutter.so not mapped — nothing to do')
      return
    }

    let hooked = 0
    for (const symbol of VERIFY_SYMBOLS) {
      run.hook(`libflutter.so!${symbol} → success`, () => {
        const addr = ModuleRT.findExportByName('libflutter.so', symbol)
        if (!addr) throw new Error('symbol stripped/not exported')
        Interceptor.attach(addr, {
          onLeave(retval) {
            // 1 == success for these verify functions.
            retval.replace(ptr(1))
          }
        })
        hooked += 1
        run.note(`Hooked libflutter.so!${symbol}`)
      })
    }

    if (hooked === 0) {
      run.note(
        'BoringSSL verify symbols are stripped in this Flutter build — a version-specific signature scan is required. Set the proxy and try a dedicated Flutter TLS script for this version.'
      )
    }
  }
}
