/**
 * Byte-array preview for monitor output. A hooked Java `byte[]` arrives as
 * an indexable wrapper; we render it as a quoted ASCII string when it's
 * printable (the common case for tokens/JSON) and as hex otherwise, always
 * capped so the console isn't flooded by multi-KB blobs.
 */

interface ByteLike {
  length?: number
  [index: number]: number
}

export function bytesPreview(value: unknown, max = 80): string {
  if (value == null) return 'null'
  const arr = value as ByteLike
  if (typeof arr.length !== 'number') return String(value)
  const len = arr.length
  const take = Math.min(len, max)

  let printable = take > 0
  let ascii = ''
  for (let i = 0; i < take; i++) {
    const b = (arr[i] ?? 0) & 0xff
    if (b >= 0x20 && b < 0x7f) {
      ascii += String.fromCharCode(b)
    } else if (b === 0x0a || b === 0x09) {
      ascii += b === 0x0a ? '\\n' : '\\t'
    } else {
      printable = false
      break
    }
  }

  const suffix = len > max ? `… (${len} bytes)` : ` (${len} bytes)`
  if (printable) return `"${ascii}"${suffix}`

  let hex = ''
  for (let i = 0; i < take; i++) hex += ((arr[i] ?? 0) & 0xff).toString(16).padStart(2, '0')
  return `${hex}${suffix}`
}

/** Shorten a long string for one-line console output. */
export function clip(text: string, max = 200): string {
  return text.length > max ? `${text.slice(0, max)}… (+${text.length - max})` : text
}
