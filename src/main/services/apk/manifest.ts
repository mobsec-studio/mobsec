import { attr, findAllElements, findElement, parseAxml, type AxmlElement } from './axml'

/**
 * Walk a decoded AXML AndroidManifest tree and pull out everything the
 * rest of the analyzer cares about. We deliberately surface a STRUCTURED
 * view — not just a string blob — so security checks and the UI can
 * reason about exported components, deep links, NSC references, etc.
 *
 * The shapes here are not in shared/types.ts because they're internal to
 * the analyzer; the analyzer flattens findings into the renderer-facing
 * `ApkAnalysisSummary`.
 */

export interface ParsedManifest {
  packageName: string
  versionName: string
  versionCode: number
  minSdk: number
  targetSdk: number
  maxSdk: number | null
  /** Application-level flags relevant to security posture. */
  application: {
    label: string | null
    debuggable: boolean
    allowBackup: boolean
    usesCleartextTraffic: boolean | null
    /** Reference to `res/xml/<network_security_config>.xml`, when set. */
    networkSecurityConfigRef: string | null
    testOnly: boolean
    extractNativeLibs: boolean | null
    /** Reference to `res/xml/<file_provider_paths>.xml` etc. */
    backupContentRef: string | null
  }
  /** Every declared permission used by the app. Categorization happens
   *  later via the canonical Android list. */
  permissions: string[]
  /** Permissions the app DEFINES (custom permissions other apps can
   *  request). Listing these helps spot under-protected exports. */
  declaredPermissions: { name: string; protectionLevel: string | null }[]
  components: {
    activities: ParsedComponent[]
    services: ParsedComponent[]
    receivers: ParsedComponent[]
    providers: ParsedComponent[]
  }
  /** Every URI a deep link binds to — host + path patterns flattened
   *  into a single list so users can craft `adb intent` tests. */
  deepLinks: DeepLinkEntry[]
  /** Original parsed AXML root so callers can render the raw tree. */
  raw: AxmlElement | null
  /** Pretty-printed XML for the Manifest tab. */
  prettyXml: string
}

export interface ParsedComponent {
  name: string
  /** True if `android:exported="true"` is set, OR if it has an intent
   *  filter and `exported` is unset (Android <12 default). For >=12 the
   *  default is false but we treat unset+filter as effectively exported
   *  for security review purposes. */
  exported: boolean
  /** Whether `android:exported` was explicitly set in the manifest. */
  exportedExplicit: boolean
  permission: string | null
  intentFilters: {
    actions: string[]
    categories: string[]
    schemes: string[]
    hosts: string[]
    paths: string[]
    mimeTypes: string[]
  }[]
  /** Provider-only: declared authorities. */
  authorities: string | null
}

export interface DeepLinkEntry {
  component: string
  scheme: string
  host: string | null
  path: string | null
  /** Reconstructed example URI, e.g. `https://example.com/foo`. */
  example: string
}

export function parseManifest(axmlBuffer: Buffer): ParsedManifest {
  const doc = parseAxml(axmlBuffer)
  const root = doc.root
  if (!root || root.name !== 'manifest') {
    throw new Error('AndroidManifest.xml: root element is not <manifest>')
  }

  const usesSdkEl = findElement(root, 'uses-sdk')
  const minSdk = Number.parseInt(attr(usesSdkEl, 'minSdkVersion') ?? '1', 10) || 1
  const targetSdk = Number.parseInt(attr(usesSdkEl, 'targetSdkVersion') ?? String(minSdk), 10) || minSdk
  const maxSdk = attr(usesSdkEl, 'maxSdkVersion')

  const appEl = findElement(root, 'application')

  const permissions = findAllElements(root, 'uses-permission')
    .map((el) => attr(el, 'name') ?? '')
    .filter(Boolean)
  // Some apps also use uses-permission-sdk-23 to gate runtime perms.
  for (const el of findAllElements(root, 'uses-permission-sdk-23')) {
    const name = attr(el, 'name')
    if (name && !permissions.includes(name)) permissions.push(name)
  }

  const declaredPermissions = findAllElements(root, 'permission').map((el) => ({
    name: attr(el, 'name') ?? '',
    protectionLevel: attr(el, 'protectionLevel') ?? null
  }))

  const activities = findAllElements(appEl ?? root, 'activity').map((el) =>
    parseComponent(el, targetSdk)
  )
  const aliasActivities = findAllElements(appEl ?? root, 'activity-alias').map((el) =>
    parseComponent(el, targetSdk)
  )
  const services = findAllElements(appEl ?? root, 'service').map((el) =>
    parseComponent(el, targetSdk)
  )
  const receivers = findAllElements(appEl ?? root, 'receiver').map((el) =>
    parseComponent(el, targetSdk)
  )
  const providers = findAllElements(appEl ?? root, 'provider').map((el) => {
    const c = parseComponent(el, targetSdk)
    c.authorities = attr(el, 'authorities') ?? null
    return c
  })

  const deepLinks: DeepLinkEntry[] = []
  for (const comp of [...activities, ...aliasActivities]) {
    for (const f of comp.intentFilters) {
      // A deep link is any filter that includes BROWSABLE category + a
      // scheme — same heuristic Android Studio uses. We still surface
      // non-BROWSABLE filters in the component table, just not here.
      const isDeepLink = f.categories.includes('android.intent.category.BROWSABLE')
      if (!isDeepLink) continue
      for (const scheme of f.schemes) {
        if (f.hosts.length === 0) {
          deepLinks.push({
            component: comp.name,
            scheme,
            host: null,
            path: null,
            example: `${scheme}://`
          })
          continue
        }
        for (const host of f.hosts) {
          if (f.paths.length === 0) {
            deepLinks.push({
              component: comp.name,
              scheme,
              host,
              path: null,
              example: `${scheme}://${host}/`
            })
            continue
          }
          for (const path of f.paths) {
            deepLinks.push({
              component: comp.name,
              scheme,
              host,
              path,
              example: `${scheme}://${host}${path.startsWith('/') ? path : '/' + path}`
            })
          }
        }
      }
    }
  }

  return {
    packageName: attr(root, 'package') ?? '',
    versionName: attr(root, 'versionName') ?? '',
    versionCode: Number.parseInt(attr(root, 'versionCode') ?? '0', 10) || 0,
    minSdk,
    targetSdk,
    maxSdk: maxSdk ? Number.parseInt(maxSdk, 10) : null,
    application: {
      label: attr(appEl, 'label') ?? null,
      debuggable: parseBool(attr(appEl, 'debuggable')),
      allowBackup: attr(appEl, 'allowBackup') !== 'false', // defaults to true
      usesCleartextTraffic: maybeBool(attr(appEl, 'usesCleartextTraffic')),
      networkSecurityConfigRef: attr(appEl, 'networkSecurityConfig') ?? null,
      testOnly: parseBool(attr(appEl, 'testOnly')),
      extractNativeLibs: maybeBool(attr(appEl, 'extractNativeLibs')),
      backupContentRef: attr(appEl, 'fullBackupContent') ?? null
    },
    permissions,
    declaredPermissions,
    components: { activities: [...activities, ...aliasActivities], services, receivers, providers },
    deepLinks,
    raw: root,
    prettyXml: renderXml(root)
  }
}

function parseComponent(el: AxmlElement, targetSdk: number): ParsedComponent {
  const exportedRaw = attr(el, 'exported')
  const filters = findAllElements(el, 'intent-filter').map((f) => {
    const actions = findAllElements(f, 'action').map((a) => attr(a, 'name') ?? '').filter(Boolean)
    const categories = findAllElements(f, 'category').map((c) => attr(c, 'name') ?? '').filter(Boolean)
    const datas = findAllElements(f, 'data')
    const schemes = datas.map((d) => attr(d, 'scheme') ?? '').filter(Boolean)
    const hosts = datas.map((d) => attr(d, 'host') ?? '').filter(Boolean)
    const paths = datas
      .flatMap((d) => [attr(d, 'path'), attr(d, 'pathPrefix'), attr(d, 'pathPattern')])
      .filter((s): s is string => !!s)
    const mimeTypes = datas.map((d) => attr(d, 'mimeType') ?? '').filter(Boolean)
    return { actions, categories, schemes, hosts, paths, mimeTypes }
  })

  // Android 12+ (targetSdk 31) defaults exported to *false* for
  // components with intent filters. For older targets it defaults to
  // true. We mirror Android's logic so the Security Checks tab doesn't
  // flag every legacy app for "exported component" if they're actually
  // safe under their target SDK.
  const exported = exportedRaw == null
    ? targetSdk < 31 && filters.length > 0
    : exportedRaw === 'true'

  return {
    name: attr(el, 'name') ?? '',
    exported,
    exportedExplicit: exportedRaw != null,
    permission: attr(el, 'permission') ?? null,
    intentFilters: filters,
    authorities: null
  }
}

function parseBool(v: string | undefined): boolean {
  return v === 'true' || v === '1'
}
function maybeBool(v: string | undefined): boolean | null {
  if (v === undefined) return null
  return v === 'true' || v === '1'
}

/**
 * Render an AXML tree as a pretty-printed XML string. Not a full
 * "spec-compliant" serializer — just enough for the Manifest tab to
 * show something readable.
 */
function renderXml(root: AxmlElement, indent = 0): string {
  const pad = '  '.repeat(indent)
  const attrs = root.attributes
    .map((a) => {
      const prefix = a.ns ? `${nsPrefix(a.ns)}:` : ''
      return `${prefix}${a.name}="${escapeXml(String(a.value))}"`
    })
    .join(' ')
  if (root.children.length === 0 && !root.text) {
    return `${pad}<${root.name}${attrs ? ' ' + attrs : ''} />\n`
  }
  let out = `${pad}<${root.name}${attrs ? ' ' + attrs : ''}>\n`
  if (root.text) out += `${pad}  ${escapeXml(root.text)}\n`
  for (const child of root.children) out += renderXml(child, indent + 1)
  out += `${pad}</${root.name}>\n`
  return out
}

function nsPrefix(uri: string): string {
  if (uri === 'http://schemas.android.com/apk/res/android') return 'android'
  if (uri === 'http://schemas.android.com/tools') return 'tools'
  return 'ns'
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
