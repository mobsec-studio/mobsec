/**
 * Storage-layer detector.
 *
 * Surfaces where the app can persist data — the first question in any
 * "where did this token go?" investigation. SharedPreferences and SQLite
 * are reported as the always-present baseline (they're the lazy default
 * exfil targets), and we flag the encrypted/ORM variants that materially
 * change the picture (EncryptedSharedPreferences, Room, Realm, SQLCipher,
 * DataStore, MMKV, ObjectBox).
 */

import type { Detector } from '../core/registry'
import type { ReconContext } from '../core/context'
import type { ReportBuilder } from '../core/report'

interface StorageSig {
  id: string
  label: string
  marker: string
  encrypted: boolean
}

const SIGNATURES: StorageSig[] = [
  { id: 'encrypted-shared-prefs', label: 'EncryptedSharedPreferences', marker: 'androidx.security.crypto.EncryptedSharedPreferences', encrypted: true },
  { id: 'datastore', label: 'Jetpack DataStore', marker: 'androidx.datastore.core.DataStore', encrypted: false },
  { id: 'room', label: 'Room (SQLite ORM)', marker: 'androidx.room.RoomDatabase', encrypted: false },
  { id: 'realm', label: 'Realm', marker: 'io.realm.Realm', encrypted: false },
  { id: 'sqlcipher', label: 'SQLCipher (encrypted SQLite)', marker: 'net.sqlcipher.database.SQLiteDatabase', encrypted: true },
  { id: 'objectbox', label: 'ObjectBox', marker: 'io.objectbox.BoxStore', encrypted: false },
  { id: 'mmkv', label: 'MMKV', marker: 'com.tencent.mmkv.MMKV', encrypted: false },
  { id: 'greendao', label: 'greenDAO', marker: 'org.greenrobot.greendao.AbstractDao', encrypted: false }
]

export const storageDetector: Detector = {
  id: 'storage',
  detect(ctx: ReconContext, out: ReportBuilder): void {
    // Baseline platform stores — present in essentially every app.
    out.addStorage({
      id: 'shared-prefs',
      label: 'SharedPreferences',
      encrypted: false,
      evidence: ['android.app.SharedPreferencesImpl (platform default)']
    })
    out.addStorage({
      id: 'sqlite',
      label: 'SQLite',
      encrypted: false,
      evidence: ['android.database.sqlite.SQLiteDatabase (platform default)']
    })

    for (const sig of SIGNATURES) {
      if (!ctx.hasClass(sig.marker)) continue
      out.addStorage({
        id: sig.id,
        label: sig.label,
        encrypted: sig.encrypted,
        evidence: [sig.marker]
      })
    }
  }
}
