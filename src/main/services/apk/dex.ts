/**
 * Tiny DEX header reader.
 *
 * We don't need to disassemble bytecode — jadx does that. What we DO
 * need, for a quick scan that finishes in milliseconds:
 *   - The class_defs_size field at offset 96 → total declared classes,
 *     a useful "how big is this app's code" signal.
 *   - The string_ids_size at offset 56 → number of UTF-8 strings the
 *     DEX references; we sweep these for secrets/URLs without
 *     decompiling.
 *
 * The DEX format is documented at
 *   https://source.android.com/docs/core/runtime/dex-format
 * Header is fixed-layout, little-endian. Magic is `dex\n035\0` (or
 * `037`/`038`/`039` depending on Android version).
 */

export interface DexHeaderInfo {
  /** Version number from the magic, e.g. `035`. */
  version: string
  classCount: number
  stringCount: number
  /** Total file size declared in the header (we cross-check against
   *  the buffer length to detect truncation). */
  fileSize: number
}

export function readDexHeader(buf: Buffer): DexHeaderInfo | null {
  if (buf.length < 0x70) return null
  // Magic check — accept any version in `dex\n0XX\0`.
  if (
    buf[0] !== 0x64 ||
    buf[1] !== 0x65 ||
    buf[2] !== 0x78 ||
    buf[3] !== 0x0a ||
    buf[7] !== 0x00
  ) {
    return null
  }
  const version = String.fromCharCode(buf[4]!, buf[5]!, buf[6]!)
  const fileSize = buf.readUInt32LE(32)
  const stringCount = buf.readUInt32LE(56)
  const classCount = buf.readUInt32LE(96)
  return { version, classCount, stringCount, fileSize }
}

/**
 * Extract every UTF-8 string referenced by a DEX without decompiling
 * the bytecode. Useful for "quick" secrets/endpoints sweep before the
 * heavy jadx pass.
 *
 * DEX strings are stored as a `string_ids` table (each entry is a u32
 * offset) → at each offset, a ULEB128 length followed by the bytes. We
 * pull them all, deduplicate, and let the caller regex them.
 */
export function readDexStrings(buf: Buffer): string[] {
  const header = readDexHeader(buf)
  if (!header) return []
  const stringIdsSize = buf.readUInt32LE(56)
  const stringIdsOff = buf.readUInt32LE(60)
  if (stringIdsOff + stringIdsSize * 4 > buf.length) return []

  const out: string[] = []
  for (let i = 0; i < stringIdsSize; i++) {
    const dataOff = buf.readUInt32LE(stringIdsOff + i * 4)
    if (dataOff >= buf.length) continue
    const [len, after] = readUleb128(buf, dataOff)
    if (after + len > buf.length) continue
    // Spec: MUTF-8, which differs from real UTF-8 for the null byte and
    // supplementary plane chars. Node's `utf8` decoder is close enough
    // for almost every real-world DEX — we're not depending on exact
    // byte-identity, just on text searching, so the occasional mojibake
    // is fine.
    const text = buf.toString('utf8', after, after + len)
    if (text) out.push(text)
  }
  return out
}

function readUleb128(buf: Buffer, off: number): [number, number] {
  let result = 0
  let shift = 0
  let pos = off
  for (let i = 0; i < 5; i++) {
    const b = buf.readUInt8(pos++)
    result |= (b & 0x7f) << shift
    if ((b & 0x80) === 0) break
    shift += 7
  }
  return [result, pos]
}

/**
 * Crude obfuscation heuristic: ProGuard/R8 renames classes to single-
 * letter (or two-letter) names like `a`, `b`, `aa`. Compute the ratio
 * of "short" class names against the total — > 0.5 is a strong signal
 * the app shipped with obfuscation enabled.
 *
 * Caller passes the list of class strings the analyzer collected (we
 * read them from DEX strings; class names look like `La/b/c/Foo;`).
 */
export function estimateObfuscation(classStrings: string[]): {
  ratio: number
  totalClasses: number
  shortClasses: number
} {
  let total = 0
  let short = 0
  for (const s of classStrings) {
    // Class descriptors start with `L` and end with `;` per Dalvik spec.
    if (!s.startsWith('L') || !s.endsWith(';')) continue
    total++
    const inner = s.slice(1, -1) // strip L...;
    const last = inner.split('/').pop() ?? ''
    if (last.length <= 2) short++
  }
  if (total === 0) return { ratio: 0, totalClasses: 0, shortClasses: 0 }
  return { ratio: short / total, totalClasses: total, shortClasses: short }
}
