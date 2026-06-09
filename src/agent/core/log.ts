/**
 * Per-channel logging + structured events built on the message protocol.
 * A `ChannelLogger` is pre-bound to one channel so detectors/strategies/
 * monitors just write `log.info('…')` or `log.event('cipher', '…')`.
 *
 * Convention: lifecycle/progress goes through the log methods (text
 * console), while observed app activity goes through `event()` (the
 * structured Live Events feed).
 */

import { emitEvent, emitLog } from './protocol'
import type { AgentChannel } from '@shared/frida-intel'

export interface ChannelLogger {
  debug(text: string): void
  info(text: string): void
  warn(text: string): void
  error(text: string): void
  /** Emit a structured instrumentation event on this channel. */
  event(
    category: string,
    summary: string,
    detail?: string,
    meta?: Record<string, string>,
    severity?: 'info' | 'warn' | 'error'
  ): void
}

export function channel(ch: AgentChannel): ChannelLogger {
  return {
    debug: (text) => emitLog(ch, 'debug', text),
    info: (text) => emitLog(ch, 'info', text),
    warn: (text) => emitLog(ch, 'warn', text),
    error: (text) => emitLog(ch, 'error', text),
    event: (category, summary, detail, meta, severity = 'info') =>
      emitEvent(ch, category, summary, detail, meta, severity)
  }
}
