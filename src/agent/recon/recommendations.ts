/**
 * Auto-Pwn preview. Turns an assembled report into the ordered list of
 * strategies the engine would apply. Strategy ids map to existing built-in
 * scripts where one exists, so the recommendations are actionable today
 * and forward-compatible with the Phase-3 strategy engine.
 */

import type { AppIntelligenceReport, ReconRecommendation } from '@shared/frida-intel'

export function computeRecommendations(report: AppIntelligenceReport): ReconRecommendation[] {
  const recs: ReconRecommendation[] = []
  const add = (r: ReconRecommendation): void => {
    const existing = recs.find((x) => x.strategyId === r.strategyId)
    if (!existing) {
      recs.push(r)
      return
    }
    // Keep the strongest priority + richest reason for a repeated strategy.
    const rank = { high: 3, medium: 2, low: 1 }
    if (rank[r.priority] > rank[existing.priority]) existing.priority = r.priority
  }

  const hasSecurity = (kind: string): boolean => report.security.some((s) => s.kind === kind)
  const strongPinning = report.security.some(
    (s) => s.kind === 'ssl-pinning' && s.confidence >= 0.8
  )
  const fw = report.framework.kind

  // --- SSL/TLS pinning -------------------------------------------------
  if (strongPinning) {
    add({
      strategyId: 'ssl-pinning-bypass',
      label: 'Bypass SSL pinning',
      reason: 'A dedicated pinning library was detected — proxying will fail until it is neutralised.',
      priority: 'high'
    })
  } else if (
    report.networking.some((n) => n.id === 'okhttp3' || n.id === 'okhttp2') ||
    report.security.some((s) => s.kind === 'ssl-pinning')
  ) {
    add({
      strategyId: 'ssl-pinning-bypass',
      label: 'Bypass SSL pinning (precaution)',
      reason: 'OkHttp / a pinning surface is present; load the bypass before proxying to avoid handshake failures.',
      priority: 'medium'
    })
  }

  if (fw === 'flutter') {
    add({
      strategyId: 'ssl-pinning-bypass',
      label: 'Bypass TLS verification (Flutter)',
      reason: 'Flutter ships its own BoringSSL and ignores the system proxy/trust store — needs the native TLS hook, not just the Java bypass.',
      priority: 'high'
    })
  }

  // --- Root / packer / anti-Frida --------------------------------------
  if (hasSecurity('root-detection')) {
    add({
      strategyId: 'root-detection-bypass',
      label: 'Bypass root detection',
      reason: 'Root-detection logic was detected; bypass it so the app runs on the (rooted) test device.',
      priority: 'high'
    })
  }
  if (hasSecurity('frida-detection') || hasSecurity('tamper-detection')) {
    add({
      strategyId: 'anti-anti-frida',
      label: 'Defeat anti-Frida / tamper checks',
      reason: 'A protector or anti-hook control is present; apply anti-anti-Frida to keep the session alive.',
      priority: 'high'
    })
    add({
      strategyId: 'root-detection-bypass',
      label: 'Bypass root detection',
      reason: 'Commercial protectors bundle root checks alongside anti-tamper.',
      priority: 'medium'
    })
  }

  // --- Integrity / attestation -----------------------------------------
  if (hasSecurity('integrity')) {
    add({
      strategyId: 'root-detection-bypass',
      label: 'Reduce attestation signals',
      reason: 'Play Integrity / SafetyNet attestation present — hide root/emulator signals; full attestation bypass needs a hardened device.',
      priority: 'medium'
    })
  }

  // --- Biometric -------------------------------------------------------
  if (hasSecurity('biometric')) {
    add({
      strategyId: 'biometric-bypass',
      label: 'Bypass biometric gate',
      reason: 'BiometricPrompt is used; hook the auth callback to force success during testing.',
      priority: 'medium'
    })
  }

  // --- WebView (hybrid frameworks) -------------------------------------
  if (fw === 'cordova' || fw === 'capacitor' || fw === 'ionic') {
    add({
      strategyId: 'webview-inspect',
      label: 'Inspect WebView traffic',
      reason: 'Hybrid app — most logic runs in a WebView; log navigations and enable remote debugging.',
      priority: 'medium'
    })
  }

  // --- Observation baselines ------------------------------------------
  add({
    strategyId: 'shared-prefs-logger',
    label: 'Watch SharedPreferences',
    reason: 'Surface tokens, flags and credentials as the app reads/writes them.',
    priority: report.storage.some((s) => s.encrypted) ? 'medium' : 'low'
  })
  if (report.crypto.length > 0) {
    add({
      strategyId: 'crypto-logger',
      label: 'Monitor crypto operations',
      reason: 'Crypto surface present — capture keys, IVs and plaintext at the JCA boundary.',
      priority: 'low'
    })
  }
  if (report.networking.length > 0) {
    add({
      strategyId: 'http-logger',
      label: 'Log HTTP at the client',
      reason: 'Capture requests/responses at the app layer, independent of the proxy.',
      priority: 'low'
    })
  }

  const rank = { high: 3, medium: 2, low: 1 }
  return recs.sort((a, b) => rank[b.priority] - rank[a.priority])
}
