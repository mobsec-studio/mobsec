import forge from 'node-forge'
import { createHash } from 'node:crypto'
import type { ApkCertificate } from '@shared/types'
import type { OpenZipResult } from './zip'

/**
 * Extract the v1 JAR-signing certificate chain from an APK.
 *
 * Every APK ships at least one `META-INF/<key>.RSA` (or `.DSA`, `.EC`)
 * file alongside the manifest — a PKCS#7 SignedData envelope whose
 * `certificates` field carries the signer's chain. node-forge parses
 * the envelope without needing OpenSSL on the host.
 *
 * APK Signature Scheme v2/v3/v4 cert blocks live in the ZIP comment /
 * dedicated section *outside* the central directory, which yauzl can't
 * see. Most APKs in the wild keep a v1 signer alongside v2+ for backward
 * compatibility, so the v1 path covers ~99% of real-world targets. The
 * (rare) v2-only APKs surface as "no certificate" and we tell the user
 * exactly why.
 */
export async function extractSigningCerts(zip: OpenZipResult): Promise<ApkCertificate[]> {
  const sigEntries = zip.entries.filter(
    (e) =>
      e.fileName.toUpperCase().startsWith('META-INF/') &&
      /\.(RSA|DSA|EC)$/i.test(e.fileName)
  )
  if (sigEntries.length === 0) return []

  const certs: ApkCertificate[] = []
  for (const entry of sigEntries) {
    const buf = await zip.readEntry(entry.fileName)
    if (!buf) continue
    try {
      const asn1 = forge.asn1.fromDer(forge.util.createBuffer(buf.toString('binary')))
      const p7 = forge.pkcs7.messageFromAsn1(asn1)
      const messageCerts = (p7 as { certificates?: forge.pki.Certificate[] }).certificates ?? []
      for (const cert of messageCerts) {
        certs.push(toApkCertificate(cert))
      }
    } catch {
      // Some apks ship malformed sig blocks; skip and continue. The UI
      // shows "no v1 signature recoverable" if no certs make it through.
    }
  }
  return certs
}

function toApkCertificate(cert: forge.pki.Certificate): ApkCertificate {
  const subject = formatName(cert.subject)
  const issuer = formatName(cert.issuer)
  const derBytes = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes()
  const der = Buffer.from(derBytes, 'binary')
  const sha256 = createHash('sha256').update(der).digest('hex').toUpperCase()
  return {
    subject,
    issuer,
    serialNumber: cert.serialNumber.toUpperCase(),
    validFrom: cert.validity.notBefore.toISOString(),
    validTo: cert.validity.notAfter.toISOString(),
    sha256
  }
}

function formatName(name: forge.pki.Certificate['subject']): string {
  // node-forge gives us an array of `{ shortName, name, value }`. We
  // emit an OpenSSL-style `CN=…,O=…` string so the renderer can show a
  // compact one-liner.
  return name.attributes
    .map((a: { shortName?: string; name?: string; value?: unknown }) => {
      const k = a.shortName ?? a.name ?? '?'
      return `${k}=${String(a.value ?? '')}`
    })
    .join(', ')
}
