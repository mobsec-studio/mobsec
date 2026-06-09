import type { IpcResult } from '@shared/types'
import { getLogger } from './logger'

/**
 * Wrap an async operation so it always resolves with an `IpcResult<T>` envelope.
 * Errors are logged once here and never propagate across the IPC boundary —
 * the renderer always receives a serializable result.
 */
export async function safe<T>(
  context: string,
  fn: () => Promise<T> | T
): Promise<IpcResult<T>> {
  try {
    const value = await fn()
    return { ok: true, value }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    getLogger().error(`[${context}] ${message}`, { stack })
    return { ok: false, error: message }
  }
}

export function ok<T>(value: T): IpcResult<T> {
  return { ok: true, value }
}

export function err<T = never>(message: string): IpcResult<T> {
  return { ok: false, error: message }
}
