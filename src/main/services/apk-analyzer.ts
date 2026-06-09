import { createHash } from 'node:crypto'
import { createReadStream, statSync } from 'node:fs'
import type {
  ApkAnalysisSummary,
  ApkBundleInfo,
  ApkComponentSummary,
  ApkDeepLink,
  SecretSeverity,
  SecurityFinding
} from '@shared/types'
import { parseManifest, type ParsedManifest } from './apk/manifest'
import { readDexHeader, readDexStrings, estimateObfuscation } from './apk/dex'
import { openZip, openZipBuffer, type OpenZipResult, type ZipEntryInfo } from './apk/zip'
import { extractSigningCerts } from './apk/signing'
import { extractEndpoints } from './apk/endpoints'
import {
  BUILT_IN_PATTERNS,
  scanCorpus,
  type CorpusEntry,
  type SecretPattern
} from './apk/secrets'
import { runSecurityChecks } from './apk/security-checks'
import { scanBundledConfigFiles } from './apk/config-files'
import { detectTrackers } from './apk/trackers'
import { buildFileInventory } from './apk/inventory'
import { collectNativeLibs } from './apk/native'
import { analyzeNetworkSecurityConfig } from './apk/network-security'
import { detectTechnologies } from './apk/technologies'
import { buildAttackSurface } from './apk/attack-surface'
import { buildHardeningSummary, buildPrivacySignals, buildRiskBreakdown } from './apk/insights'
import { getLogger } from '../utils/logger'

/**
 * Coordinator for APK static analysis.
 *
 * Two-phase design:
 *
 *   1. **Quick scan** (sub-second on a typical 50 MB APK): open the
 *      ZIP, parse the binary AndroidManifest, read DEX headers + DEX
 *      string tables, run every static analyzer (secrets, endpoints,
 *      security checks, trackers) against the raw strings we already
 *      have. This is everything the analyzer can do without
 *      decompiling DEX bytecode to Java — which is plenty for a first
 *      look.
 *
 *   2. **Deep scan** (later, optional): shell out to jadx to decompile
 *      DEX → Java sources. The Code tab uses those files and re-runs
 *      the secret/URL/security scans over them for higher recall. Jadx
 *      integration is the next pass; this file is structured so the
 *      summary returned today is identical in shape to what jadx-augmented
 *      runs return, just with smaller `secrets` / `endpoints` arrays.
 *
 * Results are cached in-memory keyed by SHA-256 of the APK file so
 * re-opening the same APK is instant.
 */

class ApkAnalyzerService {
  private cache = new Map<string, ApkAnalysisSummary>()

  /** Run the full quick-scan pipeline. Caches by APK SHA-256. */
  async analyze(filePath: string, customPatterns?: SecretPattern[]): Promise<ApkAnalysisSummary> {
    const log = getLogger()
    const stat = statSync(filePath)
    const sha = await sha256OfFile(filePath)

    const cached = this.cache.get(sha)
    if (cached && !customPatterns) {
      log.debug('APK analysis cache hit', { sha, packageName: cached.packageName })
      return cached
    }

    const analysisZip = await openAnalysisZip(filePath)
    const { zip, bundle } = analysisZip
    try {
      // ---- Manifest ----------------------------------------------------
      const manifestBuf = await zip.readEntry('AndroidManifest.xml')
      if (!manifestBuf) {
        throw new Error('AndroidManifest.xml not found inside the APK')
      }
      const manifest = parseManifest(manifestBuf)
      const fileInventory = buildFileInventory(zip.entries)

      // ---- DEX files ---------------------------------------------------
      const dexEntries = zip.entries.filter(
        (e) => /^classes\d*\.dex$/.test(e.fileName) && !e.isDirectory
      )
      const dexInfos: {
        name: string
        classCount: number
        version: string
        strings: string[]
        classDescriptors: string[]
      }[] = []
      for (const entry of dexEntries) {
        const buf = await zip.readEntry(entry.fileName)
        if (!buf) continue
        const header = readDexHeader(buf)
        if (!header) continue
        const strings = readDexStrings(buf)
        const classDescriptors = strings.filter((s) => s.startsWith('L') && s.endsWith(';'))
        dexInfos.push({
          name: entry.fileName,
          classCount: header.classCount,
          version: header.version,
          strings,
          classDescriptors
        })
      }
      const allDexStrings: string[] = []
      const allClassDescriptors: string[] = []
      for (const d of dexInfos) {
        allDexStrings.push(...d.strings)
        allClassDescriptors.push(...d.classDescriptors)
      }

      // ---- Signing -----------------------------------------------------
      const signingCertificates = await extractSigningCerts(zip)

      // ---- Native libs -------------------------------------------------
      const nativeLibraries = await collectNativeLibs(zip)

      // ---- Resource strings -------------------------------------------
      // We grab any reasonable string-like resource file plus the
      // strings.xml table (which we can't decode without aapt because
      // it's a compiled resources.arsc — for the quick scan, just take
      // the raw strings from DEX which already contains every constant).
      const resourceStringsCorpus = await collectResourceStringsCorpus(zip)

      // ---- Build the secret/endpoint corpus ----------------------------
      const corpus: CorpusEntry[] = []
      for (const d of dexInfos) {
        corpus.push({
          source: d.name,
          lines: d.strings.filter(
            (s) =>
              // Skip class descriptors and very short tokens — the regex
              // sweep wastes time on them and we already capture them
              // from a different angle.
              !(s.startsWith('L') && s.endsWith(';')) && s.length >= 8
          )
        })
      }
      corpus.push(...resourceStringsCorpus)

      const secrets = scanCorpus(corpus, customPatterns ?? [])
      const endpoints = extractEndpoints(corpus)
      const trackers = detectTrackers(allClassDescriptors)
      const technologies = detectTechnologies({
        classDescriptors: allClassDescriptors,
        strings: [...allDexStrings, ...resourceStringsCorpus.flatMap((entry) => entry.lines)],
        nativeLibraries
      })
      const networkSecurity = await analyzeNetworkSecurityConfig(zip, manifest)
      const attackSurface = buildAttackSurface(manifest)

      // ---- Security checks --------------------------------------------
      // Manifest + code heuristics first; then a parallel sweep for
      // bundled config / credential files (keystores, .env, Firebase
      // configs, ProGuard mappings, …). Both feed the same Security
      // tab via securityFindings — risk-score weighting picks up each
      // automatically.
      const [codeFindings, fileFindings] = await Promise.all([
        Promise.resolve(runSecurityChecks(manifest, { lines: allDexStrings })),
        scanBundledConfigFiles(zip)
      ])
      const securityFindings: SecurityFinding[] = [
        ...codeFindings,
        ...fileFindings,
        ...networkSecurity.findings
      ].sort(
        (a, b) => severityRank(a.severity) - severityRank(b.severity)
      )
      const privacySignals = buildPrivacySignals({ manifest, trackers, endpoints })
      const obfuscation = estimateObfuscation(allClassDescriptors)
      const hardening = buildHardeningSummary({
        manifest,
        technologies,
        attackSurface,
        networkSecurity,
        obfuscationRatio: obfuscation.ratio,
        nativeLibraries,
        secrets,
        securityFindings
      })
      const riskBreakdown = buildRiskBreakdown({
        secrets,
        securityFindings,
        endpoints,
        attackSurface,
        privacySignals
      })

      // ---- Risk score --------------------------------------------------
      const { riskScore, verdict } = scoreRisk({
        manifest,
        secrets,
        endpoints,
        securityFindings,
        attackSurface,
        privacySignals
      })

      const summary: ApkAnalysisSummary = {
        apkSha256: sha,
        filePath,
        size: stat.size,
        bundle,
        packageName: manifest.packageName,
        versionName: manifest.versionName,
        versionCode: manifest.versionCode,
        minSdk: manifest.minSdk,
        targetSdk: manifest.targetSdk,
        maxSdk: manifest.maxSdk,
        application: {
          label: manifest.application.label,
          debuggable: manifest.application.debuggable,
          allowBackup: manifest.application.allowBackup,
          usesCleartextTraffic: manifest.application.usesCleartextTraffic,
          networkSecurityConfigRef: manifest.application.networkSecurityConfigRef,
          testOnly: manifest.application.testOnly
        },
        permissions: manifest.permissions,
        declaredPermissions: manifest.declaredPermissions,
        components: {
          activities: manifest.components.activities.map(toComponentSummary),
          services: manifest.components.services.map(toComponentSummary),
          receivers: manifest.components.receivers.map(toComponentSummary),
          providers: manifest.components.providers.map(toComponentSummary)
        },
        attackSurface,
        deepLinks: manifest.deepLinks.map(
          (d): ApkDeepLink => ({
            component: d.component,
            scheme: d.scheme,
            host: d.host,
            path: d.path,
            example: d.example
          })
        ),
        signingCertificates,
        nativeLibraries,
        fileInventory,
        networkSecurity,
        technologies,
        privacySignals,
        hardening,
        dexClassCount: dexInfos.reduce((a, d) => a + d.classCount, 0),
        dexFiles: dexInfos.map((d) => ({
          name: d.name,
          classCount: d.classCount,
          version: d.version
        })),
        obfuscation,
        secrets,
        endpoints,
        securityFindings,
        trackers,
        // Sample 200 of the most "interesting" DEX strings (UTF-y,
        // longer than a few chars, drop class descriptors). The full
        // strings table can have hundreds of thousands of entries; the
        // sample is for the Strings tab default view.
        stringsSample: pickStringsSample(allDexStrings, 200),
        manifestXml: manifest.prettyXml,
        riskScore,
        riskBreakdown,
        verdict,
        analyzedAt: new Date().toISOString()
      }

      // Only cache when no custom patterns were used — custom patterns
      // would otherwise hide other users' results behind a single SHA.
      if (!customPatterns) this.cache.set(sha, summary)
      return summary
    } finally {
      await analysisZip.close()
    }
  }

  /** Drop the cached summary for an APK (used after the file changes). */
  invalidate(filePath: string): void {
    // We don't know the sha without re-reading — clear everything for
    // safety. The cache is small (one entry per APK the user looks at).
    this.cache.clear()
    void filePath
  }

  /** Currently a no-op stub; real jadx integration lands in pass 2. */
  async decompile(_filePath: string): Promise<{ outputDir: string }> {
    throw new Error(
      'Decompilation is being integrated with jadx as a toolchain entry. The quick analyzer already exposes everything else.'
    )
  }

  /** Surface the built-in pattern catalog so the renderer can render
   *  the "what we scan for" reference table. */
  listBuiltInPatterns(): SecretPattern[] {
    return BUILT_IN_PATTERNS
  }

  /** Currently routes through analyze() with custom patterns. */
  async searchSecrets(
    filePath: string,
    rawPatterns?: string[]
  ): Promise<ApkAnalysisSummary['secrets']> {
    const custom: SecretPattern[] = (rawPatterns ?? []).map((src, i) => ({
      id: `custom-${i}`,
      label: `Custom pattern ${i + 1}`,
      description: 'User-defined regex.',
      severity: 'medium' as SecretSeverity,
      regex: new RegExp(src)
    }))
    const result = await this.analyze(filePath, custom)
    return result.secrets
  }

  async getManifest(filePath: string): Promise<string> {
    const result = await this.analyze(filePath)
    return result.manifestXml
  }

  async listStrings(filePath: string): Promise<string[]> {
    const result = await this.analyze(filePath)
    return result.stringsSample
  }
}

interface AnalysisZipContext {
  zip: OpenZipResult
  bundle: ApkBundleInfo
  close(): Promise<void>
}

async function openAnalysisZip(filePath: string): Promise<AnalysisZipContext> {
  const format = detectPackageFormat(filePath)
  const outer = await openZip(filePath)
  const hasManifest = outer.entries.some(
    (entry) => !entry.isDirectory && entry.fileName === 'AndroidManifest.xml'
  )

  if (hasManifest) {
    return {
      zip: outer,
      bundle: {
        format,
        analyzedEntry: null,
        splitCount: 1
      },
      close: () => outer.close()
    }
  }

  const apkEntries = outer.entries.filter(isNestedApkEntry)
  if (apkEntries.length === 0) {
    await outer.close()
    throw new Error(
      'AndroidManifest.xml was not found. Select a valid .apk, or a .xapk/.apks/.apkm bundle containing APK splits.'
    )
  }

  const selected = pickBaseApk(apkEntries)
  const nestedBuffer = await outer.readEntry(selected.fileName)
  await outer.close()
  if (!nestedBuffer) {
    throw new Error(`Could not read ${selected.fileName} from the Android package bundle.`)
  }

  const nested = await openZipBuffer(nestedBuffer)
  const nestedHasManifest = nested.entries.some(
    (entry) => !entry.isDirectory && entry.fileName === 'AndroidManifest.xml'
  )
  if (!nestedHasManifest) {
    await nested.close()
    throw new Error(
      `${selected.fileName} does not contain AndroidManifest.xml. The bundle may be malformed or encrypted.`
    )
  }

  return {
    zip: nested,
    bundle: {
      format,
      analyzedEntry: selected.fileName,
      splitCount: apkEntries.length
    },
    close: () => nested.close()
  }
}

function detectPackageFormat(filePath: string): ApkBundleInfo['format'] {
  const lower = filePath.toLowerCase()
  if (lower.endsWith('.xapk')) return 'xapk'
  if (lower.endsWith('.apks')) return 'apks'
  if (lower.endsWith('.apkm')) return 'apkm'
  return 'apk'
}

function isNestedApkEntry(entry: ZipEntryInfo): boolean {
  const lower = entry.fileName.toLowerCase()
  return !entry.isDirectory && lower.endsWith('.apk') && !lower.includes('__macosx/')
}

function pickBaseApk(entries: ZipEntryInfo[]): ZipEntryInfo {
  return [...entries].sort((a, b) => {
    const rank = nestedApkRank(a.fileName) - nestedApkRank(b.fileName)
    if (rank !== 0) return rank
    const size = b.size - a.size
    if (size !== 0) return size
    return a.fileName.localeCompare(b.fileName)
  })[0]!
}

function nestedApkRank(name: string): number {
  const file = name.toLowerCase().split('/').pop() ?? name.toLowerCase()
  if (file === 'base.apk') return 0
  if (file === 'base-master.apk' || file === 'base_master.apk') return 1
  if (file.startsWith('base.') || file.startsWith('base-') || file.startsWith('base_')) return 2
  if (!looksLikeSplitApk(file)) return 3
  return 4
}

function looksLikeSplitApk(file: string): boolean {
  return /(?:^|[._-])(?:config|split_config|dpi|ldpi|mdpi|hdpi|xhdpi|xxhdpi|xxxhdpi|tvdpi|armeabi|arm64|x86|mips|en|es|fr|de|it|pt|ru|zh|ja|ko|ar|hi)(?:[._-]|$)/i.test(
    file
  )
}

function toComponentSummary(c: {
  name: string
  exported: boolean
  exportedExplicit: boolean
  permission: string | null
  intentFilters: {
    actions: string[]
    schemes: string[]
    hosts: string[]
    paths: string[]
  }[]
  authorities: string | null
}): ApkComponentSummary {
  const actions = new Set<string>()
  const deepLinks: string[] = []
  for (const f of c.intentFilters) {
    for (const a of f.actions) actions.add(a)
    for (const s of f.schemes) {
      if (f.hosts.length === 0) {
        deepLinks.push(`${s}://`)
        continue
      }
      for (const h of f.hosts) {
        if (f.paths.length === 0) {
          deepLinks.push(`${s}://${h}/`)
          continue
        }
        for (const p of f.paths) {
          deepLinks.push(`${s}://${h}${p.startsWith('/') ? p : '/' + p}`)
        }
      }
    }
  }
  return {
    name: c.name,
    exported: c.exported,
    exportedExplicit: c.exportedExplicit,
    permission: c.permission,
    actions: [...actions],
    deepLinks,
    authorities: c.authorities
  }
}

async function collectResourceStringsCorpus(zip: {
  entries: ZipEntryInfo[]
  readEntry: (n: string) => Promise<Buffer | null>
}): Promise<CorpusEntry[]> {
  const out: CorpusEntry[] = []
  // Anything that's plain text and reasonably sized. resources.arsc and
  // binary XMLs aren't included — we already have DEX strings for those.
  const candidates = zip.entries.filter((e) => {
    if (e.isDirectory) return false
    if (e.size > 1024 * 1024) return false // skip > 1MB
    if (e.size < 16) return false
    // Heuristic: source-y extensions, not compiled binaries.
    return /\.(properties|json|js|html?|css|txt|yml|yaml|xml|csv|conf|ini|cfg|map)$/i.test(
      e.fileName
    )
  })
  for (const entry of candidates) {
    const buf = await zip.readEntry(entry.fileName)
    if (!buf) continue
    // Skip if it looks like binary (NULs in first 64 bytes).
    if (looksBinary(buf)) continue
    const text = buf.toString('utf8')
    out.push({ source: entry.fileName, lines: text.split(/\r?\n/) })
  }
  return out
}

function looksBinary(buf: Buffer): boolean {
  const sample = buf.length > 64 ? buf.subarray(0, 64) : buf
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) return true
  }
  return false
}

function pickStringsSample(all: string[], cap: number): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of all) {
    if (!s) continue
    if (s.length < 6) continue
    if (s.startsWith('L') && s.endsWith(';')) continue
    // Drop hex blobs and pure-alpha keywords that are noise.
    if (/^[0-9a-fA-F]+$/.test(s) && s.length < 24) continue
    if (seen.has(s)) continue
    seen.add(s)
    out.push(s)
    if (out.length >= cap) break
  }
  return out
}

function severityRank(s: SecurityFinding['severity']): number {
  return { critical: 0, high: 1, medium: 2, low: 3, info: 4 }[s] ?? 5
}

function scoreRisk(input: {
  manifest: ParsedManifest
  secrets: ApkAnalysisSummary['secrets']
  endpoints: ApkAnalysisSummary['endpoints']
  securityFindings: SecurityFinding[]
  attackSurface: ApkAnalysisSummary['attackSurface']
  privacySignals: ApkAnalysisSummary['privacySignals']
}): { riskScore: number; verdict: ApkAnalysisSummary['verdict'] } {
  const weights: Record<SecretSeverity, number> = {
    critical: 25,
    high: 12,
    medium: 5,
    low: 2,
    info: 0.5
  }
  let score = 0
  for (const f of input.securityFindings) score += weights[f.severity]
  for (const s of input.secrets) score += weights[s.severity]
  for (const a of input.attackSurface) score += Math.min(10, weights[a.severity] * 0.7)
  for (const p of input.privacySignals) score += Math.min(8, weights[p.severity] * 0.5)
  // Cleartext endpoints are a finding even when there's no manifest flag.
  score += input.endpoints.filter((e) => e.insecure).length * 1.5

  const clamped = Math.min(100, Math.round(score))
  let verdict: ApkAnalysisSummary['verdict'] = 'clean'
  if (clamped >= 70) verdict = 'critical'
  else if (clamped >= 40) verdict = 'risky'
  else if (clamped >= 20) verdict = 'concerning'
  else if (clamped >= 8) verdict = 'low-risk'

  return { riskScore: clamped, verdict }
}

function sha256OfFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex').toUpperCase()))
    stream.on('error', reject)
  })
}

export const apkAnalyzerService = new ApkAnalyzerService()
