import yauzl from 'yauzl'

/**
 * Thin promise-shaped wrapper over yauzl. We only need three operations
 * across the analyzer (enumerate entries, read one entry to a buffer,
 * iterate entries with a callback) and the yauzl callback API is awkward
 * to use directly — wrapping it up here keeps `apk-analyzer.ts` readable.
 *
 * yauzl is lazy by design: opening a ZIP only reads the central
 * directory, and entry contents are streamed on demand. That matches our
 * "quick scan reads a few files, optional deep scan reads everything"
 * pattern perfectly.
 */

export interface ZipEntryInfo {
  fileName: string
  /** Uncompressed size in bytes. */
  size: number
  /** Compressed size on disk. */
  compressedSize: number
  /** Last-modified timestamp (DOS-format → JS Date). */
  modTime: Date
  /** CRC32 from the central directory. */
  crc32: number
  /** True for entries whose name ends with `/`. */
  isDirectory: boolean
}

export interface OpenZipResult {
  entries: ZipEntryInfo[]
  /** Read a named entry's full contents into a Buffer. Resolves null if
   *  the entry doesn't exist; rejects if read fails mid-stream. */
  readEntry(name: string): Promise<Buffer | null>
  close(): Promise<void>
}

export async function openZip(path: string): Promise<OpenZipResult> {
  return openZipFromZipFile(await openZipFile(path))
}

export async function openZipBuffer(buffer: Buffer): Promise<OpenZipResult> {
  return openZipFromZipFile(await openZipFileFromBuffer(buffer))
}

async function openZipFromZipFile(zipFile: yauzl.ZipFile): Promise<OpenZipResult> {

  // Drain the central directory up front. APKs typically have 500–10k
  // entries — that's a single sub-millisecond pass even on slow disks
  // and gives us random access to entries by name later.
  const entries: yauzl.Entry[] = []
  const byName = new Map<string, yauzl.Entry>()
  await new Promise<void>((resolve, reject) => {
    zipFile.on('entry', (e: yauzl.Entry) => {
      entries.push(e)
      byName.set(e.fileName, e)
      zipFile.readEntry()
    })
    zipFile.on('end', () => resolve())
    zipFile.on('error', reject)
    zipFile.readEntry()
  })

  const info: ZipEntryInfo[] = entries.map((e) => ({
    fileName: e.fileName,
    size: e.uncompressedSize,
    compressedSize: e.compressedSize,
    modTime: e.getLastModDate(),
    crc32: e.crc32,
    isDirectory: e.fileName.endsWith('/')
  }))

  return {
    entries: info,
    readEntry: (name: string): Promise<Buffer | null> => {
      const entry = byName.get(name)
      if (!entry) return Promise.resolve(null)
      return new Promise((resolve, reject) => {
        zipFile.openReadStream(entry, (err, stream) => {
          if (err || !stream) return reject(err ?? new Error('no stream'))
          const chunks: Buffer[] = []
          stream.on('data', (c: Buffer) => chunks.push(c))
          stream.on('end', () => resolve(Buffer.concat(chunks)))
          stream.on('error', reject)
        })
      })
    },
    close: () =>
      new Promise<void>((resolve) => {
        zipFile.close()
        resolve()
      })
  }
}

function openZipFile(path: string): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    // `lazyEntries: true` means we drive entry emission with
    // `readEntry()` calls instead of yauzl spraying them all out — that
    // keeps backpressure under our control and avoids buffering large
    // central directories into Node's event loop in one tick.
    yauzl.open(path, { lazyEntries: true, autoClose: false }, (err, zip) => {
      if (err || !zip) return reject(err ?? new Error('Failed to open APK'))
      resolve(zip)
    })
  })
}

function openZipFileFromBuffer(buffer: Buffer): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, autoClose: false }, (err, zip) => {
      if (err || !zip) return reject(err ?? new Error('Failed to open APK buffer'))
      resolve(zip)
    })
  })
}
