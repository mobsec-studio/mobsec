/**
 * Decoder for Android Binary XML (AXML).
 *
 * Android compiles every XML resource (AndroidManifest.xml,
 * res/layout/*.xml, etc.) into a custom binary format that's roughly 4–10×
 * smaller than the text form and parses in a single linear pass. We want
 * to read AndroidManifest.xml from inside an APK without shelling out to
 * `aapt`/`apktool`, so we ship a focused decoder that handles exactly the
 * structures Android emits.
 *
 * The format is documented in AOSP's
 *   frameworks/base/include/androidfw/ResourceTypes.h
 * and well summarized in public reverse-engineering write-ups; the
 * chunk header for every block is:
 *
 *     u16 type         // chunk kind, see CHUNK_* below
 *     u16 headerSize   // bytes in this header (varies per kind)
 *     u32 chunkSize    // total bytes in this chunk, including header
 *
 * We surface the result as a generic XML tree the caller (manifest.ts)
 * walks to extract package metadata, components, and permissions.
 */

const CHUNK_AXML_FILE = 0x0003
const CHUNK_STRING_POOL = 0x0001
const CHUNK_RESOURCE_MAP = 0x0180
const CHUNK_XML_START_NS = 0x0100
const CHUNK_XML_END_NS = 0x0101
const CHUNK_XML_START_ELEMENT = 0x0102
const CHUNK_XML_END_ELEMENT = 0x0103
const CHUNK_XML_CDATA = 0x0104

const STRING_POOL_UTF8_FLAG = 1 << 8

const TYPE_STRING = 0x03
const TYPE_REFERENCE = 0x01
const TYPE_ATTRIBUTE = 0x02
const TYPE_FLOAT = 0x04
const TYPE_INT_DEC = 0x10
const TYPE_INT_HEX = 0x11
const TYPE_INT_BOOLEAN = 0x12
const TYPE_INT_COLOR_ARGB8 = 0x1c
const TYPE_INT_COLOR_RGB8 = 0x1d
const TYPE_INT_COLOR_ARGB4 = 0x1e
const TYPE_INT_COLOR_RGB4 = 0x1f

export interface AxmlAttribute {
  /** Resolved namespace URI (empty string for default). */
  ns: string
  /** Local attribute name, e.g. `name`, `exported`. */
  name: string
  /** Decoded value: strings stay strings, ints/bools become primitives,
   *  references stay as `@0xRESID` and themed attributes as `?0xRESID`. */
  value: string | number | boolean
  /** Resource ID (0 if no resource map entry exists for this name). */
  resId: number
  /** Original raw type byte from the value union — useful when callers
   *  want to special-case e.g. booleans vs. strings. */
  rawType: number
}

export interface AxmlElement {
  ns: string
  name: string
  attributes: AxmlAttribute[]
  children: AxmlElement[]
  /** Text content if the element has CDATA children. */
  text: string
}

export interface AxmlDocument {
  root: AxmlElement | null
}

/**
 * Decode a binary AXML buffer into a tree. Throws on a malformed file —
 * caller wraps that in a friendly "this APK's manifest is corrupted"
 * message.
 */
export function parseAxml(buffer: Buffer): AxmlDocument {
  if (buffer.length < 8) throw new Error('AXML: file too small')

  const reader = new BufferReader(buffer)
  const fileType = reader.readUInt16LE()
  if (fileType !== CHUNK_AXML_FILE) {
    throw new Error(
      `AXML: expected chunk type 0x${CHUNK_AXML_FILE.toString(16)}, got 0x${fileType.toString(16)}`
    )
  }
  /* const headerSize = */ reader.readUInt16LE()
  /* const fileSize = */ reader.readUInt32LE()

  let strings: string[] = []
  // Maps string-pool index → resource ID. Used to resolve attribute
  // names that Android stores as empty strings + a resource ID (very
  // common for android:* namespaces).
  let resMap: number[] = []

  const stack: AxmlElement[] = []
  let root: AxmlElement | null = null
  // The active namespace bindings. AXML emits START_NAMESPACE chunks
  // declaring `xmlns:android="http://schemas.android.com/apk/res/android"`
  // etc. — we track them so we can resolve attribute namespaces.
  const namespaces = new Map<number, number>() // prefixStringIdx → uriStringIdx

  while (reader.remaining() >= 8) {
    const chunkStart = reader.pos
    const chunkType = reader.readUInt16LE()
    const chunkHeader = reader.readUInt16LE()
    const chunkSize = reader.readUInt32LE()
    const chunkEnd = chunkStart + chunkSize

    if (chunkType === CHUNK_STRING_POOL) {
      strings = parseStringPool(buffer, chunkStart, chunkHeader, chunkSize)
    } else if (chunkType === CHUNK_RESOURCE_MAP) {
      const count = (chunkSize - chunkHeader) / 4
      resMap = []
      for (let i = 0; i < count; i++) {
        resMap.push(buffer.readUInt32LE(chunkStart + chunkHeader + i * 4))
      }
    } else if (chunkType === CHUNK_XML_START_NS) {
      reader.skip(8) // lineNumber + comment
      const prefixIdx = reader.readUInt32LE()
      const uriIdx = reader.readUInt32LE()
      namespaces.set(prefixIdx, uriIdx)
    } else if (chunkType === CHUNK_XML_END_NS) {
      reader.skip(8)
      const prefixIdx = reader.readUInt32LE()
      reader.readUInt32LE() // uri
      namespaces.delete(prefixIdx)
    } else if (chunkType === CHUNK_XML_START_ELEMENT) {
      reader.skip(8) // lineNumber + comment
      const nsIdx = reader.readUInt32LE()
      const nameIdx = reader.readUInt32LE()
      /* const attrStart = */ reader.readUInt16LE()
      /* const attrSize = */ reader.readUInt16LE()
      const attrCount = reader.readUInt16LE()
      reader.skip(6) // idIndex + classIndex + styleIndex

      const element: AxmlElement = {
        ns: nsIdx === 0xffffffff ? '' : strings[nsIdx] ?? '',
        name: strings[nameIdx] ?? `__name_${nameIdx}`,
        attributes: [],
        children: [],
        text: ''
      }

      for (let i = 0; i < attrCount; i++) {
        const attrNsIdx = reader.readUInt32LE()
        const attrNameIdx = reader.readUInt32LE()
        const attrRawValueIdx = reader.readUInt32LE()
        const valSize = reader.readUInt16LE()
        if (valSize !== 8) {
          // Some legacy AXML emitters used 0 here. We tolerate it but
          // expect the value union to follow with the same shape.
        }
        const _res0 = reader.readUInt8()
        void _res0
        const valType = reader.readUInt8()
        const valData = reader.readUInt32LE()

        const ns = attrNsIdx === 0xffffffff ? '' : strings[attrNsIdx] ?? ''
        let name = strings[attrNameIdx] ?? ''
        const resId = resMap[attrNameIdx] ?? 0
        // Android often empties the attribute name string and relies on
        // the resource map for android:* attributes. Resolve them from
        // a small hardcoded table when possible — the rest fall back to
        // the resource ID as the name so users can still tell what they
        // are looking at.
        if (!name && resId !== 0) {
          name = RESOURCE_NAMES.get(resId) ?? `attr_0x${resId.toString(16).padStart(8, '0')}`
        }

        const value = decodeAttributeValue(valType, valData, strings, attrRawValueIdx)
        element.attributes.push({ ns, name, value, resId, rawType: valType })
      }

      if (stack.length === 0) root = element
      else stack[stack.length - 1]!.children.push(element)
      stack.push(element)
    } else if (chunkType === CHUNK_XML_END_ELEMENT) {
      reader.skip(8 + 4 + 4) // lineNumber + comment + ns + name
      stack.pop()
    } else if (chunkType === CHUNK_XML_CDATA) {
      reader.skip(8) // line + comment
      const dataIdx = reader.readUInt32LE()
      reader.skip(8) // value type + data
      const txt = strings[dataIdx] ?? ''
      if (stack.length > 0) stack[stack.length - 1]!.text += txt
    } else {
      // Unknown chunk — skip safely by jumping to the chunk end.
    }

    // Always re-align to the chunk's declared end so a single corrupted
    // sub-record can't desync the whole parse.
    reader.pos = chunkEnd
  }

  return { root }
}

/**
 * Convenience: locate the first descendant element with a given local
 * name (case-sensitive). Used heavily by the manifest parser.
 */
export function findElement(root: AxmlElement | null, name: string): AxmlElement | null {
  if (!root) return null
  if (root.name === name) return root
  for (const child of root.children) {
    const r = findElement(child, name)
    if (r) return r
  }
  return null
}

/** Find all descendants matching the given local name. */
export function findAllElements(root: AxmlElement | null, name: string): AxmlElement[] {
  const out: AxmlElement[] = []
  function walk(el: AxmlElement): void {
    if (el.name === name) out.push(el)
    for (const child of el.children) walk(child)
  }
  if (root) walk(root)
  return out
}

/** Get a single attribute by local name (ns ignored). */
export function attr(el: AxmlElement | null | undefined, name: string): string | undefined {
  if (!el) return undefined
  for (const a of el.attributes) {
    if (a.name === name) return String(a.value)
  }
  return undefined
}

function decodeAttributeValue(
  type: number,
  data: number,
  strings: string[],
  rawValueIdx: number
): string | number | boolean {
  if (type === TYPE_STRING) return strings[data] ?? ''
  if (type === TYPE_INT_BOOLEAN) return data !== 0
  if (type === TYPE_INT_DEC) return data | 0
  if (type === TYPE_INT_HEX) return `0x${(data >>> 0).toString(16)}`
  if (type === TYPE_REFERENCE) return `@0x${(data >>> 0).toString(16)}`
  if (type === TYPE_ATTRIBUTE) return `?0x${(data >>> 0).toString(16)}`
  if (type === TYPE_FLOAT) {
    const buf = Buffer.alloc(4)
    buf.writeUInt32LE(data >>> 0)
    return buf.readFloatLE()
  }
  if (
    type === TYPE_INT_COLOR_ARGB8 ||
    type === TYPE_INT_COLOR_RGB8 ||
    type === TYPE_INT_COLOR_ARGB4 ||
    type === TYPE_INT_COLOR_RGB4
  ) {
    return `#${(data >>> 0).toString(16).padStart(8, '0')}`
  }
  // Anything else: prefer raw string if we have one, otherwise the int.
  if (rawValueIdx !== 0xffffffff && strings[rawValueIdx]) return strings[rawValueIdx]!
  return data | 0
}

function parseStringPool(
  buffer: Buffer,
  chunkStart: number,
  headerSize: number,
  chunkSize: number
): string[] {
  // Header layout:
  //   stringCount  u32
  //   styleCount   u32
  //   flags        u32
  //   stringsStart u32 (offset from chunkStart)
  //   stylesStart  u32
  const stringCount = buffer.readUInt32LE(chunkStart + 8)
  const flags = buffer.readUInt32LE(chunkStart + 16)
  const stringsStart = buffer.readUInt32LE(chunkStart + 20)
  const isUtf8 = (flags & STRING_POOL_UTF8_FLAG) !== 0

  const out: string[] = new Array(stringCount).fill('')
  const offsets: number[] = []
  for (let i = 0; i < stringCount; i++) {
    offsets.push(buffer.readUInt32LE(chunkStart + headerSize + i * 4))
  }

  const dataStart = chunkStart + stringsStart
  for (let i = 0; i < stringCount; i++) {
    const off = dataStart + offsets[i]!
    if (off >= chunkStart + chunkSize) {
      out[i] = ''
      continue
    }
    if (isUtf8) {
      // UTF-8 strings carry two length-prefix bytes (char count + byte
      // count, each potentially in the "long" 16-bit form), then the
      // raw bytes, then a null terminator we drop.
      const [u16Len, after1] = readUtf8Length(buffer, off)
      void u16Len
      const [byteLen, dataAt] = readUtf8Length(buffer, after1)
      out[i] = buffer.toString('utf8', dataAt, dataAt + byteLen)
    } else {
      // UTF-16: one or two u16s for length, then UTF-16LE characters.
      const [charLen, dataAt] = readUtf16Length(buffer, off)
      out[i] = buffer.toString('utf16le', dataAt, dataAt + charLen * 2)
    }
  }
  return out
}

function readUtf8Length(buffer: Buffer, offset: number): [number, number] {
  // Single byte unless the high bit is set, in which case (b1 & 0x7f) is
  // the high byte and the next byte is the low byte.
  const b = buffer.readUInt8(offset)
  if ((b & 0x80) === 0) return [b, offset + 1]
  const b2 = buffer.readUInt8(offset + 1)
  return [((b & 0x7f) << 8) | b2, offset + 2]
}

function readUtf16Length(buffer: Buffer, offset: number): [number, number] {
  const v = buffer.readUInt16LE(offset)
  if ((v & 0x8000) === 0) return [v, offset + 2]
  const v2 = buffer.readUInt16LE(offset + 2)
  return [((v & 0x7fff) << 16) | v2, offset + 4]
}

class BufferReader {
  pos = 0
  constructor(private buf: Buffer) {}
  remaining(): number {
    return this.buf.length - this.pos
  }
  skip(n: number): void {
    this.pos += n
  }
  readUInt8(): number {
    return this.buf.readUInt8(this.pos++)
  }
  readUInt16LE(): number {
    const v = this.buf.readUInt16LE(this.pos)
    this.pos += 2
    return v
  }
  readUInt32LE(): number {
    const v = this.buf.readUInt32LE(this.pos)
    this.pos += 4
    return v
  }
}

/**
 * Mini-table of the AndroidManifest.xml attribute resource IDs we care
 * about — Android stores the names as empty strings when the manifest
 * was compiled by `aapt`/`aapt2`, so without this lookup the attributes
 * would all read as `attr_0x01010003` etc. This covers ~95% of what
 * shows up in a normal manifest; unknowns still get the hex form.
 *
 * Source: AOSP `frameworks/base/core/res/res/values/public.xml`.
 */
const RESOURCE_NAMES = new Map<number, string>([
  [0x01010000, 'theme'],
  [0x01010001, 'label'],
  [0x01010002, 'icon'],
  [0x01010003, 'name'],
  [0x01010004, 'manageSpaceActivity'],
  [0x01010005, 'allowClearUserData'],
  [0x01010006, 'permission'],
  [0x01010007, 'readPermission'],
  [0x01010008, 'writePermission'],
  [0x01010009, 'protectionLevel'],
  [0x0101000a, 'permissionGroup'],
  [0x0101000b, 'sharedUserId'],
  [0x0101000c, 'hasCode'],
  [0x0101000d, 'persistent'],
  [0x0101000e, 'enabled'],
  [0x0101000f, 'debuggable'],
  [0x01010010, 'exported'],
  [0x01010011, 'process'],
  [0x01010012, 'taskAffinity'],
  [0x01010013, 'multiprocess'],
  [0x01010014, 'finishOnTaskLaunch'],
  [0x01010015, 'clearTaskOnLaunch'],
  [0x01010016, 'stateNotNeeded'],
  [0x01010017, 'excludeFromRecents'],
  [0x01010018, 'authorities'],
  [0x01010019, 'syncable'],
  [0x0101001a, 'initOrder'],
  [0x0101001b, 'grantUriPermissions'],
  [0x0101001c, 'priority'],
  [0x0101001d, 'launchMode'],
  [0x0101001e, 'screenOrientation'],
  [0x0101001f, 'configChanges'],
  [0x01010020, 'description'],
  [0x01010021, 'targetPackage'],
  [0x01010022, 'handleProfiling'],
  [0x01010023, 'functionalTest'],
  [0x01010024, 'value'],
  [0x01010025, 'resource'],
  [0x01010026, 'mimeType'],
  [0x01010027, 'scheme'],
  [0x01010028, 'host'],
  [0x01010029, 'port'],
  [0x0101002a, 'path'],
  [0x0101002b, 'pathPrefix'],
  [0x0101002c, 'pathPattern'],
  [0x0101002d, 'action'],
  [0x0101002e, 'data'],
  [0x0101002f, 'targetClass'],
  [0x01010030, 'colorForeground'],
  [0x01010031, 'colorBackground'],
  [0x01010202, 'minSdkVersion'],
  [0x01010269, 'maxSdkVersion'],
  [0x01010270, 'targetSdkVersion'],
  [0x0101021b, 'versionCode'],
  [0x0101021c, 'versionName'],
  [0x01010354, 'allowBackup'],
  [0x01010366, 'installLocation'],
  [0x010103a8, 'largeHeap'],
  [0x0101044e, 'extractNativeLibs'],
  [0x010104ee, 'usesCleartextTraffic'],
  [0x01010527, 'roundIcon'],
  [0x010105d3, 'networkSecurityConfig'],
  [0x01010572, 'fullBackupContent'],
  [0x01010573, 'fullBackupOnly'],
  [0x010104f4, 'testOnly'],
  [0x0101055f, 'banner']
])
