import type { SecurityFinding } from '@shared/types'
import type { ParsedManifest } from './manifest'

/**
 * Static security checks driven by the parsed AndroidManifest plus a
 * lightweight scan of decompiled-or-DEX strings (for crypto / WebView
 * misconfig heuristics). Each finding has an actionable remediation
 * note — the goal is to teach as well as warn.
 *
 * Designing checks this way (one function per check, return an array)
 * lets us cheaply add more without spaghetti — the orchestrator just
 * concatenates results from every checker.
 */

export interface CodeCorpus {
  /** Every string we have for this APK — DEX strings, resources, maybe
   *  decompiled Java text. Used to grep for SDK calls. */
  lines: string[]
}

export function runSecurityChecks(
  manifest: ParsedManifest,
  code: CodeCorpus
): SecurityFinding[] {
  const findings: SecurityFinding[] = []
  push(findings, checkDebuggable(manifest))
  push(findings, checkAllowBackup(manifest))
  push(findings, checkCleartextTraffic(manifest))
  push(findings, checkTestOnly(manifest))
  push(findings, checkNetworkSecurityConfig(manifest))
  push(findings, checkExportedComponents(manifest))
  push(findings, checkProviderExports(manifest))
  push(findings, checkDangerousPermissions(manifest))
  push(findings, checkCustomPermissionProtection(manifest))
  push(findings, checkWebViewMisconfig(code))
  push(findings, checkInsecureCrypto(code))
  push(findings, checkInsecureRandomness(code))
  push(findings, checkRootDetectionAbsence(code))
  push(findings, checkLogcatLeaks(code))
  push(findings, checkScreenshotsAllowed(code))
  push(findings, checkWebViewDebugging(code))
  push(findings, checkInsecurePendingIntent(code))
  push(findings, checkRawSqlInjection(code))
  push(findings, checkHardcodedIv(code))
  push(findings, checkEmptyTrustManager(code))
  push(findings, checkDynamicCodeLoading(code))
  push(findings, checkRuntimeExecVariable(code))
  push(findings, checkAppLinksAutoVerify(manifest))
  push(findings, checkTapjackingExposure(code))
  push(findings, checkInsecureDeserialization(code))
  push(findings, checkEmbeddedAdminCredentials(code))
  return findings.sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
}

function push(target: SecurityFinding[], next: SecurityFinding[] | SecurityFinding | null): void {
  if (!next) return
  if (Array.isArray(next)) target.push(...next)
  else target.push(next)
}

function checkDebuggable(m: ParsedManifest): SecurityFinding | null {
  if (!m.application.debuggable) return null
  return {
    id: 'debuggable',
    title: 'Application is debuggable',
    severity: 'high',
    detail:
      'android:debuggable="true" lets any app on the device attach jdb/jdwp and read memory. Production builds should never ship with this set.',
    remediation:
      'Remove `android:debuggable` from the <application> element (or set it to false). Most build tools default to false for release builds.'
  }
}

function checkAllowBackup(m: ParsedManifest): SecurityFinding | null {
  if (!m.application.allowBackup) return null
  return {
    id: 'allow-backup',
    title: 'Backup allowed (android:allowBackup="true")',
    severity: 'medium',
    detail:
      "An adb-attached attacker can `adb backup` the app's private data (databases, shared prefs, files). Defaults to true unless explicitly set false.",
    remediation:
      'Set android:allowBackup="false" on <application>, or define an `android:fullBackupContent` rule that excludes sensitive paths.'
  }
}

function checkCleartextTraffic(m: ParsedManifest): SecurityFinding | null {
  const target = m.targetSdk
  const cleartext = m.application.usesCleartextTraffic
  // Android 9+ (target 28+) defaults to false. Older targets default to
  // true, which is itself worth surfacing.
  if (cleartext === true) {
    return {
      id: 'cleartext-true',
      title: 'Cleartext HTTP traffic explicitly enabled',
      severity: 'high',
      detail:
        'android:usesCleartextTraffic="true" lets the app open plain http:// connections. Anyone on the same WiFi can observe and tamper with traffic.',
      remediation:
        'Set usesCleartextTraffic="false" (or omit it) and pair with a Network Security Config that allows specific dev hosts if needed.'
    }
  }
  if (cleartext == null && target < 28) {
    return {
      id: 'cleartext-default',
      title: 'Pre-Android-9 target — cleartext defaults to allowed',
      severity: 'low',
      detail: `targetSdk=${target} predates the Android 9 default of forbidding cleartext. Older apps allow plain HTTP unless they opt in to forbid it.`,
      remediation:
        'Bump targetSdkVersion to 28+ and explicitly disable cleartext via Network Security Config.'
    }
  }
  return null
}

function checkTestOnly(m: ParsedManifest): SecurityFinding | null {
  if (!m.application.testOnly) return null
  return {
    id: 'test-only',
    title: 'android:testOnly="true"',
    severity: 'medium',
    detail:
      "testOnly apps skip several runtime safety checks and aren't installable from the Play Store. Common in misconfigured CI artifacts.",
    remediation: 'Remove `android:testOnly` from <application> before publishing.'
  }
}

function checkNetworkSecurityConfig(m: ParsedManifest): SecurityFinding | null {
  if (!m.application.networkSecurityConfigRef) {
    return {
      id: 'nsc-missing',
      title: 'No Network Security Config declared',
      severity: 'info',
      detail:
        'The app uses the platform default trust rules. That is usually safe on modern targets but means user-store CAs are NOT trusted — handy to know for MitM testing.',
      remediation:
        'Add `android:networkSecurityConfig="@xml/network_security_config"` and a config xml to whitelist dev MitM CAs when needed.'
    }
  }
  return null
}

function checkExportedComponents(m: ParsedManifest): SecurityFinding[] {
  const findings: SecurityFinding[] = []
  const all = [
    ...m.components.activities,
    ...m.components.services,
    ...m.components.receivers
  ]
  for (const c of all) {
    if (!c.exported) continue
    if (c.permission) continue // protected — fine
    // Anything exported with no permission and no signature-protection
    // gate is reachable by any installed app via Intent.
    findings.push({
      id: `exported:${c.name}`,
      title: `${c.name} is exported without a permission gate`,
      severity: 'medium',
      detail:
        'Any installed app can send Intents to this component. If the component performs sensitive actions (writes data, dispatches account flows, etc.) it can be hijacked.',
      remediation:
        'Either set android:exported="false" or add android:permission with a signature-level permission you control.'
    })
  }
  return findings
}

function checkProviderExports(m: ParsedManifest): SecurityFinding[] {
  const findings: SecurityFinding[] = []
  for (const p of m.components.providers) {
    if (!p.exported) continue
    if (p.permission) continue
    findings.push({
      id: `provider-exported:${p.name}`,
      title: `Provider ${p.name} is exported without read/write permissions`,
      severity: 'high',
      detail: `Authority "${p.authorities ?? '?'}" is queryable by any app. Providers often expose database rows or files; uncontrolled exports lead to data leak (CVE-2018-9489 class of bugs).`,
      remediation:
        'Set android:exported="false" or restrict with android:readPermission / android:writePermission. If the provider must be cross-app, use a signature permission.'
    })
  }
  return findings
}

const DANGEROUS_PERMS = new Set([
  'android.permission.READ_CONTACTS',
  'android.permission.WRITE_CONTACTS',
  'android.permission.READ_SMS',
  'android.permission.SEND_SMS',
  'android.permission.READ_CALL_LOG',
  'android.permission.WRITE_CALL_LOG',
  'android.permission.PROCESS_OUTGOING_CALLS',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.MANAGE_EXTERNAL_STORAGE',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_BACKGROUND_LOCATION',
  'android.permission.CAMERA',
  'android.permission.RECORD_AUDIO',
  'android.permission.READ_PHONE_STATE',
  'android.permission.READ_PHONE_NUMBERS',
  'android.permission.CALL_PHONE',
  'android.permission.GET_ACCOUNTS',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.QUERY_ALL_PACKAGES',
  'android.permission.BIND_ACCESSIBILITY_SERVICE',
  'android.permission.BIND_DEVICE_ADMIN'
])

function checkDangerousPermissions(m: ParsedManifest): SecurityFinding | null {
  const dangerous = m.permissions.filter((p) => DANGEROUS_PERMS.has(p))
  if (dangerous.length === 0) return null
  return {
    id: 'dangerous-perms',
    title: `${dangerous.length} dangerous permissions requested`,
    severity: 'info',
    detail: `Includes: ${dangerous.slice(0, 6).join(', ')}${dangerous.length > 6 ? ', …' : ''}.`,
    remediation:
      'Audit whether each runtime-prompted permission is truly needed. Excessive permissions are a red flag in code review.'
  }
}

function checkCustomPermissionProtection(m: ParsedManifest): SecurityFinding[] {
  const findings: SecurityFinding[] = []
  for (const dp of m.declaredPermissions) {
    const level = (dp.protectionLevel ?? 'normal').toLowerCase()
    if (level === 'normal' || level === 'dangerous') {
      findings.push({
        id: `custom-perm:${dp.name}`,
        title: `Custom permission ${dp.name} uses protectionLevel="${level}"`,
        severity: 'medium',
        detail:
          'Normal/dangerous permissions can be requested by any app. If used to gate sensitive exports, the gate is effectively unprotected.',
        remediation:
          'Use `signature` (or `signature|privileged`) so only apps signed by your own cert can be granted the permission.'
      })
    }
  }
  return findings
}

function checkWebViewMisconfig(code: CodeCorpus): SecurityFinding[] {
  const findings: SecurityFinding[] = []
  const joined = code.lines
  if (containsAny(joined, ['setJavaScriptEnabled(true)', '.setJavaScriptEnabled(true)'])) {
    findings.push({
      id: 'webview-js',
      title: 'WebView with JavaScript enabled',
      severity: 'info',
      detail:
        "setJavaScriptEnabled(true) by itself isn't a vuln, but it raises the impact of XSS in any content the WebView loads — review URL sources.",
      remediation:
        'Disable JS where you can. Where you can\'t, validate the URLs you load and never load attacker-controllable HTML.'
    })
  }
  if (containsAny(joined, ['addJavascriptInterface('])) {
    findings.push({
      id: 'webview-jsi',
      title: 'WebView.addJavascriptInterface used',
      severity: 'high',
      detail:
        'Pre-API-17 this leaked full Java reflection to JS. Even on modern Android, exposing native methods to web content creates a privilege bridge for any compromise of the page.',
      remediation:
        'Only expose explicit @JavascriptInterface methods on API 17+. Never expose methods that touch the file system, run shell, or return reflection objects.'
    })
  }
  if (containsAny(joined, ['setAllowUniversalAccessFromFileURLs(true)'])) {
    findings.push({
      id: 'webview-univaccess',
      title: 'WebView grants universal access from file:// URLs',
      severity: 'high',
      detail:
        'allowUniversalAccessFromFileURLs lets local-file pages issue cross-origin requests. Combined with file:// content this leaks any URL contents reachable from the device.',
      remediation: 'Set it to false (default) and avoid loading file:// content unless absolutely necessary.'
    })
  }
  if (containsAny(joined, ['setAllowFileAccessFromFileURLs(true)'])) {
    findings.push({
      id: 'webview-fileaccess',
      title: 'WebView allows file://-to-file:// reads',
      severity: 'medium',
      detail:
        'A malicious local HTML can read other local files via XHR. Less severe than universal access but still violates same-origin.',
      remediation: 'Leave at default (false) and confine local content to res/raw or assets/.'
    })
  }
  if (containsAny(joined, ['onReceivedSslError', 'sslErrorHandler.proceed'])) {
    findings.push({
      id: 'webview-ssl-proceed',
      title: 'WebView ignores SSL errors',
      severity: 'high',
      detail:
        'Calling sslErrorHandler.proceed() in onReceivedSslError disables TLS verification for the WebView — an attacker on the network can MitM every load.',
      remediation:
        'Never call handler.proceed() unconditionally. Pin via Network Security Config or verify cert chains manually.'
    })
  }
  return findings
}

function checkInsecureCrypto(code: CodeCorpus): SecurityFinding[] {
  const findings: SecurityFinding[] = []
  if (containsAny(code.lines, ['Cipher.getInstance("DES', 'Cipher.getInstance("RC4', 'Cipher.getInstance(\'DES'])) {
    findings.push({
      id: 'crypto-weak',
      title: 'Weak cipher used (DES/RC4)',
      severity: 'high',
      detail: 'DES is 56-bit; RC4 has known biases. Both are forbidden by modern TLS too — neither is acceptable for new code.',
      remediation: 'Switch to AES-GCM with a 256-bit key (or ChaCha20-Poly1305).'
    })
  }
  if (containsAny(code.lines, ['/ECB', 'AES/ECB', '"ECB"'])) {
    findings.push({
      id: 'crypto-ecb',
      title: 'AES used in ECB mode',
      severity: 'high',
      detail: 'ECB is deterministic per-block — leaks structure of plaintext. The "Tux penguin" demo applies.',
      remediation: 'Use AES-GCM (authenticated) or AES-CTR/CBC with a unique IV per message + HMAC for integrity.'
    })
  }
  if (containsAny(code.lines, ['MessageDigest.getInstance("MD5"', 'MessageDigest.getInstance("SHA-1"'])) {
    findings.push({
      id: 'crypto-hash',
      title: 'Broken hash used (MD5/SHA-1)',
      severity: 'medium',
      detail: 'Both are collision-broken. Acceptable for legacy checksums only.',
      remediation: 'Use SHA-256 or SHA-3 for any security-sensitive hashing.'
    })
  }
  return findings
}

function checkInsecureRandomness(code: CodeCorpus): SecurityFinding | null {
  // `Math.random()` or `java.util.Random()` for crypto/IDs.
  if (
    containsAny(code.lines, [
      'new Random()',
      'new java.util.Random(',
      'Math.random()'
    ])
  ) {
    return {
      id: 'insecure-random',
      title: 'Non-cryptographic randomness used',
      severity: 'low',
      detail:
        'java.util.Random and Math.random use a 48-bit LCG seeded from System.nanoTime — predictable. Acceptable for UI animation seeds; never for tokens, salts, or keys.',
      remediation: 'Use java.security.SecureRandom (or kotlin.random.Random.Default → SecureRandom on Android).'
    }
  }
  return null
}

function checkRootDetectionAbsence(code: CodeCorpus): SecurityFinding | null {
  // Heuristic: if the app handles payments / financial flows AND has no
  // visible root-detection strings, surface as info.
  const looksFinancial = containsAny(code.lines, [
    'BillingClient',
    'paypal',
    'stripe',
    'BankAccount',
    'PaymentRequest'
  ])
  const hasRootDetect = containsAny(code.lines, [
    '/system/bin/su',
    'RootBeer',
    'isDeviceRooted',
    '/data/adb/magisk'
  ])
  if (looksFinancial && !hasRootDetect) {
    return {
      id: 'no-root-detect',
      title: 'Financial app with no apparent root detection',
      severity: 'info',
      detail:
        'Payment SDKs and banking flows were detected but no root-detection strings turned up. Adversaries can mod the app freely on a rooted device.',
      remediation:
        'Layer multiple root checks (RootBeer + your own) AND attestation (Play Integrity) — defense in depth.'
    }
  }
  return null
}

function checkLogcatLeaks(code: CodeCorpus): SecurityFinding | null {
  // Tagged logs of "token", "password", "secret" appearing near Log.*
  const matches = code.lines.filter((l) =>
    /\bLog\.(?:v|d|i|w|e)\([^)]*(?:token|password|secret|api[_-]?key)/i.test(l)
  )
  if (matches.length === 0) return null
  return {
    id: 'logcat-leak',
    title: 'Sensitive data logged to logcat',
    severity: 'medium',
    detail: `${matches.length} Log.* call(s) reference token/password/secret/apiKey. Any app or attached debugger can scrape logcat.`,
    remediation:
      'Strip logging in release builds via ProGuard rules or a logging wrapper that no-ops in BuildConfig.RELEASE.'
  }
}

function checkScreenshotsAllowed(code: CodeCorpus): SecurityFinding | null {
  // FLAG_SECURE blocks screen captures and obscures app from the recents
  // overview. Sensitive screens that omit it leak via screenshots and
  // accessibility services.
  const hasFlagSecure = containsAny(code.lines, ['FLAG_SECURE'])
  if (hasFlagSecure) return null
  return {
    id: 'flag-secure-missing',
    title: 'No FLAG_SECURE detected in code',
    severity: 'info',
    detail:
      'Screens without WindowManager.LayoutParams.FLAG_SECURE can be screenshotted and appear in the Recents thumbnail. Sensitive UIs should set it.',
    remediation:
      "Add `getWindow().setFlags(FLAG_SECURE, FLAG_SECURE)` on Activities that show secrets/PII."
  }
}

function checkWebViewDebugging(code: CodeCorpus): SecurityFinding | null {
  // setWebContentsDebuggingEnabled(true) opens the WebView to
  // chrome://inspect from any USB-debuggable host. On a release build
  // that's a remote-debugging backdoor.
  if (!containsAny(code.lines, ['setWebContentsDebuggingEnabled(true)'])) return null
  return {
    id: 'webview-debugging',
    title: 'WebView remote debugging enabled',
    severity: 'medium',
    detail:
      'WebView.setWebContentsDebuggingEnabled(true) was found in code. Production builds expose the WebView to chrome://inspect over USB — useful for testing, bad if shipped.',
    remediation:
      'Gate the call behind BuildConfig.DEBUG so it only runs in debug builds.'
  }
}

function checkInsecurePendingIntent(code: CodeCorpus): SecurityFinding | null {
  // Android 12 (API 31) requires PendingIntent flags to specify either
  // FLAG_IMMUTABLE or FLAG_MUTABLE explicitly. Apps that pick
  // FLAG_MUTABLE without a strong reason expose the intent to tampering
  // by malicious recipients (the canonical "intent redirection" CVE).
  if (!containsAny(code.lines, ['FLAG_MUTABLE', 'PendingIntent.FLAG_MUTABLE'])) return null
  return {
    id: 'pending-intent-mutable',
    title: 'PendingIntent created with FLAG_MUTABLE',
    severity: 'medium',
    detail:
      'PendingIntent.FLAG_MUTABLE lets the receiving app rewrite the intent before delivery. Used recklessly this becomes intent-redirection (CVE-2022-20454 class).',
    remediation:
      'Switch to FLAG_IMMUTABLE unless the receiving app genuinely needs to inject extras. When mutable is required, pair it with a hard-coded target package/component.'
  }
}

function checkRawSqlInjection(code: CodeCorpus): SecurityFinding | null {
  // Heuristic: rawQuery or execSQL where the argument is built with
  // string concatenation (+) instead of bound parameters. Apps that
  // use the bind form (?, args[]) are safe; the + form is the smell.
  const culprits = code.lines.filter((l) =>
    /(?:rawQuery|execSQL)\s*\(\s*["'][^"']*"\s*\+|(?:rawQuery|execSQL)\s*\(\s*[A-Za-z_][A-Za-z0-9_]*\s*\+/.test(l)
  )
  if (culprits.length === 0) return null
  return {
    id: 'sql-injection',
    title: 'Possible SQL injection via raw query',
    severity: 'high',
    detail: `${culprits.length} call(s) to rawQuery/execSQL build the SQL string via concatenation. If any of the concatenated values comes from user input, this is exploitable.`,
    remediation:
      'Use the parameterized form: rawQuery("SELECT ... WHERE col = ?", new String[]{userInput}).'
  }
}

function checkHardcodedIv(code: CodeCorpus): SecurityFinding | null {
  // IvParameterSpec(new byte[16]) or IvParameterSpec(new byte[16] {0,0,...})
  // means every encryption uses the same IV — fatal for CBC/CTR.
  const patterns = [
    'IvParameterSpec(new byte[',
    'new IvParameterSpec(new byte[]'
  ]
  if (!containsAny(code.lines, patterns)) return null
  return {
    id: 'crypto-fixed-iv',
    title: 'IV constructed from a zero / fixed byte array',
    severity: 'high',
    detail:
      'A literal byte[] passed straight into IvParameterSpec is almost always zero-filled. Re-using an IV across messages breaks AES-CBC/CTR (nonce reuse → recoverable plaintext + key relationships).',
    remediation:
      'Generate a fresh random IV per message via SecureRandom and prepend it to the ciphertext for the receiver to use. Prefer AES-GCM, which fails closed on IV reuse.'
  }
}

function checkEmptyTrustManager(code: CodeCorpus): SecurityFinding | null {
  // Look for an X509TrustManager whose checkServerTrusted is empty.
  // Heuristic: an implementation file that has `checkServerTrusted` AND
  // `X509Certificate[]` AND no `throw` between them within 4 lines.
  let found = false
  const lines = code.lines
  for (let i = 0; i < lines.length; i++) {
    if (!/checkServerTrusted/.test(lines[i]!)) continue
    if (!/X509Certificate/.test(lines[i]!) && !(i > 0 && /X509Certificate/.test(lines[i - 1]!))) continue
    // Window the next 6 lines — that's the method body for a trivial empty stub.
    const window = lines.slice(i, i + 6).join('\n')
    if (!/throw|CertificateException/.test(window)) {
      found = true
      break
    }
  }
  if (!found) return null
  return {
    id: 'empty-trust-manager',
    title: 'Empty X509TrustManager.checkServerTrusted',
    severity: 'critical',
    detail:
      'An X509TrustManager implementation has a no-op checkServerTrusted, meaning the app accepts ANY server certificate. Every TLS connection is exploitable by any on-path attacker.',
    remediation:
      "Validate the certificate chain — or, better, remove the custom trust manager and rely on the system trust store. If you need pinning, do it with OkHttp's CertificatePinner."
  }
}

function checkDynamicCodeLoading(code: CodeCorpus): SecurityFinding | null {
  // DexClassLoader / PathClassLoader / InMemoryDexClassLoader loading
  // bytecode at runtime is the canonical "we shipped one APK, then
  // downloaded the real one" vector — also a sandbox-escape primitive
  // when the loaded code path isn't pinned.
  if (
    !containsAny(code.lines, [
      'DexClassLoader',
      'PathClassLoader',
      'InMemoryDexClassLoader',
      'BaseDexClassLoader'
    ])
  ) {
    return null
  }
  return {
    id: 'dynamic-code-loading',
    title: 'Dynamic DEX class loading detected',
    severity: 'medium',
    detail:
      'The app loads DEX bytecode at runtime via DexClassLoader / PathClassLoader. Confirm the source is authenticated (signature check on the loaded jar/dex), or any rogue code dropped into the load path executes with the app\'s permissions.',
    remediation:
      'Pin the loaded artefact\'s SHA-256 inside the app, verify before instantiating the class loader, and prefer to ship every code path in the main DEX.'
  }
}

function checkRuntimeExecVariable(code: CodeCorpus): SecurityFinding | null {
  // Runtime.exec(stringVariable) — any chance the variable is user-
  // controlled is straight-up command injection. The legitimate-looking
  // pattern is Runtime.exec(new String[]{ "cmd", arg }) with hardcoded
  // first arg; we flag the single-arg form when its operand isn't a
  // string literal.
  const culprits = code.lines.filter((l) =>
    /Runtime\.[A-Za-z]+\(\)\.exec\(\s*[A-Za-z_][A-Za-z0-9_]*\s*\)/.test(l) &&
    !/Runtime\.[A-Za-z]+\(\)\.exec\(\s*"[^"]*"\s*\)/.test(l)
  )
  if (culprits.length === 0) return null
  return {
    id: 'runtime-exec-variable',
    title: 'Runtime.exec called with a variable argument',
    severity: 'high',
    detail: `${culprits.length} call(s) to Runtime.exec pass a variable instead of a constant. Combined with any user-controlled input this becomes RCE inside the app sandbox.`,
    remediation:
      'Use the explicit-argv form (Runtime.exec(new String[]{cmd, arg1, ...})). Never assemble a shell command from concatenated user input.'
  }
}

function checkAppLinksAutoVerify(m: ParsedManifest): SecurityFinding | null {
  // For Android App Links (the user-trusted https deep-link surface),
  // Android requires `android:autoVerify="true"` on the intent-filter
  // AND a /.well-known/assetlinks.json on the target host. Without
  // autoVerify, a malicious app can register the same deep link and
  // hijack the user.
  const httpsFilters = m.components.activities
    .flatMap((a) => a.intentFilters)
    .filter((f) => f.schemes.includes('https') || f.schemes.includes('http'))
  if (httpsFilters.length === 0) return null
  // We don't have autoVerify in our ParsedManifest yet (raw filter
  // doesn't expose it), so the best we can do is *count* https deep
  // links and warn if any are present — the user can then go check.
  return {
    id: 'app-links-verify',
    title: `${httpsFilters.length} HTTPS deep-link filter(s) — verify autoVerify is set`,
    severity: 'info',
    detail:
      'HTTPS deep links should set android:autoVerify="true" on the intent-filter so a Digital Asset Links file at /.well-known/assetlinks.json gates the binding. Without it, any app can register the same URL and steal the user.',
    remediation:
      'Add autoVerify="true" and publish /.well-known/assetlinks.json on every host in the filter. Use `adb shell pm verify-app-links --re-verify <pkg>` to test.'
  }
}

function checkTapjackingExposure(code: CodeCorpus): SecurityFinding | null {
  // Sensitive activities (auth, payments) should call
  // setFilterTouchesWhenObscured(true) so an overlay (drawn via
  // SYSTEM_ALERT_WINDOW) can't capture taps. If the code never sets
  // this attribute at all, it's worth surfacing.
  if (containsAny(code.lines, ['setFilterTouchesWhenObscured', 'filterTouchesWhenObscured="true"'])) {
    return null
  }
  // Only worth surfacing for apps that take user input or money — heuristic:
  // contains LoginActivity / PaymentActivity / SignIn / Checkout strings.
  const looksSensitive = code.lines.some((l) =>
    /Login|Payment|Checkout|SignIn|Password|TwoFactor/i.test(l)
  )
  if (!looksSensitive) return null
  return {
    id: 'tapjacking-exposure',
    title: 'No filterTouchesWhenObscured on sensitive screens',
    severity: 'info',
    detail:
      'Login/payment-style screens were detected but no filterTouchesWhenObscured guard was found. An app with SYSTEM_ALERT_WINDOW can draw an overlay and harvest taps on the screen below.',
    remediation:
      'Set android:filterTouchesWhenObscured="true" on the root layout of every sensitive Activity, or call view.setFilterTouchesWhenObscured(true) at runtime.'
  }
}

function checkInsecureDeserialization(code: CodeCorpus): SecurityFinding | null {
  // ObjectInputStream over an untrusted source is the canonical Java
  // deserialization RCE. The smell is `ObjectInputStream(getInputStream())`
  // or `ObjectInputStream(buffer)` without a class allow-list.
  const hasOis = containsAny(code.lines, ['ObjectInputStream', 'XStream', 'SnakeYaml'])
  const hasAllowList = containsAny(code.lines, ['ObjectInputFilter', 'resolveClass', 'addAllowed'])
  if (!hasOis || hasAllowList) return null
  return {
    id: 'insecure-deserialization',
    title: 'Object deserialization without an allow-list',
    severity: 'high',
    detail:
      'ObjectInputStream (or XStream / SnakeYAML) is used but no ObjectInputFilter / resolveClass override / explicit allow-list was found. If any deserialized data comes from outside the app, this is a remote-code-execution primitive.',
    remediation:
      'Use ObjectInputFilter / setObjectInputFilter to restrict acceptable classes, or switch to a non-serialization data format like Protobuf or JSON.'
  }
}

function checkEmbeddedAdminCredentials(code: CodeCorpus): SecurityFinding | null {
  // Look for hardcoded credential pairs commonly left behind in
  // demos: admin/admin, root/root, test/test, password=password, etc.
  const patterns = [
    /["']admin["']\s*[,)].*["']admin["']/,
    /["']root["']\s*[,)].*["']root["']/,
    /["']test["']\s*[,)].*["']test["']/,
    /password\s*[=:]\s*["']password["']/i,
    /password\s*[=:]\s*["']123456["']/i,
    /password\s*[=:]\s*["']12345678["']/i,
    /password\s*[=:]\s*["']qwerty["']/i
  ]
  for (const line of code.lines) {
    for (const p of patterns) {
      if (p.test(line)) {
        return {
          id: 'admin-credentials',
          title: 'Hardcoded test / admin credentials',
          severity: 'medium',
          detail:
            'A literal credential pair from the "obvious defaults" set (admin/admin, root/root, password=password, etc.) was found in code. Probably dev / demo leftovers, but production-shipped versions are immediate access.',
          remediation:
            'Remove the defaults. If the app needs a backend secret, fetch it at runtime over an authenticated channel — never bake credentials into the APK.'
        }
      }
    }
  }
  return null
}

function containsAny(lines: string[], needles: string[]): boolean {
  for (const l of lines) {
    for (const n of needles) {
      if (l.indexOf(n) !== -1) return true
    }
  }
  return false
}

function severityRank(s: string): number {
  return { critical: 0, high: 1, medium: 2, low: 3, info: 4 }[s] ?? 5
}
