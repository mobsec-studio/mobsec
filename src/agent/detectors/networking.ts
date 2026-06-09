/**
 * Networking-stack detector.
 *
 * We deliberately only report *app-bundled* clients (OkHttp, Retrofit,
 * Volley, Cronet, Ktor…). The platform's HttpURLConnection and
 * `com.android.okhttp` are present in every process, so reporting them
 * would be pure noise — their actual use is a runtime/tracer concern, not
 * a recon-snapshot one.
 */

import type { Detector } from '../core/registry'
import type { ReconContext } from '../core/context'
import type { ReportBuilder } from '../core/report'
import { safeOr } from '../core/safe'

interface NetSig {
  id: string
  label: string
  /** A marker class that is only present when the app bundles this lib. */
  marker: string
  evidence: string
}

const SIGNATURES: NetSig[] = [
  { id: 'okhttp3', label: 'OkHttp 3/4', marker: 'okhttp3.OkHttpClient', evidence: 'okhttp3.OkHttpClient' },
  { id: 'okhttp2', label: 'OkHttp 2 (legacy)', marker: 'com.squareup.okhttp.OkHttpClient', evidence: 'com.squareup.okhttp.OkHttpClient' },
  { id: 'retrofit', label: 'Retrofit', marker: 'retrofit2.Retrofit', evidence: 'retrofit2.Retrofit' },
  { id: 'volley', label: 'Volley', marker: 'com.android.volley.RequestQueue', evidence: 'com.android.volley.RequestQueue' },
  { id: 'ktor', label: 'Ktor Client', marker: 'io.ktor.client.HttpClient', evidence: 'io.ktor.client.HttpClient' },
  { id: 'cronet', label: 'Cronet (Chromium net)', marker: 'org.chromium.net.CronetEngine', evidence: 'org.chromium.net.CronetEngine' },
  { id: 'apache-http', label: 'Apache HttpClient (legacy)', marker: 'org.apache.http.impl.client.DefaultHttpClient', evidence: 'org.apache.http.impl.client.DefaultHttpClient' },
  { id: 'apollo', label: 'Apollo GraphQL', marker: 'com.apollographql.apollo3.ApolloClient', evidence: 'com.apollographql.apollo3.ApolloClient' },
  { id: 'fast-android-networking', label: 'Fast Android Networking', marker: 'com.androidnetworking.AndroidNetworking', evidence: 'com.androidnetworking.AndroidNetworking' }
]

function okhttpVersion(ctx: ReconContext): string | null {
  return safeOr<string | null>(null, () => {
    const V = ctx.useClass('okhttp3.OkHttp')
    if (!V) return null
    const version = V.VERSION.value as string
    return version && version.length > 0 ? version : null
  })
}

export const networkingDetector: Detector = {
  id: 'networking',
  detect(ctx: ReconContext, out: ReportBuilder): void {
    for (const sig of SIGNATURES) {
      if (!ctx.hasClass(sig.marker)) continue
      out.addNetworking({
        id: sig.id,
        label: sig.label,
        version: sig.id === 'okhttp3' ? okhttpVersion(ctx) : null,
        evidence: [sig.evidence]
      })
    }

    // gRPC is a meaningful transport signal of its own.
    if (ctx.hasClass('io.grpc.ManagedChannel') || ctx.hasModule('libgrpc')) {
      out.addNetworking({
        id: 'grpc',
        label: 'gRPC',
        version: null,
        evidence: ['io.grpc.* / libgrpc present']
      })
    }
  }
}
