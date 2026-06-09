/**
 * Storage monitor. Logs SharedPreferences reads/writes and SQLite queries
 * — the two places apps stash tokens, flags and PII — as they happen.
 */

import type { Tracer } from '../core/registry'
import type { ReconContext } from '../core/context'
import { channel } from '../core/log'
import { HookSet } from '../core/hookset'
import { clip } from '../core/bytes'
import { safe } from '../core/safe'
import { traceMethod } from './common'

const hooks = new HookSet()
const log = channel('storage')

const PREF_READERS = ['getString', 'getInt', 'getLong', 'getBoolean', 'getFloat', 'getStringSet']
const PREF_WRITERS = ['putString', 'putInt', 'putLong', 'putBoolean', 'putFloat', 'putStringSet', 'remove']

export const storageTracer: Tracer = {
  id: 'storage',
  label: 'Storage monitor',
  description: 'SharedPreferences reads/writes and SQLite execSQL/query/insert/update/delete.',
  channel: 'storage',
  start(_ctx: ReconContext): void {
    safe('storage:prefs.read', () => {
      const Impl = Java.use('android.app.SharedPreferencesImpl')
      for (const name of PREF_READERS) {
        traceMethod(hooks, Impl[name], (_self, args, result) => {
          const key = String(args[0])
          log.event('prefs.read', `prefs.${name}(${key})`, undefined, {
            key,
            value: clip(String(result))
          })
        })
      }
    })

    safe('storage:prefs.write', () => {
      const Editor = Java.use('android.app.SharedPreferencesImpl$EditorImpl')
      for (const name of PREF_WRITERS) {
        traceMethod(hooks, Editor[name], (_self, args) => {
          const key = String(args[0])
          const meta: Record<string, string> = { key }
          if (args.length > 1) meta.value = clip(String(args[1]))
          log.event('prefs.write', `prefs.${name}(${key})`, undefined, meta, 'warn')
        })
      }
    })

    safe('storage:sqlite', () => {
      const DB = Java.use('android.database.sqlite.SQLiteDatabase')
      traceMethod(hooks, DB.execSQL, (_self, args) =>
        log.event('sqlite', 'SQLite.execSQL', undefined, { sql: clip(String(args[0])) })
      )
      traceMethod(hooks, DB.rawQuery, (_self, args) =>
        log.event('sqlite', 'SQLite.rawQuery', undefined, { sql: clip(String(args[0])) })
      )
      traceMethod(hooks, DB.insert, (_self, args) =>
        log.event('sqlite', `SQLite.insert → ${String(args[0])}`, undefined, { table: String(args[0]) }, 'warn')
      )
      traceMethod(hooks, DB.update, (_self, args) =>
        log.event('sqlite', `SQLite.update → ${String(args[0])}`, undefined, { table: String(args[0]) }, 'warn')
      )
      traceMethod(hooks, DB.delete, (_self, args) =>
        log.event('sqlite', `SQLite.delete → ${String(args[0])}`, undefined, { table: String(args[0]) }, 'warn')
      )
    })

    log.info(`storage monitor active (${hooks.count} hook(s))`)
  },
  stop(): void {
    hooks.revert()
    log.info('storage monitor stopped')
  }
}
