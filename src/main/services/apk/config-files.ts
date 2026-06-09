import type { SecurityFinding } from '@shared/types'
import type { OpenZipResult } from './zip'

/**
 * Bundled-config / secrets-file detector.
 *
 * The string-scanner already picks up obvious tokens that happen to be
 * referenced as strings in DEX. This module is the parallel sweep for
 * things that ship as *files* in `assets/` or `res/raw/`: keystores,
 * private certificates, .env files, Firebase / Amplify config bundles,
 * and ProGuard mapping leftovers. Each surfaces as a SecurityFinding so
 * it flows through the existing risk score + Security tab; the
 * orchestrator concatenates these with the manifest/code checks.
 *
 * We deliberately keep the scan ZIP-side (no decompilation needed) so it
 * runs in the same sub-second quick-scan pass as the rest of the
 * analyzer.
 */

interface ConfigPattern {
  id: string
  /** Does this filename match? Patterns get evaluated in declaration
   *  order; the first match wins so we don't double-report. */
  match: (filename: string) => boolean
  label: string
  severity: SecurityFinding['severity']
  description: string
  remediation: string
  /** Optional: pull a key string out of the file's text content so the
   *  finding can display "Detected: AIza…". Caller only invokes this
   *  for plain-text files under a reasonable size. */
  extract?: (text: string) => string | null
}

const PATTERNS: ConfigPattern[] = [
  // ---- Bundled credential containers ----------------------------------
  {
    id: 'bundled-keystore',
    match: (f) => /\.(jks|keystore|p12|pfx|bks)$/i.test(f),
    label: 'Bundled keystore',
    severity: 'high',
    description:
      'A .jks/.keystore/.p12/.pfx/.bks file is included in the APK. Anyone with the APK has the keystore — and if the passphrase is hardcoded or weak (often it is), the private keys are extractable.',
    remediation:
      'Never ship private keys inside an APK. Move signing / TLS-client keys to a server endpoint and fetch them per session, or rely on Android Keystore for runtime-generated keys.'
  },
  {
    id: 'bundled-cert',
    match: (f) => /\.(pem|crt|cer|der)$/i.test(f) && !/META-INF/i.test(f),
    label: 'Bundled certificate',
    severity: 'low',
    description:
      'A .pem/.crt/.cer/.der is bundled outside META-INF/. Usually this is a CA pinning target. Worth listing because the pin can be defeated by repackaging the APK with a different cert — and because the SAN / issuer often reveals the production backend host.',
    remediation:
      'If this is a pinned root, ensure runtime pinning is paired with a server-side rotation plan. Use Network Security Config\'s <pin-set> rather than custom code.'
  },
  // ---- Plaintext credential carriers ----------------------------------
  {
    id: 'env-file',
    match: (f) => /(^|\/)\.env(\.[a-z]+)?$/i.test(f) || /(^|\/)config\.env$/i.test(f),
    label: '.env file shipped inside the APK',
    severity: 'critical',
    description:
      '.env files are the standard place to put service tokens, database URLs, and API keys. Shipping one inside an APK exposes every value to anyone with the file.',
    remediation:
      'Move runtime configuration out of the APK. Read values from a backend at runtime, or compile them into BuildConfig and use ProGuard to obscure them only as defense-in-depth (never as the only barrier).'
  },
  {
    id: 'firebase-config',
    match: (f) => /(^|\/)google-services\.json$/i.test(f),
    label: 'Firebase / Google Services config (google-services.json)',
    severity: 'info',
    description:
      'This config is *intended* to ship with the APK — it carries the Firebase project id, API key, and OAuth client ids. The values are not secrets per se, but they identify the backend project and let any client author API calls against it. Verify Firebase Security Rules + App Check are enforced.',
    remediation:
      'Tighten Firestore / RTDB Security Rules. Enable Firebase App Check (Play Integrity / DeviceCheck) so requests from unverified apps are rejected even when they hold a valid API key.',
    extract: (text) => {
      const apiKey = text.match(/"current_key"\s*:\s*"([^"]+)"/)?.[1]
      const projectId = text.match(/"project_id"\s*:\s*"([^"]+)"/)?.[1]
      const out: string[] = []
      if (projectId) out.push(`project_id=${projectId}`)
      if (apiKey) out.push(`api_key=${apiKey}`)
      return out.length > 0 ? out.join(', ') : null
    }
  },
  {
    id: 'amplify-config',
    match: (f) =>
      /(^|\/)(amplifyconfiguration\.json|awsconfiguration\.json)$/i.test(f),
    label: 'AWS Amplify / Mobile SDK config',
    severity: 'medium',
    description:
      "Embeds the Cognito identity pool id, App-Sync / AppSync IAM role, and region. Anyone with the file can unauthenticated-auth against the identity pool unless its policy is locked down.",
    remediation:
      "Audit the Cognito identity pool's unauthenticated role — it should grant the bare minimum. Pair with AWS WAF or App Check equivalents.",
    extract: (text) => {
      const identityPool = text.match(/"PoolId"\s*:\s*"([^"]+)"/)?.[1]
      const region = text.match(/"Region"\s*:\s*"([^"]+)"/)?.[1]
      if (identityPool) return `identity_pool=${identityPool}${region ? ` region=${region}` : ''}`
      return null
    }
  },
  {
    id: 'sentry-config',
    match: (f) => /(^|\/)sentry(\.properties|\.json)$/i.test(f),
    label: 'Sentry configuration',
    severity: 'low',
    description:
      'Sentry DSN / auth-token bundle. The DSN is intentionally embeddable, but a leaked `auth.token` lets attackers create / modify projects on the Sentry org.',
    remediation:
      'If `auth.token` is present in the file, rotate it immediately and rebuild without it. DSNs are fine to ship.',
    extract: (text) => {
      const dsn = text.match(/defaults\.url\s*=\s*(\S+)|"dsn"\s*:\s*"([^"]+)"/)
      const authToken = text.match(/auth\.token\s*=\s*(\S+)/)
      if (authToken) return `auth.token=${authToken[1]!.slice(0, 20)}…`
      if (dsn) return `dsn=${(dsn[1] ?? dsn[2] ?? '').slice(0, 60)}`
      return null
    }
  },
  // ---- Reverse-engineering aides -------------------------------------
  {
    id: 'proguard-mapping',
    match: (f) =>
      /(^|\/)mapping\.txt$/i.test(f) ||
      /(^|\/)proguard-rules\.pro$/i.test(f) ||
      /(^|\/)proguard\.cfg$/i.test(f),
    label: 'ProGuard / R8 mapping artefact shipped',
    severity: 'medium',
    description:
      "`mapping.txt` is the deobfuscation map produced by R8/ProGuard — shipping it inside the APK gives every reverse engineer the symbols you spent build time hiding. The .pro/.cfg files describe the ProGuard rules themselves, which often leak which classes survive obfuscation.",
    remediation:
      'Exclude mapping.txt and ProGuard rule files from the release variant via your Gradle config (they should land in build outputs, not the APK).'
  },
  {
    id: 'backup-rules',
    match: (f) =>
      /res\/xml\/.*backup.*\.xml$/i.test(f) ||
      /res\/xml\/.*allow.*backup.*\.xml$/i.test(f),
    label: 'Backup rules resource',
    severity: 'info',
    description:
      'A custom backup-rules XML was found. Worth a manual read — overly permissive include / exclude patterns can opt sensitive files into adb backups.',
    remediation:
      'Confirm the include/exclude rules cover databases and shared prefs containing tokens.'
  },
  // ---- Properties files with credentials -----------------------------
  {
    id: 'credential-properties',
    match: (f) => /\.properties$/i.test(f),
    label: 'Properties file (inspect for credentials)',
    severity: 'low',
    description:
      'A .properties file is bundled. Often these store environment configuration the developer didn\'t consider secret. Worth a manual scan for `password=`, `api.key=`, etc.',
    remediation:
      'Move any actual secrets out of the bundled .properties file. The secret regex sweep above already flags credential-shaped lines if any are present.',
    extract: (text) => {
      const m = text.match(
        /\b(?:password|api[._-]?key|secret|token|client[._-]?secret)\s*=\s*([^\s#]+)/i
      )
      if (m && m[1]) return `${m[0].split('=')[0]}=${m[1]!.slice(0, 40)}…`
      return null
    }
  }
]

const MAX_INSPECT_BYTES = 256 * 1024

export async function scanBundledConfigFiles(
  zip: OpenZipResult
): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = []
  for (const entry of zip.entries) {
    if (entry.isDirectory) continue
    if (entry.size === 0) continue
    // META-INF/ is always certs + signatures; we already parse them
    // dedicated to signing in signing.ts. Skip to avoid noise.
    if (/^META-INF\//i.test(entry.fileName) && !/\.(properties|env)$/i.test(entry.fileName)) {
      continue
    }
    for (const pattern of PATTERNS) {
      if (!pattern.match(entry.fileName)) continue
      let extracted: string | null = null
      if (pattern.extract && entry.size <= MAX_INSPECT_BYTES) {
        const buf = await zip.readEntry(entry.fileName).catch(() => null)
        if (buf) {
          try {
            const text = buf.toString('utf8')
            extracted = pattern.extract(text)
          } catch {
            // Not utf8 — skip the extract, keep the bare finding.
          }
        }
      }
      findings.push({
        id: `cfg:${pattern.id}:${entry.fileName}`,
        title: `${pattern.label} at ${entry.fileName}`,
        severity: pattern.severity,
        detail: extracted
          ? `${pattern.description}\n\nExtracted: ${extracted}`
          : pattern.description,
        remediation: pattern.remediation
      })
      break // one pattern per file — don't double-classify
    }
  }
  return findings
}
