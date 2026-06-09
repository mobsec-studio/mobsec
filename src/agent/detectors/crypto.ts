/**
 * Crypto-inventory detector.
 *
 * A recon snapshot can't know which algorithms the app *invokes* (that's
 * the live crypto monitor's job in a later phase), so here we report the
 * crypto *surface*: the registered JCA providers (which reveal
 * AndroidKeyStore, Conscrypt, BouncyCastle versions) plus app-bundled
 * crypto libraries (Tink, SQLCipher, Signal). `algorithms` stays empty
 * until the monitor observes real usage.
 */

import type { Detector } from '../core/registry'
import type { ReconContext } from '../core/context'
import type { ReportBuilder } from '../core/report'
import { safe, safeOr } from '../core/safe'

interface LibSig {
  id: string
  label: string
  marker: string
  category: 'cipher' | 'keystore' | 'provider'
}

const LIB_SIGNATURES: LibSig[] = [
  { id: 'tink', label: 'Google Tink', marker: 'com.google.crypto.tink.Aead', category: 'cipher' },
  { id: 'bouncycastle', label: 'BouncyCastle (bundled)', marker: 'org.bouncycastle.jce.provider.BouncyCastleProvider', category: 'provider' },
  { id: 'spongycastle', label: 'SpongyCastle', marker: 'org.spongycastle.jce.provider.BouncyCastleProvider', category: 'provider' },
  { id: 'conscrypt-app', label: 'Conscrypt (bundled)', marker: 'org.conscrypt.Conscrypt', category: 'provider' },
  { id: 'sqlcipher', label: 'SQLCipher', marker: 'net.sqlcipher.database.SQLiteDatabase', category: 'cipher' },
  { id: 'libsignal', label: 'Signal Protocol', marker: 'org.signal.libsignal.protocol.SignalProtocolAddress', category: 'cipher' },
  { id: 'jose4j', label: 'jose4j (JWT/JWE)', marker: 'org.jose4j.jwe.JsonWebEncryption', category: 'cipher' },
  { id: 'nimbus-jose', label: 'Nimbus JOSE+JWT', marker: 'com.nimbusds.jose.JWEObject', category: 'cipher' }
]

export const cryptoDetector: Detector = {
  id: 'crypto',
  detect(ctx: ReconContext, out: ReportBuilder): void {
    // 1. Registered JCA providers.
    safe('crypto.providers', () => {
      const Security = ctx.useClass('java.security.Security')
      if (!Security) return
      const providers = Security.getProviders() as Java.Wrapper[]
      for (let i = 0; i < providers.length; i++) {
        const p = providers[i]
        if (!p) continue
        const name = String(p.getName())
        const version = safeOr<string | null>(null, () => String(p.getVersion()))
        out.addCrypto({
          id: `provider:${name.toLowerCase()}`,
          label: `${name} provider`,
          category: 'provider',
          algorithms: [],
          weak: false,
          evidence: [version ? `JCA provider ${name} v${version}` : `JCA provider ${name}`]
        })
      }
    })

    // 2. AndroidKeyStore — hardware-backed key custody.
    if (ctx.hasClass('android.security.keystore.KeyGenParameterSpec')) {
      out.addCrypto({
        id: 'android-keystore',
        label: 'Android Keystore',
        category: 'keystore',
        algorithms: [],
        weak: false,
        evidence: ['android.security.keystore.* present']
      })
    }

    // 3. App-bundled crypto libraries.
    for (const sig of LIB_SIGNATURES) {
      if (!ctx.hasClass(sig.marker)) continue
      out.addCrypto({
        id: sig.id,
        label: sig.label,
        category: sig.category,
        algorithms: [],
        weak: false,
        evidence: [sig.marker]
      })
    }
  }
}
