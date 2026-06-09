import type { ApkNativeLib, ApkTechnologyFinding, SecretSeverity } from '@shared/types'

interface TechnologyRule {
  id: string
  name: string
  category: ApkTechnologyFinding['category']
  classPrefixes?: string[]
  stringNeedles?: string[]
  nativeNeedles?: string[]
  confidence?: ApkTechnologyFinding['confidence']
  risk?: SecretSeverity
  note?: string
}

const RULES: TechnologyRule[] = [
  {
    id: 'flutter',
    name: 'Flutter',
    category: 'framework',
    classPrefixes: ['io.flutter'],
    nativeNeedles: ['libflutter.so', 'libapp.so'],
    note: 'Flutter TLS and platform-channel behavior often need framework-specific instrumentation.'
  },
  {
    id: 'react-native',
    name: 'React Native',
    category: 'framework',
    classPrefixes: ['com.facebook.react'],
    nativeNeedles: ['libreactnativejni.so', 'libhermes.so'],
    note: 'Inspect bundled JS assets and native bridges.'
  },
  {
    id: 'cordova',
    name: 'Cordova / PhoneGap',
    category: 'framework',
    classPrefixes: ['org.apache.cordova'],
    stringNeedles: ['cordova.js'],
    note: 'Review WebView origin handling, plugin exposure, and file URL settings.'
  },
  {
    id: 'unity',
    name: 'Unity',
    category: 'framework',
    classPrefixes: ['com.unity3d.player'],
    nativeNeedles: ['libunity.so', 'libil2cpp.so'],
    note: 'Native IL2CPP code and asset bundles may carry business logic.'
  },
  {
    id: 'xamarin',
    name: 'Xamarin / .NET Android',
    category: 'framework',
    classPrefixes: ['mono.android', 'crc64'],
    nativeNeedles: ['libmonodroid.so']
  },
  {
    id: 'okhttp',
    name: 'OkHttp',
    category: 'networking',
    classPrefixes: ['okhttp3', 'com.squareup.okhttp']
  },
  {
    id: 'retrofit',
    name: 'Retrofit',
    category: 'networking',
    classPrefixes: ['retrofit2', 'com.squareup.retrofit2']
  },
  {
    id: 'ktor',
    name: 'Ktor Client',
    category: 'networking',
    classPrefixes: ['io.ktor.client']
  },
  {
    id: 'grpc',
    name: 'gRPC',
    category: 'networking',
    classPrefixes: ['io.grpc']
  },
  {
    id: 'okhttp-pinning',
    name: 'OkHttp CertificatePinner',
    category: 'crypto',
    classPrefixes: ['okhttp3.CertificatePinner'],
    stringNeedles: ['CertificatePinner'],
    risk: 'info',
    note: 'Certificate pinning is present. Plan a pinning-bypass or pinset review.'
  },
  {
    id: 'trustkit',
    name: 'TrustKit',
    category: 'crypto',
    classPrefixes: ['com.datatheorem.android.trustkit'],
    risk: 'info',
    note: 'Dedicated TLS pinning library detected.'
  },
  {
    id: 'sqlcipher',
    name: 'SQLCipher',
    category: 'storage',
    classPrefixes: ['net.sqlcipher'],
    nativeNeedles: ['libsqlcipher.so']
  },
  {
    id: 'room',
    name: 'Android Room',
    category: 'storage',
    classPrefixes: ['androidx.room']
  },
  {
    id: 'realm',
    name: 'Realm Database',
    category: 'storage',
    classPrefixes: ['io.realm'],
    nativeNeedles: ['librealm-jni.so']
  },
  {
    id: 'firebase',
    name: 'Firebase',
    category: 'cloud',
    classPrefixes: ['com.google.firebase'],
    stringNeedles: ['google-services.json']
  },
  {
    id: 'aws-amplify',
    name: 'AWS Amplify / Mobile SDK',
    category: 'cloud',
    classPrefixes: ['com.amazonaws', 'com.amplifyframework'],
    stringNeedles: ['amplifyconfiguration.json', 'awsconfiguration.json']
  },
  {
    id: 'play-integrity',
    name: 'Play Integrity / SafetyNet',
    category: 'anti-tamper',
    classPrefixes: ['com.google.android.play.integrity', 'com.google.android.gms.safetynet'],
    risk: 'info',
    note: 'Device/app attestation signals are present.'
  },
  {
    id: 'rootbeer',
    name: 'RootBeer',
    category: 'anti-tamper',
    classPrefixes: ['com.scottyab.rootbeer'],
    risk: 'info',
    note: 'Root detection library detected.'
  },
  {
    id: 'dexguard',
    name: 'DexGuard / Guardsquare',
    category: 'obfuscation',
    classPrefixes: ['com.guardsquare', 'com.saikoa.dexguard'],
    stringNeedles: ['DexGuard'],
    risk: 'info'
  },
  {
    id: 'qihoo-jiagu',
    name: 'Qihoo 360 Jiagu',
    category: 'obfuscation',
    classPrefixes: ['com.qihoo.util.StubApp'],
    nativeNeedles: ['libjiagu.so'],
    risk: 'low',
    note: 'Commercial packer detected. Expect encrypted payloads and delayed class loading.'
  },
  {
    id: 'secneo',
    name: 'Bangcle / SecNeo packer',
    category: 'obfuscation',
    classPrefixes: ['com.secneo.apkwrapper'],
    nativeNeedles: ['libDexHelper.so', 'libDexHelper-x86.so'],
    risk: 'low'
  },
  {
    id: 'stripe',
    name: 'Stripe Android SDK',
    category: 'payments',
    classPrefixes: ['com.stripe.android'],
    risk: 'info'
  },
  {
    id: 'paypal',
    name: 'PayPal Android SDK',
    category: 'payments',
    classPrefixes: ['com.paypal.android', 'com.paypal.checkout', 'com.paypal.pyplcheckout'],
    risk: 'info'
  },
  {
    id: 'auth0',
    name: 'Auth0',
    category: 'identity',
    classPrefixes: ['com.auth0.android']
  },
  {
    id: 'okta',
    name: 'Okta OIDC/Authn',
    category: 'identity',
    classPrefixes: ['com.okta.oidc', 'com.okta.authn']
  },
  {
    id: 'jetpack-compose',
    name: 'Jetpack Compose',
    category: 'ui',
    classPrefixes: ['androidx.compose']
  },
  {
    id: 'kotlin',
    name: 'Kotlin',
    category: 'build',
    classPrefixes: ['kotlin', 'kotlinx'],
    stringNeedles: ['kotlin.Metadata']
  }
]

export function detectTechnologies(input: {
  classDescriptors: string[]
  strings: string[]
  nativeLibraries: ApkNativeLib[]
}): ApkTechnologyFinding[] {
  const classes = normalizeClassDescriptors(input.classDescriptors)
  const strings = new Set(input.strings.filter((s) => s.length <= 512))
  const nativeNames = new Set(
    input.nativeLibraries.flatMap((group) => group.files.map((file) => file.name))
  )

  const findings: ApkTechnologyFinding[] = []
  for (const rule of RULES) {
    const evidence: string[] = []
    for (const prefix of rule.classPrefixes ?? []) {
      const hit = classes.find((klass) => klass === prefix || klass.startsWith(prefix + '.'))
      if (hit) evidence.push(hit)
    }
    for (const needle of rule.stringNeedles ?? []) {
      const hit = [...strings].find((value) => value.includes(needle))
      if (hit) evidence.push(hit.length > 120 ? `${hit.slice(0, 120)}...` : hit)
    }
    for (const needle of rule.nativeNeedles ?? []) {
      const hit = [...nativeNames].find((name) => name === needle || name.includes(needle))
      if (hit) evidence.push(hit)
    }
    if (evidence.length === 0) continue
    findings.push({
      id: rule.id,
      name: rule.name,
      category: rule.category,
      confidence: rule.confidence ?? (evidence.length > 1 ? 'high' : 'medium'),
      evidence: [...new Set(evidence)].slice(0, 5),
      note: rule.note ?? null,
      risk: rule.risk ?? null
    })
  }

  return findings.sort(
    (a, b) =>
      categoryRank(a.category) - categoryRank(b.category) ||
      confidenceRank(a.confidence) - confidenceRank(b.confidence) ||
      a.name.localeCompare(b.name)
  )
}

function normalizeClassDescriptors(classDescriptors: string[]): string[] {
  const out = new Set<string>()
  for (const descriptor of classDescriptors) {
    if (!descriptor.startsWith('L') || !descriptor.endsWith(';')) continue
    out.add(descriptor.slice(1, -1).replace(/\//g, '.').replace(/\$/g, '.'))
  }
  return [...out]
}

function categoryRank(category: ApkTechnologyFinding['category']): number {
  const ranks: Record<ApkTechnologyFinding['category'], number> = {
    framework: 0,
    obfuscation: 1,
    'anti-tamper': 2,
    networking: 3,
    crypto: 4,
    identity: 5,
    payments: 6,
    storage: 7,
    cloud: 8,
    ui: 9,
    build: 10,
    sdk: 11
  }
  return ranks[category] ?? 99
}

function confidenceRank(confidence: ApkTechnologyFinding['confidence']): number {
  return { high: 0, medium: 1, low: 2 }[confidence]
}
