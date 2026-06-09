import { createHash } from 'node:crypto'
import type { ApkNativeLib } from '@shared/types'
import type { OpenZipResult } from './zip'

const MAX_SYMBOL_SCAN_BYTES = 16 * 1024 * 1024

export async function collectNativeLibs(zip: OpenZipResult): Promise<ApkNativeLib[]> {
  const byAbi = new Map<string, ApkNativeLib>()
  const entries = zip.entries.filter(
    (entry) => !entry.isDirectory && /^lib\/[^/]+\/[^/]+\.so$/i.test(entry.fileName)
  )

  for (const entry of entries) {
    const parts = entry.fileName.split('/')
    const abi = parts[1]!
    const name = parts[parts.length - 1]!
    let bucket = byAbi.get(abi)
    if (!bucket) {
      bucket = { abi, files: [] }
      byAbi.set(abi, bucket)
    }

    const buf = await zip.readEntry(entry.fileName).catch(() => null)
    const signals = buf ? scanNativeLibrary(name, buf) : { sha256: undefined, symbols: [], riskTags: [] }
    bucket.files.push({
      name,
      size: entry.size,
      sha256: signals.sha256,
      symbols: signals.symbols,
      riskTags: signals.riskTags
    })
  }

  return [...byAbi.values()]
    .map((group) => ({
      ...group,
      files: group.files.sort((a, b) => a.name.localeCompare(b.name))
    }))
    .sort((a, b) => a.abi.localeCompare(b.abi))
}

function scanNativeLibrary(
  name: string,
  buf: Buffer
): { sha256: string; symbols: string[]; riskTags: string[] } {
  const sha256 = createHash('sha256').update(buf).digest('hex').toUpperCase()
  const text =
    buf.length > MAX_SYMBOL_SCAN_BYTES
      ? buf.subarray(0, MAX_SYMBOL_SCAN_BYTES).toString('latin1')
      : buf.toString('latin1')

  const symbols = [
    'JNI_OnLoad',
    'Java_',
    'SSL_read',
    'SSL_write',
    'SSL_CTX_set_custom_verify',
    'ptrace',
    'frida',
    'gum-js-loop',
    'substrate',
    'xposed',
    'magisk',
    'su'
  ].filter((needle) => text.includes(needle))

  const riskTags = new Set<string>()
  if (symbols.includes('JNI_OnLoad') || symbols.includes('Java_')) riskTags.add('JNI')
  if (/SSL_|boringssl|openssl/i.test(text)) riskTags.add('TLS/native crypto')
  if (/ptrace|TracerPid|anti.?debug/i.test(text)) riskTags.add('anti-debug')
  if (/frida|gum-js-loop|substrate|xposed/i.test(text)) riskTags.add('instrumentation detection')
  if (/magisk|\/system\/bin\/su|\/system\/xbin\/su/i.test(text)) riskTags.add('root detection')
  if (/jiagu|DexHelper|secneo|bangcle|libprotect|protectClass/i.test(`${name}\n${text}`)) {
    riskTags.add('packer/protector')
  }
  if (/libflutter|FlutterJNI|Dart_/i.test(`${name}\n${text}`)) riskTags.add('Flutter engine')

  return { sha256, symbols: symbols.slice(0, 8), riskTags: [...riskTags] }
}
