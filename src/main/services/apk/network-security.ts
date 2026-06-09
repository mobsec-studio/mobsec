import type {
  ApkNetworkSecurityDomain,
  ApkNetworkSecuritySummary,
  SecurityFinding
} from '@shared/types'
import { attr, findAllElements, findElement, parseAxml, type AxmlElement } from './axml'
import type { ParsedManifest } from './manifest'
import type { OpenZipResult, ZipEntryInfo } from './zip'

export async function analyzeNetworkSecurityConfig(
  zip: OpenZipResult,
  manifest: ParsedManifest
): Promise<ApkNetworkSecuritySummary> {
  const candidates = candidateConfigPaths(zip.entries, manifest.application.networkSecurityConfigRef)

  for (const source of candidates) {
    const buf = await zip.readEntry(source).catch(() => null)
    if (!buf) continue
    const parsed = parseNetworkSecurityBuffer(buf)
    if (!parsed) continue
    const summary = summarizeNetworkSecurity(parsed, source)
    if (summary.present) return summary
  }

  const missingReference = manifest.application.networkSecurityConfigRef
  const findings: SecurityFinding[] = []
  if (missingReference && missingReference.startsWith('@')) {
    findings.push({
      id: 'nsc-reference-unresolved',
      title: 'Network Security Config reference could not be resolved',
      severity: 'low',
      detail: `The manifest references ${missingReference}, but the analyzer could not map it to a res/xml file. Static review may miss custom trust or cleartext rules.`,
      remediation:
        'Open the APK with apktool/aapt if you need exact resource-id resolution, or verify the referenced XML exists under res/xml/.'
    })
  }

  return {
    present: false,
    source: null,
    baseCleartextTrafficPermitted: null,
    trustsUserCertificates: false,
    certificatePinning: false,
    debugOverrides: [],
    domains: [],
    findings
  }
}

function candidateConfigPaths(entries: ZipEntryInfo[], ref: string | null): string[] {
  const candidates: string[] = []
  if (ref) {
    const name = ref.match(/^@xml\/(.+)$/i)?.[1]
    if (name) candidates.push(`res/xml/${name}.xml`)
  }

  for (const entry of entries) {
    if (entry.isDirectory) continue
    if (!/^res\/xml\/.+\.xml$/i.test(entry.fileName)) continue
    if (/network.*security|security.*config|nsc/i.test(entry.fileName)) {
      candidates.push(entry.fileName)
    }
  }

  for (const entry of entries) {
    if (entry.isDirectory) continue
    if (/^res\/xml\/.+\.xml$/i.test(entry.fileName)) candidates.push(entry.fileName)
  }

  return [...new Set(candidates)]
}

function parseNetworkSecurityBuffer(buf: Buffer): AxmlElement | TextNetworkConfig | null {
  try {
    if (buf.length >= 2 && buf.readUInt16LE(0) === 0x0003) {
      const root = parseAxml(buf).root
      return root?.name === 'network-security-config' ? root : null
    }
  } catch {
    return null
  }

  const text = buf.toString('utf8')
  if (!/<network-security-config[\s>]/.test(text)) return null
  return parseTextNetworkSecurityConfig(text)
}

function summarizeNetworkSecurity(
  root: AxmlElement | TextNetworkConfig,
  source: string
): ApkNetworkSecuritySummary {
  if (isTextConfig(root)) {
    const findings = buildFindings({
      source,
      baseCleartextTrafficPermitted: root.baseCleartextTrafficPermitted,
      trustsUserCertificates: root.trustsUserCertificates,
      debugOverrides: root.debugOverrides,
      domains: root.domains
    })
    return {
      present: true,
      source,
      baseCleartextTrafficPermitted: root.baseCleartextTrafficPermitted,
      trustsUserCertificates: root.trustsUserCertificates,
      certificatePinning: root.domains.some((domain) => !!domain.pinSet),
      debugOverrides: root.debugOverrides,
      domains: root.domains,
      findings
    }
  }

  const baseConfig = findElement(root, 'base-config')
  const baseTrustAnchors = collectTrustAnchors(baseConfig)
  const debugOverrides = findAllElements(root, 'debug-overrides').flatMap(collectTrustAnchors)
  const domains = findAllElements(root, 'domain-config')
    .map((domainConfig) => parseDomainConfig(domainConfig, baseTrustAnchors))
    .filter(
      (domain): domain is ApkNetworkSecurityDomain => domain !== null && domain.domain.length > 0
    )

  const baseCleartextTrafficPermitted = parseMaybeBool(attr(baseConfig, 'cleartextTrafficPermitted'))
  const trustsUserCertificates =
    baseTrustAnchors.includes('user') ||
    debugOverrides.includes('user') ||
    domains.some((domain) => domain.trustAnchors.includes('user'))
  const certificatePinning = domains.some((domain) => !!domain.pinSet)
  const findings = buildFindings({
    source,
    baseCleartextTrafficPermitted,
    trustsUserCertificates,
    debugOverrides,
    domains
  })

  return {
    present: true,
    source,
    baseCleartextTrafficPermitted,
    trustsUserCertificates,
    certificatePinning,
    debugOverrides,
    domains,
    findings
  }
}

function parseDomainConfig(
  domainConfig: AxmlElement,
  inheritedTrustAnchors: string[]
): ApkNetworkSecurityDomain | null {
  const domainEl = findElement(domainConfig, 'domain')
  const domain = (domainEl?.text || '').trim()
  if (!domain) return null
  const trustAnchors = collectTrustAnchors(domainConfig)
  const pinSetEl = findElement(domainConfig, 'pin-set')
  const pinSet = pinSetEl
    ? {
        expiration: attr(pinSetEl, 'expiration') ?? null,
        pins: findAllElements(pinSetEl, 'pin')
          .map((pin) => ({
            digest: attr(pin, 'digest') ?? 'unknown',
            value: pin.text.trim()
          }))
          .filter((pin) => pin.value.length > 0)
      }
    : null

  return {
    domain,
    includeSubdomains: parseBool(attr(domainEl, 'includeSubdomains')),
    cleartextTrafficPermitted: parseMaybeBool(attr(domainConfig, 'cleartextTrafficPermitted')),
    trustAnchors: trustAnchors.length > 0 ? trustAnchors : inheritedTrustAnchors,
    pinSet: pinSet && pinSet.pins.length > 0 ? pinSet : null
  }
}

function collectTrustAnchors(root: AxmlElement | null): string[] {
  if (!root) return []
  return [
    ...new Set(
      findAllElements(root, 'certificates')
        .map((cert) => attr(cert, 'src') ?? '')
        .filter(Boolean)
        .map((src) => src.replace(/^@raw\//, 'raw/').replace(/^@/, ''))
    )
  ]
}

interface TextNetworkConfig {
  kind: 'text-network-config'
  baseCleartextTrafficPermitted: boolean | null
  trustsUserCertificates: boolean
  debugOverrides: string[]
  domains: ApkNetworkSecurityDomain[]
}

function parseTextNetworkSecurityConfig(text: string): TextNetworkConfig {
  const baseConfig = text.match(/<base-config\b([^>]*)>([\s\S]*?)<\/base-config>/i)
  const baseCleartextTrafficPermitted = parseMaybeBool(
    baseConfig ? attrFromText(baseConfig[1]!, 'cleartextTrafficPermitted') : undefined
  )
  const baseTrustAnchors = collectTextCertificates(baseConfig?.[2] ?? '')
  const debugOverridesBody =
    text.match(/<debug-overrides\b[^>]*>([\s\S]*?)<\/debug-overrides>/i)?.[1] ?? ''
  const debugOverrides = collectTextCertificates(debugOverridesBody)
  const domains: ApkNetworkSecurityDomain[] = []

  const domainConfigRegex = /<domain-config\b([^>]*)>([\s\S]*?)<\/domain-config>/gi
  let match: RegExpExecArray | null
  while ((match = domainConfigRegex.exec(text)) !== null) {
    const attrs = match[1]!
    const body = match[2]!
    const domainMatch = body.match(/<domain\b([^>]*)>([^<]+)<\/domain>/i)
    if (!domainMatch) continue
    const trustAnchors = collectTextCertificates(body)
    const pinSetMatch = body.match(/<pin-set\b([^>]*)>([\s\S]*?)<\/pin-set>/i)
    const pins: { digest: string; value: string }[] = []
    if (pinSetMatch) {
      const pinRegex = /<pin\b([^>]*)>([^<]+)<\/pin>/gi
      let pinMatch: RegExpExecArray | null
      while ((pinMatch = pinRegex.exec(pinSetMatch[2]!)) !== null) {
        pins.push({
          digest: attrFromText(pinMatch[1]!, 'digest') ?? 'unknown',
          value: pinMatch[2]!.trim()
        })
      }
    }
    domains.push({
      domain: domainMatch[2]!.trim(),
      includeSubdomains: parseBool(attrFromText(domainMatch[1]!, 'includeSubdomains')),
      cleartextTrafficPermitted: parseMaybeBool(attrFromText(attrs, 'cleartextTrafficPermitted')),
      trustAnchors: trustAnchors.length > 0 ? trustAnchors : baseTrustAnchors,
      pinSet:
        pins.length > 0
          ? {
              expiration: pinSetMatch ? attrFromText(pinSetMatch[1]!, 'expiration') ?? null : null,
              pins
            }
          : null
    })
  }

  return {
    kind: 'text-network-config',
    baseCleartextTrafficPermitted,
    trustsUserCertificates:
      baseTrustAnchors.includes('user') ||
      debugOverrides.includes('user') ||
      domains.some((domain) => domain.trustAnchors.includes('user')),
    debugOverrides,
    domains
  }
}

function buildFindings(input: {
  source: string
  baseCleartextTrafficPermitted: boolean | null
  trustsUserCertificates: boolean
  debugOverrides: string[]
  domains: ApkNetworkSecurityDomain[]
}): SecurityFinding[] {
  const findings: SecurityFinding[] = []
  if (input.baseCleartextTrafficPermitted === true) {
    findings.push({
      id: 'nsc-base-cleartext',
      title: 'Network Security Config permits cleartext by default',
      severity: 'high',
      detail: `${input.source} sets cleartextTrafficPermitted="true" in base-config. HTTP is allowed unless individual domains override it.`,
      remediation:
        'Set base-config cleartextTrafficPermitted="false" and add temporary debug-only exceptions for local test hosts.'
    })
  }

  for (const domain of input.domains) {
    if (domain.cleartextTrafficPermitted === true) {
      findings.push({
        id: `nsc-domain-cleartext:${domain.domain}`,
        title: `Cleartext allowed for ${domain.domain}`,
        severity: 'medium',
        detail: `The domain-config for ${domain.domain} permits HTTP traffic${domain.includeSubdomains ? ' including subdomains' : ''}.`,
        remediation:
          'Prefer HTTPS-only transport. If this is a development endpoint, keep it behind debug-overrides or a debug build variant.'
      })
    }
    if (domain.pinSet?.expiration && Date.parse(domain.pinSet.expiration) < Date.now()) {
      findings.push({
        id: `nsc-expired-pins:${domain.domain}`,
        title: `Expired certificate pins for ${domain.domain}`,
        severity: 'high',
        detail: `The pin-set expiration is ${domain.pinSet.expiration}. Android ignores expired pins, so pinning may no longer protect this host.`,
        remediation:
          'Rotate the pin-set and ship a build before expiration. Keep at least one backup pin for key rotation.'
      })
    }
  }

  if (input.trustsUserCertificates && !input.debugOverrides.includes('user')) {
    findings.push({
      id: 'nsc-user-ca-trusted',
      title: 'User-installed CAs trusted in release trust anchors',
      severity: 'medium',
      detail:
        'The Network Security Config trusts the user certificate store outside debug-overrides. This makes device-installed CA MitM easier in production.',
      remediation:
        'Move user CA trust into <debug-overrides> or remove it entirely for release builds.'
    })
  }

  return findings
}

function collectTextCertificates(text: string): string[] {
  const out: string[] = []
  const regex = /<certificates\b([^>]*)\/?>/gi
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    const src = attrFromText(match[1]!, 'src')
    if (src) out.push(src.replace(/^@raw\//, 'raw/').replace(/^@/, ''))
  }
  return [...new Set(out)]
}

function attrFromText(attrs: string, name: string): string | undefined {
  return attrs.match(new RegExp(`(?:android:)?${name}\\s*=\\s*"([^"]+)"`, 'i'))?.[1]
}

function isTextConfig(root: AxmlElement | TextNetworkConfig): root is TextNetworkConfig {
  return (root as TextNetworkConfig).kind === 'text-network-config'
}

function parseBool(v: string | undefined): boolean {
  return v === 'true' || v === '1'
}

function parseMaybeBool(v: string | undefined): boolean | null {
  if (v === undefined) return null
  return parseBool(v)
}
