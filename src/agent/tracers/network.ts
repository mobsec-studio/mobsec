/**
 * Network monitor. Logs outbound requests at the app's HTTP layer (OkHttp
 * + java.net.URL) with a short Java stack so each call can be correlated
 * with a flow in the Proxy tab — independent of, and complementary to, the
 * mitmproxy capture.
 */

import type { Tracer } from '../core/registry'
import type { ReconContext } from '../core/context'
import { channel } from '../core/log'
import { HookSet } from '../core/hookset'
import { safe } from '../core/safe'
import { traceMethod, shortStack } from './common'

const hooks = new HookSet()
const log = channel('network')

export const networkTracer: Tracer = {
  id: 'network',
  label: 'Network monitor',
  description: 'OkHttp + java.net.URL requests with method, URL and a short call stack for proxy correlation.',
  channel: 'network',
  start(_ctx: ReconContext): void {
    safe('network:okhttp', () => {
      const Client = Java.use('okhttp3.OkHttpClient')
      traceMethod(hooks, Client.newCall, (_self, args) => {
        const req = args[0] as Java.Wrapper | null
        if (!req) return
        const url = String(req.url())
        const method = String(req.method())
        log.event('http', `${method} ${url}`, undefined, { client: 'OkHttp', method, url, stack: shortStack(4) })
      })
    })

    safe('network:url', () => {
      const URL = Java.use('java.net.URL')
      traceMethod(hooks, URL.openConnection, (self) => {
        const url = String(self.toString())
        if (url.indexOf('http') !== 0) return
        log.event('http', `openConnection ${url}`, undefined, {
          client: 'HttpURLConnection',
          url,
          stack: shortStack(4)
        })
      })
    })

    log.info(`network monitor active (${hooks.count} hook(s))`)
  },
  stop(): void {
    hooks.revert()
    log.info('network monitor stopped')
  }
}
