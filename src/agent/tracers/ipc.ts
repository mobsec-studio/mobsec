/**
 * IPC / intent monitor. Logs the app's component traffic — activities,
 * broadcasts, services and content-provider access — with a compact
 * Intent summary, to map attack surface and follow data between components.
 */

import type { Tracer } from '../core/registry'
import type { ReconContext } from '../core/context'
import { channel } from '../core/log'
import { HookSet } from '../core/hookset'
import { safe } from '../core/safe'
import { traceMethod } from './common'

const hooks = new HookSet()
const log = channel('ipc')

function intentSummary(value: unknown): string {
  const i = value as Java.Wrapper | null
  if (!i) return 'null'
  try {
    const parts: string[] = []
    const action = i.getAction()
    if (action) parts.push(`action=${String(action)}`)
    const data = i.getDataString()
    if (data) parts.push(`data=${String(data)}`)
    const comp = i.getComponent()
    if (comp) parts.push(`component=${String(comp.flattenToShortString())}`)
    return parts.length > 0 ? parts.join(' ') : '(implicit/empty intent)'
  } catch (_e) {
    return '<intent>'
  }
}

export const ipcTracer: Tracer = {
  id: 'ipc',
  label: 'IPC / intent monitor',
  description: 'startActivity, sendBroadcast, start/bindService and ContentResolver access with Intent summaries.',
  channel: 'ipc',
  start(_ctx: ReconContext): void {
    safe('ipc:activity', () => {
      const Activity = Java.use('android.app.Activity')
      traceMethod(hooks, Activity.startActivity, (_self, args) => {
        const intent = intentSummary(args[0])
        log.event('intent', `startActivity · ${intent}`, undefined, { call: 'startActivity', intent })
      })
      traceMethod(hooks, Activity.startActivityForResult, (_self, args) => {
        const intent = intentSummary(args[0])
        log.event('intent', `startActivityForResult · ${intent}`, undefined, {
          call: 'startActivityForResult',
          intent
        })
      })
    })

    safe('ipc:broadcast-service', () => {
      const CW = Java.use('android.content.ContextWrapper')
      traceMethod(hooks, CW.sendBroadcast, (_self, args) => {
        const intent = intentSummary(args[0])
        log.event('broadcast', `sendBroadcast · ${intent}`, undefined, { call: 'sendBroadcast', intent })
      })
      traceMethod(hooks, CW.startService, (_self, args) => {
        const intent = intentSummary(args[0])
        log.event('service', `startService · ${intent}`, undefined, { call: 'startService', intent })
      })
      traceMethod(hooks, CW.bindService, (_self, args) => {
        const intent = intentSummary(args[0])
        log.event('service', `bindService · ${intent}`, undefined, { call: 'bindService', intent })
      })
    })

    safe('ipc:contentresolver', () => {
      const CR = Java.use('android.content.ContentResolver')
      traceMethod(hooks, CR.query, (_self, args) =>
        log.event('provider', `ContentResolver.query · ${String(args[0])}`, undefined, {
          call: 'query',
          uri: String(args[0])
        })
      )
      traceMethod(hooks, CR.insert, (_self, args) =>
        log.event('provider', `ContentResolver.insert · ${String(args[0])}`, undefined, {
          call: 'insert',
          uri: String(args[0])
        }, 'warn')
      )
      traceMethod(hooks, CR.delete, (_self, args) =>
        log.event('provider', `ContentResolver.delete · ${String(args[0])}`, undefined, {
          call: 'delete',
          uri: String(args[0])
        }, 'warn')
      )
    })

    log.info(`ipc monitor active (${hooks.count} hook(s))`)
  },
  stop(): void {
    hooks.revert()
    log.info('ipc monitor stopped')
  }
}
