/**
 * Security-controls detector.
 *
 * Honesty is the design rule here. We report:
 *   - dedicated defence libraries (RootBeer, TrustKit, SafetyNet/Play
 *     Integrity, BiometricPrompt, Certificate Transparency) at high
 *     confidence — their presence ⇒ use.
 *   - commercial packers/protectors fingerprinted from native lib names
 *     (Jiagu, Bangcle, Tencent Legu, DexProtector, Promon…). These bundle
 *     root + Frida + debugger + emulator detection AND integrity, so one
 *     match is extremely informative.
 *   - generic okhttp CertificatePinner presence at *low* confidence — the
 *     class ships with OkHttp whether or not pinning is configured, so we
 *     flag it as "verify at runtime" rather than assert it.
 *
 * Purely behavioural controls (FLAG_SECURE, signature checks, inline
 * emulator/debugger probes) are intentionally left to the strategy
 * engine's live verification rather than false-positived from a snapshot.
 */

import type { Detector } from '../core/registry'
import type { ReconContext } from '../core/context'
import type { ReportBuilder } from '../core/report'
import type { SecurityControl } from '@shared/frida-intel'

interface ClassSig {
  marker: string
  control: Omit<SecurityControl, 'evidence'>
}

const CLASS_SIGNATURES: ClassSig[] = [
  {
    marker: 'com.scottyab.rootbeer.RootBeer',
    control: { id: 'rootbeer', label: 'Root detection (RootBeer)', kind: 'root-detection', variant: 'rootbeer', confidence: 0.95 }
  },
  {
    marker: 'com.kimchangyoun.rootbeerFresh.RootBeer',
    control: { id: 'rootbeer-fresh', label: 'Root detection (RootBeerFresh)', kind: 'root-detection', variant: 'rootbeer-fresh', confidence: 0.95 }
  },
  {
    marker: 'com.datatheorem.android.trustkit.TrustKit',
    control: { id: 'trustkit', label: 'SSL pinning (TrustKit)', kind: 'ssl-pinning', variant: 'trustkit', confidence: 0.9 }
  },
  {
    marker: 'com.appmattus.certificatetransparency.CTInterceptor',
    control: { id: 'certificate-transparency', label: 'Certificate Transparency (appmattus)', kind: 'ssl-pinning', variant: 'certificate-transparency', confidence: 0.85 }
  },
  {
    marker: 'com.google.android.gms.safetynet.SafetyNetClient',
    control: { id: 'safetynet', label: 'Attestation (SafetyNet)', kind: 'integrity', variant: 'safetynet', confidence: 0.9 }
  },
  {
    marker: 'com.google.android.play.core.integrity.IntegrityManager',
    control: { id: 'play-integrity', label: 'Play Integrity API', kind: 'integrity', variant: 'play-integrity', confidence: 0.92 }
  },
  {
    marker: 'com.google.android.play.integrity.api.IntegrityManager',
    control: { id: 'play-integrity', label: 'Play Integrity API', kind: 'integrity', variant: 'play-integrity', confidence: 0.92 }
  },
  {
    marker: 'androidx.biometric.BiometricPrompt',
    control: { id: 'biometric', label: 'Biometric authentication (androidx)', kind: 'biometric', variant: 'androidx-biometric', confidence: 0.9 }
  }
]

/** Native-library fingerprints for commercial packers/protectors. */
const PACKER_SIGNATURES: { match: string; vendor: string }[] = [
  { match: 'libjiagu', vendor: 'Qihoo 360 Jiagu' },
  { match: 'libdexhelper', vendor: 'SecNeo (DexHelper)' },
  { match: 'libsecshell', vendor: 'Bangcle SecShell' },
  { match: 'libsecmain', vendor: 'Bangcle' },
  { match: 'libsecexe', vendor: 'Bangcle' },
  { match: 'libtup.so', vendor: 'Tencent Legu' },
  { match: 'libtprt', vendor: 'Tencent Legu' },
  { match: 'libtosprotection', vendor: 'Tencent' },
  { match: 'libnsaferonly', vendor: 'Tencent NSaferOnly' },
  { match: 'libnesec', vendor: 'NetEase' },
  { match: 'libnqshield', vendor: 'NQ Shield' },
  { match: 'libsgmain', vendor: 'Alibaba Security Guard' },
  { match: 'libsgsecuritybody', vendor: 'Alibaba Security Guard' },
  { match: 'libmobisec', vendor: 'Alibaba (legacy)' },
  { match: 'libexecmain', vendor: 'Ijiami' },
  { match: 'libexec.so', vendor: 'Ijiami' },
  { match: 'libdexprotector', vendor: 'DexProtector' },
  { match: 'libcovault', vendor: 'Promon SHIELD' },
  { match: 'libapssec', vendor: 'Baidu' },
  { match: 'libchaosvmp', vendor: 'NagaPT / ChaosVMP' },
  { match: 'libkonyjsvm', vendor: 'Kony' },
  { match: 'libapasec', vendor: 'Ali Jaq' }
]

export const securityDetector: Detector = {
  id: 'security',
  detect(ctx: ReconContext, out: ReportBuilder): void {
    // 1. Dedicated defence libraries (class markers).
    for (const sig of CLASS_SIGNATURES) {
      if (!ctx.hasClass(sig.marker)) continue
      out.addSecurity({ ...sig.control, evidence: [sig.marker] })
    }

    // 2. Generic OkHttp pinning surface — low confidence, verify at runtime.
    if (ctx.hasClass('okhttp3.CertificatePinner')) {
      out.addSecurity({
        id: 'okhttp-pinning',
        label: 'SSL pinning (OkHttp CertificatePinner — verify)',
        kind: 'ssl-pinning',
        variant: 'okhttp-certificatepinner',
        confidence: 0.4,
        evidence: ['okhttp3.CertificatePinner present (ships with OkHttp; config not confirmed)']
      })
    }

    // 3. Commercial packer / protector fingerprints (native libs).
    for (const sig of PACKER_SIGNATURES) {
      const mod = ctx.findModule(sig.match)
      if (!mod) continue
      out.addSecurity({
        id: 'packer',
        label: `Commercial protector (${sig.vendor})`,
        kind: 'tamper-detection',
        variant: sig.vendor,
        confidence: 0.9,
        evidence: [
          `${mod.name} loaded`,
          'Packers bundle root/Frida/debugger/emulator detection + integrity checks'
        ]
      })
      // A packer almost always implies active anti-Frida.
      out.addSecurity({
        id: 'anti-frida',
        label: 'Anti-Frida / anti-hook (implied by protector)',
        kind: 'frida-detection',
        variant: sig.vendor,
        confidence: 0.7,
        evidence: [`Implied by ${sig.vendor} protector`]
      })
    }
  }
}
