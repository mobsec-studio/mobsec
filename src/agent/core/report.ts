/**
 * Mutable accumulator detectors write into. Decouples each detector from
 * the full report shape and dedupes/merges contributions by id so two
 * detectors observing the same library don't double-report it.
 */

import type {
  CryptoUsage,
  FrameworkInfo,
  NetworkingLib,
  SecurityControl,
  StorageLayer
} from '@shared/frida-intel'

function mergeEvidence(into: string[], from: string[]): void {
  for (const e of from) {
    if (into.indexOf(e) === -1) into.push(e)
  }
}

export class ReportBuilder {
  readonly frameworks: FrameworkInfo[] = []
  readonly networking: NetworkingLib[] = []
  readonly crypto: CryptoUsage[] = []
  readonly storage: StorageLayer[] = []
  readonly security: SecurityControl[] = []
  readonly warnings: string[] = []

  addFramework(f: FrameworkInfo): void {
    const existing = this.frameworks.find((x) => x.kind === f.kind)
    if (existing) {
      if (f.confidence > existing.confidence) {
        existing.confidence = f.confidence
        existing.label = f.label
      }
      if (f.version && !existing.version) existing.version = f.version
      mergeEvidence(existing.evidence, f.evidence)
      return
    }
    this.frameworks.push({ ...f, evidence: f.evidence.slice() })
  }

  addNetworking(n: NetworkingLib): void {
    const existing = this.networking.find((x) => x.id === n.id)
    if (existing) {
      if (n.version && !existing.version) existing.version = n.version
      mergeEvidence(existing.evidence, n.evidence)
      return
    }
    this.networking.push({ ...n, evidence: n.evidence.slice() })
  }

  addCrypto(c: CryptoUsage): void {
    const existing = this.crypto.find((x) => x.id === c.id)
    if (existing) {
      existing.weak = existing.weak || c.weak
      mergeEvidence(existing.algorithms, c.algorithms)
      mergeEvidence(existing.evidence, c.evidence)
      return
    }
    this.crypto.push({ ...c, algorithms: c.algorithms.slice(), evidence: c.evidence.slice() })
  }

  addStorage(s: StorageLayer): void {
    const existing = this.storage.find((x) => x.id === s.id)
    if (existing) {
      existing.encrypted = existing.encrypted || s.encrypted
      mergeEvidence(existing.evidence, s.evidence)
      return
    }
    this.storage.push({ ...s, evidence: s.evidence.slice() })
  }

  addSecurity(s: SecurityControl): void {
    const existing = this.security.find((x) => x.id === s.id)
    if (existing) {
      if (s.confidence > existing.confidence) existing.confidence = s.confidence
      if (s.variant && !existing.variant) existing.variant = s.variant
      mergeEvidence(existing.evidence, s.evidence)
      return
    }
    this.security.push({ ...s, evidence: s.evidence.slice() })
  }

  warn(text: string): void {
    if (this.warnings.indexOf(text) === -1) this.warnings.push(text)
  }
}
