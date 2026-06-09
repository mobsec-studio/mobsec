import type { TrackerFinding } from '@shared/types'

/**
 * Curated tracker / SDK fingerprint database.
 *
 * We match by Java package prefix — every entry that survives the DEX
 * string sweep with a matching `Lcom/xxx/yyy/` class descriptor counts
 * as a hit. This is the same approach Exodus Privacy uses, with a hand-
 * picked subset focused on the SDKs we see most often in penetration
 * tests (analytics, ad networks, attribution, crash reporting).
 *
 * Categories let the UI cluster findings sensibly. We deliberately
 * don't editorialize beyond category — whether a tracker is "OK" for
 * a given app is a privacy / policy decision the analyst makes.
 */

export interface TrackerEntry {
  id: string
  name: string
  category:
    | 'analytics'
    | 'crash-reporting'
    | 'ads'
    | 'attribution'
    | 'push'
    | 'sdk'
    | 'cloud'
    | 'payment'
    | 'support'
    | 'session-replay'
    | 'monitoring'
  /** Java package prefixes that uniquely identify the SDK. */
  classPrefixes: string[]
  /** Optional documentation URL the UI links to. */
  url?: string
}

export const TRACKER_DB: TrackerEntry[] = [
  // ---- Google ----
  {
    id: 'google-firebase-analytics',
    name: 'Firebase Analytics',
    category: 'analytics',
    classPrefixes: ['com.google.firebase.analytics', 'com.google.android.gms.measurement'],
    url: 'https://firebase.google.com/products/analytics'
  },
  {
    id: 'google-crashlytics',
    name: 'Firebase Crashlytics',
    category: 'crash-reporting',
    classPrefixes: ['com.google.firebase.crashlytics', 'io.fabric.sdk'],
    url: 'https://firebase.google.com/products/crashlytics'
  },
  {
    id: 'google-admob',
    name: 'Google AdMob',
    category: 'ads',
    classPrefixes: ['com.google.android.gms.ads', 'com.google.android.gms.internal.ads'],
    url: 'https://admob.google.com'
  },
  {
    id: 'google-fcm',
    name: 'Firebase Cloud Messaging',
    category: 'push',
    classPrefixes: ['com.google.firebase.messaging']
  },
  {
    id: 'google-play-billing',
    name: 'Google Play Billing',
    category: 'sdk',
    classPrefixes: ['com.android.billingclient']
  },
  // ---- Meta / Facebook ----
  {
    id: 'facebook-sdk',
    name: 'Facebook SDK',
    category: 'analytics',
    classPrefixes: ['com.facebook.android', 'com.facebook.appevents', 'com.facebook.internal']
  },
  {
    id: 'facebook-ads',
    name: 'Facebook Audience Network',
    category: 'ads',
    classPrefixes: ['com.facebook.ads']
  },
  // ---- Attribution ----
  {
    id: 'appsflyer',
    name: 'AppsFlyer',
    category: 'attribution',
    classPrefixes: ['com.appsflyer'],
    url: 'https://www.appsflyer.com'
  },
  {
    id: 'adjust',
    name: 'Adjust',
    category: 'attribution',
    classPrefixes: ['com.adjust.sdk']
  },
  {
    id: 'branch',
    name: 'Branch',
    category: 'attribution',
    classPrefixes: ['io.branch']
  },
  {
    id: 'singular',
    name: 'Singular',
    category: 'attribution',
    classPrefixes: ['com.singular.sdk']
  },
  {
    id: 'kochava',
    name: 'Kochava',
    category: 'attribution',
    classPrefixes: ['com.kochava']
  },
  // ---- Crash reporting / monitoring ----
  {
    id: 'sentry',
    name: 'Sentry',
    category: 'crash-reporting',
    classPrefixes: ['io.sentry']
  },
  {
    id: 'bugsnag',
    name: 'Bugsnag',
    category: 'crash-reporting',
    classPrefixes: ['com.bugsnag.android']
  },
  {
    id: 'instabug',
    name: 'Instabug',
    category: 'crash-reporting',
    classPrefixes: ['com.instabug']
  },
  {
    id: 'newrelic',
    name: 'New Relic',
    category: 'crash-reporting',
    classPrefixes: ['com.newrelic.agent.android']
  },
  // ---- Analytics ----
  {
    id: 'mixpanel',
    name: 'Mixpanel',
    category: 'analytics',
    classPrefixes: ['com.mixpanel.android']
  },
  {
    id: 'amplitude',
    name: 'Amplitude',
    category: 'analytics',
    classPrefixes: ['com.amplitude.api']
  },
  {
    id: 'segment',
    name: 'Segment',
    category: 'analytics',
    classPrefixes: ['com.segment.analytics']
  },
  {
    id: 'flurry',
    name: 'Flurry',
    category: 'analytics',
    classPrefixes: ['com.flurry.android']
  },
  {
    id: 'umeng',
    name: 'Umeng (Alibaba)',
    category: 'analytics',
    classPrefixes: ['com.umeng']
  },
  // ---- Ad networks ----
  {
    id: 'unity-ads',
    name: 'Unity Ads',
    category: 'ads',
    classPrefixes: ['com.unity3d.ads']
  },
  {
    id: 'applovin',
    name: 'AppLovin',
    category: 'ads',
    classPrefixes: ['com.applovin']
  },
  {
    id: 'ironsource',
    name: 'ironSource',
    category: 'ads',
    classPrefixes: ['com.ironsource.sdk', 'com.ironsource.mediationsdk']
  },
  {
    id: 'tapjoy',
    name: 'Tapjoy',
    category: 'ads',
    classPrefixes: ['com.tapjoy']
  },
  // ---- Push ----
  {
    id: 'onesignal',
    name: 'OneSignal',
    category: 'push',
    classPrefixes: ['com.onesignal']
  },
  // ---- Cloud / general purpose ----
  {
    id: 'aws-sdk',
    name: 'AWS Android SDK',
    category: 'cloud',
    classPrefixes: ['com.amazonaws']
  },
  {
    id: 'azure',
    name: 'Microsoft Azure SDK',
    category: 'cloud',
    classPrefixes: ['com.microsoft.azure']
  },
  {
    id: 'okhttp',
    name: 'OkHttp',
    category: 'sdk',
    classPrefixes: ['okhttp3', 'com.squareup.okhttp']
  },
  {
    id: 'retrofit',
    name: 'Retrofit',
    category: 'sdk',
    classPrefixes: ['retrofit2', 'com.squareup.retrofit2']
  },
  {
    id: 'glide',
    name: 'Glide',
    category: 'sdk',
    classPrefixes: ['com.bumptech.glide']
  },
  {
    id: 'picasso',
    name: 'Picasso',
    category: 'sdk',
    classPrefixes: ['com.squareup.picasso']
  },
  {
    id: 'gson',
    name: 'Gson',
    category: 'sdk',
    classPrefixes: ['com.google.gson']
  },
  {
    id: 'kotlinx-coroutines',
    name: 'Kotlin Coroutines',
    category: 'sdk',
    classPrefixes: ['kotlinx.coroutines']
  },
  {
    id: 'realm',
    name: 'Realm',
    category: 'sdk',
    classPrefixes: ['io.realm']
  },
  // ---- Pinning / anti-tamper (interesting to surface) ----
  {
    id: 'okhttp-cert-pinner',
    name: 'OkHttp CertificatePinner (in use)',
    category: 'sdk',
    classPrefixes: ['okhttp3.CertificatePinner']
  },
  {
    id: 'rootbeer',
    name: 'RootBeer (root detection)',
    category: 'sdk',
    classPrefixes: ['com.scottyab.rootbeer']
  },
  {
    id: 'safetynet',
    name: 'SafetyNet / Play Integrity',
    category: 'sdk',
    classPrefixes: ['com.google.android.gms.safetynet', 'com.google.android.play.integrity']
  },
  // ---- Payment processors (handle card / bank data) --------------------
  {
    id: 'stripe-android',
    name: 'Stripe Android SDK',
    category: 'payment',
    classPrefixes: ['com.stripe.android'],
    url: 'https://stripe.com/docs/payments/accept-a-payment?platform=android'
  },
  {
    id: 'paypal-android',
    name: 'PayPal Android SDK',
    category: 'payment',
    classPrefixes: ['com.paypal.android', 'com.paypal.checkout', 'com.paypal.pyplcheckout']
  },
  {
    id: 'square-in-app',
    name: 'Square In-App Payments SDK',
    category: 'payment',
    classPrefixes: ['com.squareup.sdk.in_app_payments']
  },
  {
    id: 'plaid',
    name: 'Plaid Link',
    category: 'payment',
    classPrefixes: ['com.plaid'],
    url: 'https://plaid.com/docs/link/android'
  },
  {
    id: 'braintree',
    name: 'Braintree Drop-in',
    category: 'payment',
    classPrefixes: ['com.braintreepayments']
  },
  // ---- Real-user monitoring / observability ----------------------------
  {
    id: 'datadog-android',
    name: 'Datadog Android RUM',
    category: 'monitoring',
    classPrefixes: ['com.datadog.android'],
    url: 'https://docs.datadoghq.com/real_user_monitoring/android'
  },
  {
    id: 'logrocket',
    name: 'LogRocket',
    category: 'session-replay',
    classPrefixes: ['io.logrocket']
  },
  {
    id: 'smartlook',
    name: 'Smartlook',
    category: 'session-replay',
    classPrefixes: ['com.smartlook'],
    url: 'https://www.smartlook.com'
  },
  {
    id: 'fullstory',
    name: 'FullStory',
    category: 'session-replay',
    classPrefixes: ['com.fullstory']
  },
  {
    id: 'tealium',
    name: 'Tealium',
    category: 'analytics',
    classPrefixes: ['com.tealium']
  },
  {
    id: 'mparticle',
    name: 'mParticle',
    category: 'analytics',
    classPrefixes: ['com.mparticle']
  },
  // ---- Customer support / chat -----------------------------------------
  {
    id: 'zendesk-support',
    name: 'Zendesk Support SDK',
    category: 'support',
    classPrefixes: ['com.zendesk', 'zendesk.support']
  },
  {
    id: 'helpshift',
    name: 'Helpshift',
    category: 'support',
    classPrefixes: ['com.helpshift']
  },
  {
    id: 'intercom',
    name: 'Intercom',
    category: 'support',
    classPrefixes: ['io.intercom.android']
  },
  // ---- Identity / auth providers ---------------------------------------
  {
    id: 'auth0',
    name: 'Auth0',
    category: 'sdk',
    classPrefixes: ['com.auth0.android']
  },
  {
    id: 'okta-oidc',
    name: 'Okta OIDC',
    category: 'sdk',
    classPrefixes: ['com.okta.oidc', 'com.okta.authn']
  }
]

/**
 * Scan a list of class descriptors (e.g. from DEX strings: `Lcom/foo/Bar;`)
 * and return the trackers whose package prefixes match. Each tracker
 * fires once regardless of how many classes match.
 */
export function detectTrackers(classDescriptors: string[]): TrackerFinding[] {
  // Pre-process: convert `Lcom/foo/Bar;` → `com.foo.Bar`.
  const pkgs = new Set<string>()
  for (const s of classDescriptors) {
    if (!s.startsWith('L') || !s.endsWith(';')) continue
    pkgs.add(s.slice(1, -1).replace(/\//g, '.'))
  }
  const matched: TrackerFinding[] = []
  for (const entry of TRACKER_DB) {
    let hits = 0
    for (const prefix of entry.classPrefixes) {
      for (const pkg of pkgs) {
        if (pkg === prefix || pkg.startsWith(prefix + '.')) {
          hits++
          if (hits > 1) break
        }
      }
      if (hits > 1) break
    }
    if (hits > 0) {
      matched.push({
        id: entry.id,
        name: entry.name,
        category: entry.category,
        url: entry.url ?? null
      })
    }
  }
  matched.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
  return matched
}
