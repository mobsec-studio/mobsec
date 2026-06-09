/** Live-monitor registration. */

import { registerTracer } from '../core/registry'
import { cryptoTracer } from './crypto'
import { storageTracer } from './storage'
import { networkTracer } from './network'
import { ipcTracer } from './ipc'

export function registerAllTracers(): void {
  registerTracer(cryptoTracer)
  registerTracer(storageTracer)
  registerTracer(networkTracer)
  registerTracer(ipcTracer)
}
