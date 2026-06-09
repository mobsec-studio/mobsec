/**
 * Structured agent → host message protocol.
 *
 * The agent communicates with the MobSec main process over Frida's global
 * `send()`. We wrap every structured payload in the `{ __mobsec: 1 }`
 * envelope (see @shared/frida-intel) so the host can route our messages by
 * `kind` while leaving plain-string payloads from user/CodeShare scripts
 * completely untouched.
 *
 * Nothing in here may throw — telemetry must never take down an agent that
 * is mid-bypass. Every `send` is guarded.
 */

import {
  MOBSEC_ENVELOPE,
  type AgentChannel,
  type AgentLogLevel,
  type AgentMessage
} from '@shared/frida-intel'

/** Bundle identity — surfaced on `ready` so stale bundles are obvious. */
export const AGENT_VERSION = '1.0.0'

function post(message: AgentMessage): void {
  try {
    send(message)
  } catch (_e) {
    // A failed send is non-fatal by design; swallow it.
  }
}

export function emitLog(channel: AgentChannel, level: AgentLogLevel, text: string): void {
  post({ __mobsec: MOBSEC_ENVELOPE, kind: 'log', channel, level, text, ts: Date.now() })
}

export function emitReady(api: string[]): void {
  post({ __mobsec: MOBSEC_ENVELOPE, kind: 'ready', api, agentVersion: AGENT_VERSION })
}

export function emitEvent(
  channel: AgentChannel,
  category: string,
  summary: string,
  detail?: string,
  meta?: Record<string, string>,
  severity: 'info' | 'warn' | 'error' = 'info'
): void {
  post({
    __mobsec: MOBSEC_ENVELOPE,
    kind: 'event',
    channel,
    category,
    summary,
    detail,
    meta,
    severity,
    ts: Date.now()
  })
}

export function emitFinding(
  channel: AgentChannel,
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical',
  title: string,
  detail: string
): void {
  post({
    __mobsec: MOBSEC_ENVELOPE,
    kind: 'finding',
    channel,
    severity,
    title,
    detail,
    ts: Date.now()
  })
}
