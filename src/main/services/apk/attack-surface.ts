import type { ApkAttackSurfaceItem, SecretSeverity } from '@shared/types'
import type { ParsedComponent, ParsedManifest } from './manifest'

type ComponentKind = 'activity' | 'service' | 'receiver' | 'provider'

export function buildAttackSurface(manifest: ParsedManifest): ApkAttackSurfaceItem[] {
  const items: ApkAttackSurfaceItem[] = []
  collectComponents(items, manifest, 'activity', manifest.components.activities)
  collectComponents(items, manifest, 'service', manifest.components.services)
  collectComponents(items, manifest, 'receiver', manifest.components.receivers)
  collectComponents(items, manifest, 'provider', manifest.components.providers)

  for (const link of manifest.deepLinks) {
    const weak = !link.host || link.scheme !== 'https'
    items.push({
      id: `deeplink:${link.component}:${link.example}`,
      type: 'deep-link',
      name: link.component,
      severity: weak ? 'medium' : 'low',
      exported: true,
      permission: null,
      reason: weak
        ? 'Custom or hostless deep links can be claimed by other apps and are easy to fuzz from adb.'
        : 'HTTPS App Link entry point. Confirm Digital Asset Links verification and input validation.',
      actions: ['android.intent.action.VIEW'],
      deepLinks: [link.example],
      authorities: null,
      testCommand: `adb shell am start -a android.intent.action.VIEW -d "${link.example}" ${manifest.packageName}`
    })
  }

  return dedupe(items).sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
}

function collectComponents(
  out: ApkAttackSurfaceItem[],
  manifest: ParsedManifest,
  type: ComponentKind,
  components: ParsedComponent[]
): void {
  for (const component of components) {
    if (!component.exported && component.intentFilters.length === 0) continue
    const actions = unique(component.intentFilters.flatMap((filter) => filter.actions))
    const deepLinks = buildComponentDeepLinks(component)
    const severity = rankComponent(type, component, deepLinks)
    const fullyQualified = qualifyComponentName(manifest.packageName, component.name)

    out.push({
      id: `${type}:${component.name}`,
      type,
      name: component.name,
      severity,
      exported: component.exported,
      permission: component.permission,
      reason: describeComponent(type, component, deepLinks),
      actions,
      deepLinks,
      authorities: component.authorities,
      testCommand: buildTestCommand(type, manifest.packageName, fullyQualified, component, actions, deepLinks)
    })
  }
}

function rankComponent(
  type: ComponentKind,
  component: ParsedComponent,
  deepLinks: string[]
): SecretSeverity {
  if (!component.exported) return 'info'
  if (component.permission) return 'low'
  if (type === 'provider') return 'high'
  if (type === 'service') return 'high'
  if (type === 'receiver') return 'medium'
  if (deepLinks.some((link) => !link.startsWith('https://'))) return 'medium'
  return 'medium'
}

function describeComponent(
  type: ComponentKind,
  component: ParsedComponent,
  deepLinks: string[]
): string {
  if (!component.exported) {
    return 'Has intent filters but is not exported under the target SDK rules. Keep it this way unless cross-app entry is required.'
  }
  if (component.permission) {
    return `Exported ${type} protected by ${component.permission}. Verify the permission is signature-level if the component handles sensitive data.`
  }
  if (type === 'provider') {
    return `Exported provider authority ${component.authorities ?? '(unknown)'} has no permission gate and may expose files or database rows.`
  }
  if (type === 'service') {
    return 'Exported service has no permission gate. Any app can attempt to bind or start it.'
  }
  if (type === 'receiver') {
    return 'Exported broadcast receiver has no permission gate. Any app can send matching broadcasts.'
  }
  if (deepLinks.length > 0) {
    return 'Exported activity is reachable through deep links. Fuzz URI parsing, auth state, and intent extras.'
  }
  return 'Exported activity has no permission gate and can be launched by other apps.'
}

function buildTestCommand(
  type: ComponentKind,
  packageName: string,
  componentName: string,
  component: ParsedComponent,
  actions: string[],
  deepLinks: string[]
): string | null {
  const target = `${packageName}/${componentName}`
  if (deepLinks.length > 0) {
    return `adb shell am start -a android.intent.action.VIEW -d "${deepLinks[0]}" ${packageName}`
  }
  if (type === 'activity') return `adb shell am start -n ${target}`
  if (type === 'service') return `adb shell am startservice -n ${target}`
  if (type === 'receiver') {
    const action = actions[0] ?? `${packageName}.TEST`
    return `adb shell am broadcast -a ${action} -n ${target}`
  }
  if (type === 'provider' && component.authorities) {
    const authority = component.authorities.split(';')[0]?.split(',')[0]?.trim()
    if (authority) return `adb shell content query --uri content://${authority}/`
  }
  return null
}

function buildComponentDeepLinks(component: ParsedComponent): string[] {
  const out: string[] = []
  for (const filter of component.intentFilters) {
    for (const scheme of filter.schemes) {
      if (filter.hosts.length === 0) {
        out.push(`${scheme}://`)
        continue
      }
      for (const host of filter.hosts) {
        if (filter.paths.length === 0) {
          out.push(`${scheme}://${host}/`)
          continue
        }
        for (const path of filter.paths) {
          out.push(`${scheme}://${host}${path.startsWith('/') ? path : '/' + path}`)
        }
      }
    }
  }
  return unique(out)
}

function qualifyComponentName(packageName: string, componentName: string): string {
  if (componentName.startsWith('.')) return packageName + componentName
  if (!componentName.includes('.')) return `${packageName}.${componentName}`
  return componentName
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}

function dedupe(items: ApkAttackSurfaceItem[]): ApkAttackSurfaceItem[] {
  const byId = new Map<string, ApkAttackSurfaceItem>()
  for (const item of items) byId.set(item.id, item)
  return [...byId.values()]
}

function severityRank(s: SecretSeverity): number {
  return { critical: 0, high: 1, medium: 2, low: 3, info: 4 }[s] ?? 5
}
