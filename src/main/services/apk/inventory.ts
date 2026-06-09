import type {
  ApkFileInventory,
  ApkFileInventoryCategory,
  ApkFileInventoryEntry
} from '@shared/types'
import type { ZipEntryInfo } from './zip'

const CATEGORY_LABELS: Record<string, string> = {
  manifest: 'Manifest',
  dex: 'DEX bytecode',
  native: 'Native libraries',
  resources: 'Android resources',
  assets: 'Assets',
  certificates: 'Signing metadata',
  kotlin: 'Kotlin metadata',
  metadata: 'Package metadata',
  other: 'Other'
}

export function buildFileInventory(entries: ZipEntryInfo[]): ApkFileInventory {
  const files = entries.filter((entry) => !entry.isDirectory)
  const categoryMap = new Map<string, ApkFileInventoryCategory>()
  const largestFiles: ApkFileInventoryEntry[] = []

  let totalUncompressedBytes = 0
  let totalCompressedBytes = 0

  for (const entry of files) {
    const category = categorizeEntry(entry.fileName)
    totalUncompressedBytes += entry.size
    totalCompressedBytes += entry.compressedSize

    const bucket =
      categoryMap.get(category) ??
      {
        id: category,
        label: CATEGORY_LABELS[category] ?? category,
        count: 0,
        size: 0,
        compressedSize: 0
      }
    bucket.count += 1
    bucket.size += entry.size
    bucket.compressedSize += entry.compressedSize
    categoryMap.set(category, bucket)

    largestFiles.push({
      path: entry.fileName,
      category,
      size: entry.size,
      compressedSize: entry.compressedSize
    })
  }

  largestFiles.sort((a, b) => b.size - a.size)

  return {
    totalEntries: files.length,
    totalUncompressedBytes,
    totalCompressedBytes,
    compressionRatio:
      totalUncompressedBytes === 0
        ? 0
        : Number((totalCompressedBytes / totalUncompressedBytes).toFixed(3)),
    categories: [...categoryMap.values()].sort((a, b) => b.size - a.size),
    largestFiles: largestFiles.slice(0, 25)
  }
}

function categorizeEntry(path: string): string {
  const lower = path.toLowerCase()
  if (lower === 'androidmanifest.xml') return 'manifest'
  if (/^classes\d*\.dex$/.test(lower)) return 'dex'
  if (lower.startsWith('lib/') && lower.endsWith('.so')) return 'native'
  if (lower.startsWith('res/') || lower === 'resources.arsc') return 'resources'
  if (lower.startsWith('assets/')) return 'assets'
  if (lower.startsWith('meta-inf/')) return 'certificates'
  if (lower.startsWith('kotlin/') || lower.endsWith('.kotlin_module')) return 'kotlin'
  if (lower.startsWith('webview_licenses') || lower.startsWith('play-services')) return 'metadata'
  return 'other'
}
