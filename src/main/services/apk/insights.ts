import type {
  ApkAnalysisSummary,
  ApkAttackSurfaceItem,
  ApkHardeningSummary,
  ApkNativeLib,
  ApkNetworkSecuritySummary,
  ApkPrivacySignal,
  ApkTechnologyFinding,
  SecretFinding,
  SecretSeverity,
  SecurityFinding
} from '@shared/types'
import type { ParsedManifest } from './manifest'

export function buildPrivacySignals(input: {
  manifest: ParsedManifest
  trackers: ApkAnalysisSummary['trackers']
  endpoints: ApkAnalysisSummary['endpoints']
}): ApkPrivacySignal[] {
  const permissions = new Set(input.manifest.permissions)
  const signals: ApkPrivacySignal[] = []

  addPermissionSignal(signals, permissions, {
    id: 'privacy-location',
    label: 'Location collection capability',
    severity: permissions.has('android.permission.ACCESS_BACKGROUND_LOCATION') ? 'high' : 'medium',
    perms: [
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_BACKGROUND_LOCATION'
    ],
    detail: 'The app can request precise or coarse location. Background location materially increases privacy risk.'
  })
  addPermissionSignal(signals, permissions, {
    id: 'privacy-contacts-sms',
    label: 'Contacts/SMS/call-log access',
    severity: 'high',
    perms: [
      'android.permission.READ_CONTACTS',
      'android.permission.WRITE_CONTACTS',
      'android.permission.READ_SMS',
      'android.permission.SEND_SMS',
      'android.permission.READ_CALL_LOG',
      'android.permission.WRITE_CALL_LOG'
    ],
    detail: 'The app can access high-sensitivity personal communications or address-book data.'
  })
  addPermissionSignal(signals, permissions, {
    id: 'privacy-camera-mic',
    label: 'Camera or microphone access',
    severity: 'medium',
    perms: ['android.permission.CAMERA', 'android.permission.RECORD_AUDIO'],
    detail: 'The app can request sensor access. Verify runtime prompts are contextual and expected.'
  })
  addPermissionSignal(signals, permissions, {
    id: 'privacy-package-inventory',
    label: 'Installed-app inventory access',
    severity: 'medium',
    perms: ['android.permission.QUERY_ALL_PACKAGES', 'android.permission.PACKAGE_USAGE_STATS'],
    detail: 'The app can enumerate installed apps or usage data, which is sensitive under Play policy.'
  })

  const sessionReplay = input.trackers.filter((tracker) => tracker.category === 'session-replay')
  if (sessionReplay.length > 0) {
    signals.push({
      id: 'privacy-session-replay',
      label: 'Session replay SDK detected',
      severity: 'high',
      detail:
        'Session replay libraries can capture screen state and user interaction. Verify masking, consent, and sensitive-screen exclusions.',
      evidence: sessionReplay.map((tracker) => tracker.name)
    })
  }

  const adTech = input.trackers.filter((tracker) =>
    ['ads', 'analytics', 'attribution'].includes(tracker.category)
  )
  if (adTech.length >= 3) {
    signals.push({
      id: 'privacy-adtech-density',
      label: 'Dense ad/analytics footprint',
      severity: 'medium',
      detail:
        'Multiple analytics, attribution, or ad SDKs increase data-sharing and consent complexity.',
      evidence: adTech.slice(0, 8).map((tracker) => tracker.name)
    })
  }

  const cleartextHosts = [...new Set(input.endpoints.filter((e) => e.insecure).map((e) => e.host))]
  if (cleartextHosts.length > 0) {
    signals.push({
      id: 'privacy-cleartext-hosts',
      label: 'Cleartext endpoint exposure',
      severity: 'medium',
      detail: 'HTTP endpoints can expose identifiers or session metadata to local networks.',
      evidence: cleartextHosts.slice(0, 8)
    })
  }

  return signals.sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
}

export function buildHardeningSummary(input: {
  manifest: ParsedManifest
  technologies: ApkTechnologyFinding[]
  attackSurface: ApkAttackSurfaceItem[]
  networkSecurity: ApkNetworkSecuritySummary
  obfuscationRatio: number
  nativeLibraries: ApkNativeLib[]
  secrets: SecretFinding[]
  securityFindings: SecurityFinding[]
}): ApkHardeningSummary {
  const debugSafe = !input.manifest.application.debuggable && !input.manifest.application.testOnly
  const backupSafe = !input.manifest.application.allowBackup
  const cleartextSafe =
    input.manifest.application.usesCleartextTraffic !== true &&
    input.networkSecurity.baseCleartextTrafficPermitted !== true &&
    !input.networkSecurity.domains.some((domain) => domain.cleartextTrafficPermitted === true)
  const certificatePinning =
    input.networkSecurity.certificatePinning ||
    hasTechnology(input.technologies, ['okhttp-pinning', 'trustkit'])
  const rootDetection = hasTechnology(input.technologies, ['rootbeer'])
  const playIntegrity = hasTechnology(input.technologies, ['play-integrity'])
  const antiTamper =
    rootDetection ||
    playIntegrity ||
    input.nativeLibraries.some((group) =>
      group.files.some((file) =>
        (file.riskTags ?? []).some((tag) =>
          ['anti-debug', 'instrumentation detection', 'packer/protector'].includes(tag)
        )
      )
    )
  const obfuscated = input.obfuscationRatio >= 0.25 || hasTechnology(input.technologies, ['dexguard'])
  const nativeCode = input.nativeLibraries.some((group) => group.files.length > 0)
  const exposedCriticalSurface = input.attackSurface.some(
    (item) =>
      item.exported &&
      !item.permission &&
      (item.severity === 'critical' || item.severity === 'high' || item.severity === 'medium')
  )
  const highSecrets = input.secrets.some(
    (secret) => secret.severity === 'critical' || secret.severity === 'high'
  )
  const highFindings = input.securityFindings.some(
    (finding) => finding.severity === 'critical' || finding.severity === 'high'
  )

  let score = 0
  if (debugSafe) score += 15
  if (backupSafe) score += 10
  if (cleartextSafe) score += 15
  if (certificatePinning) score += 12
  if (obfuscated) score += 10
  if (rootDetection) score += 8
  if (playIntegrity) score += 10
  if (antiTamper) score += 8
  if (!exposedCriticalSurface) score += 7
  if (!highSecrets && !highFindings) score += 5

  const notes: string[] = []
  if (!debugSafe) notes.push('Release hardening is weak: debuggable or testOnly is enabled.')
  if (!backupSafe) notes.push('App data backup is allowed.')
  if (!cleartextSafe) notes.push('Cleartext transport is still reachable.')
  if (!certificatePinning) notes.push('No certificate pinning signal was detected.')
  if (!rootDetection) notes.push('No root-detection signal was detected.')
  if (!playIntegrity) notes.push('No Play Integrity/SafetyNet signal was detected.')
  if (exposedCriticalSurface) notes.push('Exported attack surface should be fuzzed manually.')
  if (highSecrets) notes.push('High-impact secrets were found in static strings or resources.')

  return {
    score: Math.min(100, score),
    obfuscated,
    rootDetection,
    playIntegrity,
    certificatePinning,
    antiTamper,
    debugSafe,
    backupSafe,
    cleartextSafe,
    nativeCode,
    notes
  }
}

export function buildRiskBreakdown(input: {
  secrets: SecretFinding[]
  securityFindings: SecurityFinding[]
  endpoints: ApkAnalysisSummary['endpoints']
  attackSurface: ApkAttackSurfaceItem[]
  privacySignals: ApkPrivacySignal[]
}): ApkAnalysisSummary['riskBreakdown'] {
  const cleartextCount = input.endpoints.filter((endpoint) => endpoint.insecure).length
  const items: ApkAnalysisSummary['riskBreakdown'] = [
    scoreGroup('Security findings', input.securityFindings),
    scoreGroup('Secrets', input.secrets),
    scoreGroup('Attack surface', input.attackSurface),
    scoreGroup('Privacy signals', input.privacySignals),
    {
      label: 'Cleartext endpoints',
      score: cleartextCount * 1.5,
      count: cleartextCount,
      severity: cleartextCount > 0 ? 'medium' : 'info'
    }
  ]
  return items.filter((item) => item.count > 0 || item.score > 0)
}

function scoreGroup(
  label: string,
  findings: { severity: SecretSeverity }[]
): ApkAnalysisSummary['riskBreakdown'][number] {
  let top: SecretSeverity = 'info'
  let score = 0
  for (const finding of findings) {
    score += severityWeight(finding.severity)
    if (severityRank(finding.severity) < severityRank(top)) top = finding.severity
  }
  return { label, score, count: findings.length, severity: top }
}

function severityWeight(severity: SecretSeverity): number {
  return { critical: 25, high: 12, medium: 5, low: 2, info: 0.5 }[severity]
}

function severityRank(severity: SecretSeverity): number {
  return { critical: 0, high: 1, medium: 2, low: 3, info: 4 }[severity] ?? 5
}

function hasTechnology(technologies: ApkTechnologyFinding[], ids: string[]): boolean {
  return technologies.some((technology) => ids.includes(technology.id))
}

function addPermissionSignal(
  signals: ApkPrivacySignal[],
  permissions: Set<string>,
  input: {
    id: string
    label: string
    severity: SecretSeverity
    perms: string[]
    detail: string
  }
): void {
  const evidence = input.perms.filter((perm) => permissions.has(perm))
  if (evidence.length === 0) return
  signals.push({
    id: input.id,
    label: input.label,
    severity: input.severity,
    detail: input.detail,
    evidence
  })
}
