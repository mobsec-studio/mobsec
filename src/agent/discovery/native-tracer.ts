/**
 * Native function tracer. Attaches to an exported native symbol and logs
 * entry args (as pointers) and the return value. Tracked per module!symbol
 * so it can be detached cleanly.
 */

import { channel } from '../core/log'
import { ModuleRT } from '../core/native'

const log = channel('jni')
const active = new Map<string, InvocationListener>()

export function traceNative(moduleName: string, symbol: string): { ok: boolean } {
  const key = `${moduleName || '*'}!${symbol}`
  if (active.has(key)) return { ok: true }

  const addr = ModuleRT.findExportByName(moduleName || null, symbol)
  if (!addr) {
    log.warn(`native trace: ${key} not found / not exported`)
    return { ok: false }
  }

  const listener = Interceptor.attach(addr, {
    onEnter(args) {
      const shown = [args[0], args[1], args[2], args[3]]
        .map((p) => (p ? p.toString() : '?'))
        .join(', ')
      log.event('native', `→ ${symbol}(${shown})`, undefined, { symbol, args: shown })
    },
    onLeave(retval) {
      log.event('native', `← ${symbol} = ${retval.toString()}`, undefined, {
        symbol,
        return: retval.toString()
      })
    }
  })
  active.set(key, listener)
  log.info(`tracing native ${key}`)
  return { ok: true }
}

export function untraceNative(moduleName: string, symbol: string): void {
  const key = `${moduleName || '*'}!${symbol}`
  const listener = active.get(key)
  if (!listener) return
  listener.detach()
  active.delete(key)
  log.info(`stopped tracing native ${key}`)
}

export function activeNativeTraces(): string[] {
  return Array.from(active.keys())
}
