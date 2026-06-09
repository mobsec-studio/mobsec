import { createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs'
import { readdir, rename, rm, stat } from 'node:fs/promises'
import { get as httpGet } from 'node:http'
import { get as httpsGet } from 'node:https'
import { basename, extname, join } from 'node:path'
import { homedir, tmpdir } from 'node:os'
import { pipeline } from 'node:stream/promises'
import yauzl from 'yauzl'
import type {
  Device,
  FirmwareCandidate,
  FirmwareDownloadOptions,
  FirmwareDownloadResult,
  FirmwareExtractedImage,
  FirmwareSearchResult,
  MagiskFlashOptions,
  MagiskFlashPartition,
  MagiskPatchedImageCandidate,
  MagiskPatchedImageSearchResult,
  MagiskRootStartOptions,
  RootActionResult,
  RootRebootMode,
  RootTargetKind,
  RootToolResult,
  RootWorkflow
} from '@shared/types'
import {
  getProp,
  launchApp,
  pullFile,
  pushFile,
  quoteShellArg,
  reboot,
  rebootTo,
  root as adbRoot,
  runFastboot,
  shell
} from './adb'
import { deviceService } from './device'
import { getPaths } from '../utils/paths'

const GOOGLE_PIXEL_FACTORY_IMAGES_URL = 'https://developers.google.com/android/images'
const MAGISK_PACKAGE = 'com.topjohnwu.magisk'
const PARTITIONS: MagiskFlashPartition[] = ['boot', 'init_boot', 'recovery']
const MAGISK_PATCHED_IMAGE_RE = /^magisk_patched.*\.img$/i
const FASTBOOT_WAIT_MS = 60_000

class OtherToolsService {
  async rootCheck(): Promise<RootToolResult> {
    await deviceService.refresh()
    const active = requireActiveOnlineDevice()
    const refreshed = (await deviceService.reprobe(active.serial)) ?? active
    const targetKind = await detectRootTargetKind(refreshed)
    return buildRootResult(refreshed, targetKind, false, false, rootStatusMessage(refreshed))
  }

  async tryAdbRoot(): Promise<RootToolResult> {
    await deviceService.refresh()
    const active = requireActiveOnlineDevice()
    const targetKind = await detectRootTargetKind(active)
    if (targetKind === 'real-device' && !active.capabilities.userdebugBuild) {
      return buildRootResult(
        active,
        targetKind,
        true,
        false,
        'ADB root is not available for normal production phones. Use the Magisk workflow below.'
      )
    }

    try {
      const result = await adbRoot(active.serial)
      await sleep(1500)
      await deviceService.refresh()
      const refreshed =
        (await deviceService.reprobe(active.serial)) ?? deviceService.getActive() ?? active
      const nextKind = await detectRootTargetKind(refreshed)
      return buildRootResult(
        refreshed,
        nextKind,
        true,
        true,
        result.restarted ? 'adbd restarted as root.' : 'adbd is already running as root.'
      )
    } catch (err) {
      await deviceService.refresh()
      const refreshed =
        (await deviceService.reprobe(active.serial)) ?? deviceService.getActive() ?? active
      const nextKind = await detectRootTargetKind(refreshed)
      const message = err instanceof Error ? err.message : String(err)
      return buildRootResult(refreshed, nextKind, true, false, `adb root failed: ${message}`)
    }
  }

  async rebootForRoot(mode: RootRebootMode): Promise<RootActionResult> {
    await deviceService.refresh()
    if (mode === 'system') {
      const fastbootDevices = await listFastbootSerials().catch(() => [])
      if (fastbootDevices.length === 1) {
        await runFastboot(['-s', fastbootDevices[0]!, 'reboot'], 30_000)
        return {
          message: `Fastboot reboot command sent to ${fastbootDevices[0]}.`,
          details: ['Wait for Android to boot, then refresh the device list and run Root Check.'],
          fastbootDevices
        }
      }
      const active = requireActiveOnlineDevice()
      await reboot(active.serial)
      return {
        message: `Reboot command sent to ${active.label}.`,
        details: ['Wait for Android to boot, then refresh the device list and run Root Check.']
      }
    }

    const active = requireActiveOnlineDevice()
    const targetKind = await detectRootTargetKind(active)
    await rebootTo(active.serial, mode)
    return {
      message: `Rebooting ${active.label} to ${mode}.`,
      details:
        mode === 'bootloader'
          ? [
              'Keep the phone connected over USB.',
              'When it reaches the bootloader/fastboot screen, use Detect fastboot device.',
              targetKind === 'real-device'
                ? 'Fastboot flashing requires an unlocked bootloader and the correct Magisk-patched image.'
                : 'Emulators usually do not need Magisk; adb root is the preferred path.'
            ]
          : [
              'Keep the phone connected over USB.',
              'Recovery is useful for manual troubleshooting or custom-recovery workflows.',
              'For modern Magisk patch flashing, bootloader/fastboot mode is usually required.'
            ]
    }
  }

  async listFastbootDevices(): Promise<RootActionResult> {
    const devices = await listFastbootSerials()
    return {
      message:
        devices.length === 0
          ? 'No fastboot devices detected.'
          : `Detected ${devices.length} fastboot device(s).`,
      details:
        devices.length === 0
          ? [
              'Connect the phone over USB.',
              'Reboot to bootloader/fastboot mode.',
              'Install the Android platform-tools USB driver if Windows does not see the device.'
            ]
          : devices.map((serial) => `Fastboot: ${serial}`),
      fastbootDevices: devices
    }
  }

  async flashMagiskPatchedImage(options: MagiskFlashOptions): Promise<RootActionResult> {
    const { imagePath, partition } = validateMagiskFlashRequest(
      options.imagePath,
      options.partition,
      options.confirmed
    )

    const devices = await listFastbootSerials()
    if (devices.length === 0) {
      throw new Error(
        'No fastboot device detected. Reboot the phone to bootloader and connect USB.'
      )
    }
    if (devices.length > 1) {
      throw new Error(
        'Multiple fastboot devices detected. Connect only the target phone and retry.'
      )
    }

    const serial = devices[0]!
    const output = await flashPatchedImage(serial, partition, imagePath)
    const patchedImage = await buildHostPatchedCandidate(imagePath)

    return {
      message: `Flashed ${partition} on ${serial}.`,
      details: [
        output || 'fastboot completed successfully.',
        'Use Reboot system, then open Magisk on the phone to finish any required setup.',
        'After Android boots, reconnect ADB and run Root Check again.'
      ],
      fastbootDevices: devices,
      patchedImage,
      partition
    }
  }

  async detectMagiskPatchedImages(): Promise<MagiskPatchedImageSearchResult> {
    return detectMagiskPatchedImages()
  }

  async startMagiskRoot(options: MagiskRootStartOptions): Promise<RootActionResult> {
    const partition = normalizePartition(options.partition)
    if (!options.confirmed) {
      throw new Error('Confirm that the image and partition are correct before rooting.')
    }

    const selected = await resolveMagiskPatchedImage(options.imagePath)
    const imagePath = selected.path
    const details: string[] = [
      selected.pulledFromDevice
        ? `Pulled Magisk image from ${selected.displayPath}.`
        : `Using Magisk image ${selected.displayPath}.`
    ]

    let rebootedToBootloader = false
    let devices = await listFastbootSerials()
    if (devices.length === 0) {
      await deviceService.refresh()
      const active = deviceService.getActive()
      if (!active || active.state !== 'online') {
        throw new Error(
          'No fastboot device and no online ADB device. Connect the phone over USB, then retry.'
        )
      }
      await rebootTo(active.serial, 'bootloader')
      rebootedToBootloader = true
      details.push(`Rebooted ${active.label} to bootloader; waiting for fastboot.`)
      devices = await waitForFastbootSerials(FASTBOOT_WAIT_MS)
    }

    if (devices.length === 0) {
      throw new Error('Timed out waiting for fastboot. Keep the phone connected over USB.')
    }
    if (devices.length > 1) {
      throw new Error(
        'Multiple fastboot devices detected. Connect only the target phone and retry.'
      )
    }

    const serial = devices[0]!
    details.push(await flashPatchedImage(serial, partition, imagePath))

    if (options.rebootAfterFlash) {
      const rebootResult = await runFastboot(['-s', serial, 'reboot'], 30_000)
      const output = (rebootResult.stdout + rebootResult.stderr).trim()
      if (rebootResult.exitCode !== 0 || /failed|error/i.test(output)) {
        throw new Error(output || 'fastboot reboot failed')
      }
      details.push(output || 'Rebooted Android from fastboot.')
    } else {
      details.push('Phone was left in fastboot. Use Reboot system when ready.')
    }

    details.push('Open Magisk after Android boots to finish any required setup.')
    details.push('Reconnect ADB and run Root Check again after boot completes.')

    return {
      message: `Started Magisk root flow on ${serial}.`,
      details: rebootedToBootloader
        ? details
        : ['Fastboot device was already connected.', ...details],
      fastbootDevices: devices,
      patchedImage: selected,
      partition
    }
  }

  async findFirmwareImages(): Promise<FirmwareSearchResult> {
    await deviceService.refresh()
    const active = requireActiveOnlineDevice()
    const targetKind = await detectRootTargetKind(active)
    const recommendedPartition = recommendedPartitionFor(active)
    const deviceCodename = await readDeviceCodename(active)
    const buildId = await getProp(active.serial, 'ro.build.id').catch(() => '')
    const manufacturer = (active.manufacturer ?? '').toLowerCase()
    const brand = (active.brand ?? '').toLowerCase()
    const looksPixel =
      targetKind === 'real-device' &&
      deviceCodename.length > 0 &&
      (manufacturer.includes('google') ||
        brand.includes('google') ||
        active.label.toLowerCase().includes('pixel'))

    if (!looksPixel) {
      return {
        provider: 'unsupported',
        deviceCodename: deviceCodename || null,
        buildId: buildId || null,
        recommendedPartition,
        candidates: [],
        message:
          'Automatic firmware lookup currently supports official Google Pixel factory images. Use a manual official firmware URL for this device.',
        warnings: [
          'Only use firmware from the device manufacturer or carrier.',
          'The downloaded image must match the exact installed build before Magisk patching.'
        ]
      }
    }

    const html = await fetchText(GOOGLE_PIXEL_FACTORY_IMAGES_URL)
    const all = parseGooglePixelFactoryCandidates(html)
    const codename = deviceCodename.toLowerCase()
    const build = buildId.toLowerCase()
    const candidates = all
      .filter((candidate) => candidate.deviceCodename.toLowerCase() === codename)
      .map((candidate) => ({
        ...candidate,
        exactBuildMatch: build.length > 0 && candidate.buildId.toLowerCase() === build
      }))
      .sort((a, b) => Number(b.exactBuildMatch) - Number(a.exactBuildMatch))
      .slice(0, 8)

    const exact = candidates.find((candidate) => candidate.exactBuildMatch)
    return {
      provider: 'google-pixel',
      deviceCodename,
      buildId: buildId || null,
      recommendedPartition,
      candidates,
      message: exact
        ? `Found an exact official factory image for ${deviceCodename} ${buildId}.`
        : candidates.length > 0
          ? `Found official Pixel images for ${deviceCodename}, but not an exact ${buildId || 'current build'} match.`
          : `No official Pixel factory image link was found for ${deviceCodename}.`,
      warnings: [
        'Google states factory images can erase device data and are subject to Google terms.',
        'For Magisk patching, use the factory image that exactly matches the build currently installed on the phone.'
      ],
      sourcePage: GOOGLE_PIXEL_FACTORY_IMAGES_URL
    }
  }

  async downloadFirmwareImage(options: FirmwareDownloadOptions): Promise<FirmwareDownloadResult> {
    if (!options.acceptedTerms) {
      throw new Error('Acknowledge the firmware terms and risk before downloading.')
    }

    await deviceService.refresh()
    const active = requireActiveOnlineDevice()
    const search = await this.findFirmwareImages()
    const selected = selectFirmwareCandidate(search, options.url)
    const firmwareDir = join(getPaths().tools, 'firmware-images')
    mkdirSync(firmwareDir, { recursive: true })

    const workDir = join(
      firmwareDir,
      `${selected.deviceCodename || 'device'}-${selected.buildId || 'manual'}-${Date.now()}`
    )
    mkdirSync(workDir, { recursive: true })

    const downloadPath = join(workDir, selected.filename)
    await download(selected.url, downloadPath)
    const extractedImages = await extractStockImages(downloadPath, workDir)
    const recommendedPartition = search.recommendedPartition
    const recommended =
      extractedImages.find((image) => image.partition === recommendedPartition) ??
      extractedImages.find((image) => image.partition === 'init_boot') ??
      extractedImages.find((image) => image.partition === 'boot') ??
      extractedImages[0] ??
      null

    let pushedToDevicePath: string | null = null
    let magiskLaunched = false
    if (options.pushToDevice && recommended) {
      const remotePath = `/sdcard/Download/${basename(recommended.path)}`
      await pushFile(active.serial, recommended.path, remotePath)
      pushedToDevicePath = remotePath
      magiskLaunched = await launchMagisk(active.serial)
    }

    return {
      candidate: selected,
      downloadPath,
      workDir,
      extractedImages,
      recommendedPartition,
      recommendedImagePath: recommended?.path ?? null,
      pushedToDevicePath,
      magiskLaunched,
      message: `Downloaded and extracted ${extractedImages.length} stock image(s).`,
      details: [
        `Factory ZIP: ${downloadPath}`,
        ...extractedImages.map(
          (image) => `${image.partition}: ${image.path} (${formatBytes(image.sizeBytes)})`
        ),
        pushedToDevicePath
          ? `Pushed ${recommended?.partition ?? 'image'} to ${pushedToDevicePath} for Magisk patching.`
          : 'Stock image was not pushed to the phone.',
        magiskLaunched
          ? 'Magisk was opened on the device.'
          : 'Open Magisk manually if it is installed.'
      ]
    }
  }
}

function validateMagiskFlashRequest(
  rawImagePath: string,
  rawPartition: MagiskFlashPartition,
  confirmed: boolean
): { imagePath: string; partition: MagiskFlashPartition } {
  const imagePath = rawImagePath.trim()
  const partition = normalizePartition(rawPartition)
  if (!confirmed) {
    throw new Error('Confirm that the image and partition are correct before flashing.')
  }
  validateMagiskImagePath(imagePath)
  return { imagePath, partition }
}

function validateMagiskImagePath(imagePath: string): void {
  if (!imagePath || !existsSync(imagePath)) {
    throw new Error('Select an existing Magisk-patched .img file.')
  }
  if (extname(imagePath).toLowerCase() !== '.img') {
    throw new Error('Magisk patched image must be an .img file.')
  }
  const info = statSync(imagePath)
  if (!info.isFile() || info.size <= 0) {
    throw new Error('Magisk patched image must be a non-empty .img file.')
  }
}

async function flashPatchedImage(
  serial: string,
  partition: MagiskFlashPartition,
  imagePath: string
): Promise<string> {
  validateMagiskImagePath(imagePath)
  const flash = await runFastboot(['-s', serial, 'flash', partition, imagePath], 180_000)
  const output = (flash.stdout + flash.stderr).trim()
  if (flash.exitCode !== 0 || /failed|error/i.test(output)) {
    throw new Error(output || `fastboot flash ${partition} failed`)
  }
  return output || 'fastboot completed successfully.'
}

async function resolveMagiskPatchedImage(
  explicitPath: string | undefined
): Promise<MagiskPatchedImageCandidate> {
  const imagePath = explicitPath?.trim()
  if (imagePath) {
    validateMagiskImagePath(imagePath)
    return buildHostPatchedCandidate(imagePath)
  }

  const search = await detectMagiskPatchedImages()
  if (!search.selected) {
    throw new Error(`${search.message} Use Select patched image or copy it to Downloads.`)
  }
  validateMagiskImagePath(search.selected.path)
  return search.selected
}

async function detectMagiskPatchedImages(): Promise<MagiskPatchedImageSearchResult> {
  const details: string[] = []
  const [hostCandidates, deviceCandidates] = await Promise.all([
    findHostMagiskPatchedImages(details),
    findDeviceMagiskPatchedImages(details)
  ])
  const candidates = dedupeMagiskCandidates([...deviceCandidates, ...hostCandidates]).sort(
    (a, b) => b.modifiedAt - a.modifiedAt || b.sizeBytes - a.sizeBytes
  )
  const selected = candidates[0] ?? null

  return {
    candidates,
    selected,
    message: selected
      ? `Loaded ${selected.filename} from ${selected.source === 'device' ? 'phone Downloads' : 'host storage'}.`
      : 'No magisk_patched*.img file was found.',
    details:
      candidates.length > 0
        ? [...details, `Selected ${selected?.displayPath ?? 'none'} as the newest patched image.`]
        : details
  }
}

async function findHostMagiskPatchedImages(
  details: string[]
): Promise<MagiskPatchedImageCandidate[]> {
  const roots = uniqueSearchRoots([
    { path: patchedImageCacheDir(), depth: 2, label: 'app patched-image cache' },
    { path: firmwareImageDir(), depth: 4, label: 'app firmware workspace' },
    { path: join(homedir(), 'Downloads'), depth: 2, label: 'host Downloads' },
    { path: join(homedir(), 'Desktop'), depth: 1, label: 'host Desktop' }
  ])
  const candidates: MagiskPatchedImageCandidate[] = []
  for (const root of roots) {
    const found = await scanHostMagiskPatchedImages(root.path, root.depth)
    details.push(`Host search (${root.label}): ${found.length} candidate(s).`)
    candidates.push(...found)
  }
  return candidates
}

async function scanHostMagiskPatchedImages(
  root: string,
  maxDepth: number
): Promise<MagiskPatchedImageCandidate[]> {
  const rootStats = await stat(root).catch(() => null)
  if (!rootStats?.isDirectory()) return []

  const candidates: MagiskPatchedImageCandidate[] = []
  const walk = async (dir: string, depth: number): Promise<void> => {
    if (candidates.length >= 80) return
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (candidates.length >= 80) return
      const fullPath = join(dir, entry.name)
      if (entry.isFile() && MAGISK_PATCHED_IMAGE_RE.test(entry.name)) {
        const info = await stat(fullPath).catch(() => null)
        if (info?.isFile() && info.size > 0) {
          candidates.push({
            source: 'host',
            path: fullPath,
            displayPath: fullPath,
            filename: entry.name,
            sizeBytes: info.size,
            modifiedAt: info.mtimeMs,
            pulledFromDevice: false
          })
        }
        continue
      }
      if (entry.isDirectory() && depth < maxDepth && !isIgnoredSearchDir(entry.name)) {
        await walk(fullPath, depth + 1)
      }
    }
  }

  await walk(root, 0)
  return candidates
}

async function findDeviceMagiskPatchedImages(
  details: string[]
): Promise<MagiskPatchedImageCandidate[]> {
  await deviceService.refresh().catch(() => undefined)
  const active = deviceService.getActive()
  if (!active || active.state !== 'online') {
    details.push('Phone search skipped: no active online ADB device.')
    return []
  }

  const command =
    "find /sdcard/Download /storage/emulated/0/Download -maxdepth 2 -type f -name 'magisk_patched*.img' 2>/dev/null | head -20"
  const result = await shell(active.serial, command).catch((err: unknown) => {
    details.push(`Phone search failed: ${err instanceof Error ? err.message : String(err)}`)
    return null
  })
  if (!result) return []

  const remotePaths = Array.from(
    new Set(
      result.stdout
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => MAGISK_PATCHED_IMAGE_RE.test(basename(line)))
    )
  )

  if (remotePaths.length === 0) {
    details.push(`Phone search (${active.label}): no patched images in Downloads.`)
    return []
  }

  mkdirSync(patchedImageCacheDir(), { recursive: true })
  const candidates: MagiskPatchedImageCandidate[] = []
  for (const remotePath of remotePaths) {
    const candidate = await pullDevicePatchedImage(active.serial, remotePath).catch(
      (err: unknown) => {
        details.push(
          `Could not pull ${remotePath}: ${err instanceof Error ? err.message : String(err)}`
        )
        return null
      }
    )
    if (candidate) candidates.push(candidate)
  }
  details.push(`Phone search (${active.label}): ${candidates.length} candidate(s) pulled.`)
  return candidates
}

async function pullDevicePatchedImage(
  serial: string,
  remotePath: string
): Promise<MagiskPatchedImageCandidate> {
  const remoteStats = await statRemoteFile(serial, remotePath).catch(() => null)
  const filename = sanitizeHostFilename(basename(remotePath) || 'magisk_patched.img')
  const targetPath = join(
    patchedImageCacheDir(),
    `${sanitizeHostFilename(serial)}-${Date.now()}-${filename}`
  )
  const pull = await pullFile(serial, remotePath, targetPath)
  const output = pull.stdout + pull.stderr
  if (pull.exitCode !== 0 || /failed|error/i.test(output)) {
    throw new Error(output.trim() || `adb pull failed for ${remotePath}`)
  }
  const localStats = await stat(targetPath)
  return {
    source: 'device',
    path: targetPath,
    displayPath: remotePath,
    filename,
    sizeBytes: remoteStats?.sizeBytes ?? localStats.size,
    modifiedAt: remoteStats?.modifiedAt ?? localStats.mtimeMs,
    pulledFromDevice: true
  }
}

async function statRemoteFile(
  serial: string,
  remotePath: string
): Promise<{ sizeBytes: number; modifiedAt: number }> {
  const result = await shell(serial, `stat -c '%s %Y' ${quoteShellArg(remotePath)}`)
  const match = result.stdout.trim().match(/(\d+)\s+(\d+)/)
  if (!match?.[1] || !match[2]) throw new Error(`Could not stat ${remotePath}`)
  return {
    sizeBytes: Number(match[1]),
    modifiedAt: Number(match[2]) * 1000
  }
}

async function buildHostPatchedCandidate(imagePath: string): Promise<MagiskPatchedImageCandidate> {
  const info = await stat(imagePath)
  return {
    source: 'host',
    path: imagePath,
    displayPath: imagePath,
    filename: basename(imagePath),
    sizeBytes: info.size,
    modifiedAt: info.mtimeMs,
    pulledFromDevice: false
  }
}

function uniqueSearchRoots(
  roots: Array<{ path: string; depth: number; label: string }>
): Array<{ path: string; depth: number; label: string }> {
  const seen = new Set<string>()
  return roots.filter((root) => {
    const key = root.path.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function dedupeMagiskCandidates(
  candidates: MagiskPatchedImageCandidate[]
): MagiskPatchedImageCandidate[] {
  const seen = new Set<string>()
  const out: MagiskPatchedImageCandidate[] = []
  for (const candidate of candidates) {
    const key = candidate.path.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(candidate)
  }
  return out
}

function isIgnoredSearchDir(name: string): boolean {
  return (
    name === 'node_modules' ||
    name === '.git' ||
    name === 'out' ||
    name === 'dist' ||
    name === 'build'
  )
}

function sanitizeHostFilename(value: string): string {
  const invalid = '<>:"/\\|?*'
  const sanitized = Array.from(value)
    .map((char) => (char.charCodeAt(0) < 32 || invalid.includes(char) ? '_' : char))
    .join('')
    .trim()
  return sanitized.slice(0, 120) || 'magisk_patched.img'
}

function firmwareImageDir(): string {
  return join(getPaths().tools, 'firmware-images')
}

function patchedImageCacheDir(): string {
  return join(firmwareImageDir(), 'magisk-patched')
}

function selectFirmwareCandidate(
  search: FirmwareSearchResult,
  manualUrl: string | undefined
): FirmwareCandidate {
  if (manualUrl?.trim()) {
    const url = validateFirmwareUrl(manualUrl.trim())
    const name = basename(new URL(url).pathname) || `firmware-${Date.now()}.zip`
    return {
      provider: 'manual-url',
      deviceCodename: search.deviceCodename ?? 'manual',
      buildId: search.buildId ?? 'manual',
      filename: name,
      url,
      exactBuildMatch: false,
      sourcePage: url
    }
  }
  const exact = search.candidates.find((candidate) => candidate.exactBuildMatch)
  const selected = exact ?? search.candidates[0]
  if (!selected) {
    throw new Error('No firmware candidate found. Paste a manual official firmware URL.')
  }
  return selected
}

function validateFirmwareUrl(raw: string): string {
  const url = new URL(raw)
  if (url.protocol !== 'https:') throw new Error('Firmware downloads must use HTTPS.')
  if (!url.pathname.toLowerCase().endsWith('.zip')) {
    throw new Error('Firmware URL must point to a .zip file.')
  }
  return url.toString()
}

function parseGooglePixelFactoryCandidates(html: string): FirmwareCandidate[] {
  const seen = new Set<string>()
  const out: FirmwareCandidate[] = []
  const re = /https:\/\/dl\.google\.com\/dl\/android\/aosp\/([^"'<>]+?-factory-[^"'<>]+?\.zip)/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    const filename = match[1]
    if (!filename || seen.has(filename)) continue
    const parsed = filename.match(/^([a-z0-9_]+)-(.+?)-factory-[a-f0-9]+\.zip$/i)
    if (!parsed?.[1] || !parsed[2]) continue
    seen.add(filename)
    out.push({
      provider: 'google-pixel',
      deviceCodename: parsed[1],
      buildId: parsed[2].toUpperCase(),
      filename,
      url: `https://dl.google.com/dl/android/aosp/${filename}`,
      exactBuildMatch: false,
      sourcePage: GOOGLE_PIXEL_FACTORY_IMAGES_URL
    })
  }
  return out
}

async function fetchText(url: string): Promise<string> {
  const file = join(tmpdir(), `mobsec-text-${Date.now()}.html`)
  await download(url, file)
  const { readFile } = await import('node:fs/promises')
  try {
    return await readFile(file, 'utf8')
  } finally {
    await rm(file, { force: true }).catch(() => undefined)
  }
}

async function download(url: string, target: string): Promise<void> {
  const stagingFile = join(tmpdir(), `mobsec-${Date.now()}-${basename(target)}`)
  let redirects = 0
  let currentUrl = validateDownloadUrl(url)

  for (;;) {
    const result = await new Promise<{ kind: 'redirect'; to: string } | { kind: 'ok' }>(
      (resolve, reject) => {
        const client = currentUrl.startsWith('https:') ? httpsGet : httpGet
        const req = client(currentUrl, (res) => {
          const status = res.statusCode ?? 0
          if (status >= 300 && status < 400 && res.headers.location) {
            res.resume()
            resolve({ kind: 'redirect', to: res.headers.location })
            return
          }
          if (status !== 200) {
            res.resume()
            reject(new Error(`HTTP ${status} fetching ${currentUrl}`))
            return
          }
          const out = createWriteStream(stagingFile)
          pipeline(res, out)
            .then(() => resolve({ kind: 'ok' }))
            .catch(reject)
        })
        req.on('error', reject)
      }
    )

    if (result.kind === 'redirect') {
      redirects += 1
      if (redirects > 5) throw new Error('Too many redirects')
      currentUrl = validateDownloadUrl(new URL(result.to, currentUrl).toString())
      continue
    }

    if (statSync(stagingFile).size === 0) throw new Error('Downloaded file is empty')
    await rename(stagingFile, target)
    return
  }
}

function validateDownloadUrl(raw: string): string {
  const url = new URL(raw)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Unsupported download URL.')
  }
  return url.toString()
}

async function extractStockImages(
  factoryZipPath: string,
  workDir: string
): Promise<FirmwareExtractedImage[]> {
  const outerEntries = await listZipEntries(factoryZipPath)
  const images: FirmwareExtractedImage[] = []

  for (const partition of PARTITIONS) {
    const direct = outerEntries.find(
      (entry) => basename(entry.name).toLowerCase() === `${partition}.img`
    )
    if (direct) {
      images.push(await extractImageEntry(factoryZipPath, direct.name, workDir, partition))
    }
  }
  if (images.length > 0) return images

  const nested = outerEntries.find((entry) => /^image-[^/\\]+\.zip$/i.test(basename(entry.name)))
  if (!nested) {
    throw new Error('Could not find image-*.zip or boot images inside the factory ZIP.')
  }

  const nestedPath = join(workDir, basename(nested.name))
  await extractEntry(factoryZipPath, nested.name, nestedPath)
  const nestedEntries = await listZipEntries(nestedPath)
  for (const partition of PARTITIONS) {
    const entry = nestedEntries.find(
      (item) => basename(item.name).toLowerCase() === `${partition}.img`
    )
    if (entry) {
      images.push(await extractImageEntry(nestedPath, entry.name, workDir, partition))
    }
  }

  if (images.length === 0) {
    throw new Error('No boot.img, init_boot.img, or recovery.img found in the factory image.')
  }
  return images
}

async function extractImageEntry(
  zipPath: string,
  entryName: string,
  workDir: string,
  partition: MagiskFlashPartition
): Promise<FirmwareExtractedImage> {
  const target = join(workDir, `${partition}.img`)
  await extractEntry(zipPath, entryName, target)
  return {
    partition,
    path: target,
    filename: basename(target),
    sizeBytes: statSync(target).size
  }
}

interface ZipEntryInfo {
  name: string
}

function listZipEntries(zipPath: string): Promise<ZipEntryInfo[]> {
  return new Promise((resolve, reject) => {
    const entries: ZipEntryInfo[] = []
    yauzl.open(zipPath, { lazyEntries: true, autoClose: true }, (err, zip) => {
      if (err || !zip) {
        reject(err ?? new Error(`Could not open ${zipPath}`))
        return
      }
      zip.readEntry()
      zip.on('entry', (entry: yauzl.Entry) => {
        entries.push({ name: entry.fileName })
        zip.readEntry()
      })
      zip.on('end', () => resolve(entries))
      zip.on('error', reject)
    })
  })
}

function extractEntry(zipPath: string, entryName: string, targetPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true, autoClose: true }, (err, zip) => {
      if (err || !zip) {
        reject(err ?? new Error(`Could not open ${zipPath}`))
        return
      }
      zip.readEntry()
      zip.on('entry', (entry: yauzl.Entry) => {
        if (entry.fileName !== entryName) {
          zip.readEntry()
          return
        }
        zip.openReadStream(entry, (streamErr, stream) => {
          if (streamErr || !stream) {
            reject(streamErr ?? new Error(`Could not read ${entryName}`))
            return
          }
          pipeline(stream, createWriteStream(targetPath)).then(resolve).catch(reject)
        })
      })
      zip.on('end', () => reject(new Error(`Entry ${entryName} not found in ${zipPath}`)))
      zip.on('error', reject)
    })
  })
}

async function readDeviceCodename(device: Device): Promise<string> {
  const candidates = await Promise.all([
    getProp(device.serial, 'ro.product.device').catch(() => ''),
    getProp(device.serial, 'ro.build.product').catch(() => ''),
    getProp(device.serial, 'ro.product.name').catch(() => device.product ?? '')
  ])
  return candidates.find((value) => /^[A-Za-z0-9_]+$/.test(value)) ?? ''
}

function recommendedPartitionFor(device: Device): MagiskFlashPartition {
  return (device.sdkLevel ?? 0) >= 33 ? 'init_boot' : 'boot'
}

async function launchMagisk(serial: string): Promise<boolean> {
  const installed = await shell(serial, `pm path ${MAGISK_PACKAGE}`).catch(() => null)
  if (!installed?.stdout.includes('package:')) return false
  try {
    await launchApp(serial, MAGISK_PACKAGE)
    return true
  } catch {
    return false
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = units[0]!
  for (let i = 1; i < units.length && value >= 1024; i += 1) {
    value /= 1024
    unit = units[i]!
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${unit}`
}

function requireActiveOnlineDevice(): Device {
  const active = deviceService.getActive()
  if (!active || active.state !== 'online') {
    throw new Error('No active online device.')
  }
  return active
}

async function detectRootTargetKind(device: Device): Promise<RootTargetKind> {
  if (device.transport === 'emulator' || device.serial.startsWith('emulator-')) return 'emulator'

  const [kernelQemu, bootQemu, productName, model, manufacturer] = await Promise.all([
    getProp(device.serial, 'ro.kernel.qemu').catch(() => ''),
    getProp(device.serial, 'ro.boot.qemu').catch(() => ''),
    getProp(device.serial, 'ro.product.name').catch(() => device.product ?? ''),
    getProp(device.serial, 'ro.product.model').catch(() => device.model ?? ''),
    getProp(device.serial, 'ro.product.manufacturer').catch(() => device.manufacturer ?? '')
  ])
  const combined = `${productName} ${model} ${manufacturer}`.toLowerCase()
  if (
    kernelQemu === '1' ||
    bootQemu === '1' ||
    /\b(sdk_gphone|sdk_phone|google_sdk|generic_x86|aosp_x86|emulator|genymotion|bluestacks|ldplayer|nox)\b/.test(
      combined
    )
  ) {
    return 'emulator'
  }
  return 'real-device'
}

function rootStatusMessage(device: Device): string {
  if (device.capabilities.rooted) {
    return device.capabilities.rootMethod === 'adb-root'
      ? 'This device can run privileged ADB workflows.'
      : 'Root access is available on this device.'
  }
  return 'Root access is not currently available on this device.'
}

function buildRootResult(
  device: Device,
  targetKind: RootTargetKind,
  attempted: boolean,
  succeeded: boolean,
  message: string
): RootToolResult {
  const caps = device.capabilities
  const details = [
    `Device: ${device.label}`,
    `Serial: ${device.serial}`,
    `Target: ${targetKind === 'emulator' ? 'emulator' : targetKind === 'real-device' ? 'real device' : 'unknown'}`,
    `Transport: ${device.transport}`,
    `Android: ${device.androidVersion ?? 'unknown'}${device.sdkLevel ? ` (API ${device.sdkLevel})` : ''}`,
    `Build: ${caps.userdebugBuild ? 'userdebug/eng' : 'user/unknown'}`,
    `Root method: ${caps.rootMethod ?? 'none'}`,
    `Magisk: ${caps.magiskInstalled ? 'detected' : 'not detected'}`
  ]
  const workflow = buildWorkflow(device, targetKind, attempted, succeeded)
  const nextSteps = caps.rooted
    ? [
        'Use Frida server, system CA install, and privileged ADB workflows from their dedicated sections.',
        'Refresh the device list after any reboot or root manager change.'
      ]
    : workflow.steps.map((step) => step.title)

  if (attempted && !succeeded && workflow.kind !== 'magisk-real-device') {
    nextSteps.unshift('adb root is rejected by most locked production builds.')
  }

  return {
    serial: device.serial,
    label: device.label,
    targetKind,
    rooted: caps.rooted,
    rootMethod: caps.rootMethod,
    userdebugBuild: caps.userdebugBuild,
    magiskInstalled: caps.magiskInstalled,
    canRunFridaServer: caps.canRunFridaServer,
    adbRootAttempted: attempted,
    adbRootSucceeded: succeeded,
    message,
    details,
    nextSteps,
    workflow
  }
}

function buildWorkflow(
  device: Device,
  targetKind: RootTargetKind,
  attempted: boolean,
  succeeded: boolean
): RootWorkflow {
  if (device.capabilities.rooted) {
    return {
      kind: 'already-rooted',
      title: 'Root already available',
      summary: 'The selected target already exposes root-capable workflows.',
      warnings: [],
      steps: [
        {
          id: 'verify',
          title: 'Verify privileged workflows',
          body: 'Run Frida server, system CA install, or root shell workflows from their dedicated sections.',
          state: 'done'
        }
      ]
    }
  }

  if (targetKind === 'emulator' || device.capabilities.userdebugBuild) {
    return {
      kind: 'adb-root',
      title: 'Use ADB root',
      summary:
        'This target looks like an emulator or debug build. ADB root is the correct low-risk path.',
      warnings:
        attempted && !succeeded
          ? [
              'The device rejected adb root. Check that the emulator image is not a production image.'
            ]
          : [],
      steps: [
        {
          id: 'adb-root',
          title: succeeded ? 'ADB root enabled' : 'Run Try adb root',
          body: 'The app will run adb root, wait for adbd to restart, and refresh device capabilities.',
          state: succeeded ? 'done' : 'ready'
        }
      ]
    }
  }

  const partitionHint = (device.sdkLevel ?? 0) >= 33 ? 'init_boot' : 'boot'
  return {
    kind: 'magisk-real-device',
    title: 'Use Magisk on a real device',
    summary:
      'This is a real production-style device. The safe workflow is Magisk patching with USB and bootloader/fastboot.',
    warnings: [
      'Unlocking the bootloader usually wipes the phone.',
      'Flashing the wrong image or partition can bootloop the device.',
      'Use an image from the exact same firmware/build currently installed on the phone.'
    ],
    steps: [
      {
        id: 'usb',
        title: 'Connect the phone over USB',
        body:
          device.transport === 'wifi'
            ? 'Wireless ADB is active, but rooting and fastboot require USB. Connect the phone with a reliable cable.'
            : 'Keep the phone connected by USB with USB debugging authorized.',
        state: device.transport === 'usb' ? 'done' : 'manual'
      },
      {
        id: 'boot-image',
        title: `Prepare the stock ${partitionHint}.img`,
        body: `Extract the exact stock ${partitionHint}.img from the matching factory image or OTA package for this build.`,
        state: 'manual'
      },
      {
        id: 'patch',
        title: 'Patch the image in Magisk',
        body: 'Install/open Magisk on the phone, choose Install, select the stock image, and let Magisk create magisk_patched*.img in Downloads.',
        state: 'manual'
      },
      {
        id: 'recover',
        title: 'Optional: reboot to recovery',
        body: 'Recovery mode is useful for manual/custom-recovery workflows. For fastboot flashing, reboot to bootloader afterward.',
        state: 'ready'
      },
      {
        id: 'bootloader',
        title: 'Reboot to bootloader',
        body: 'Fastboot flashing happens from the bootloader/fastboot screen while the phone is connected over USB.',
        state: 'ready'
      },
      {
        id: 'flash',
        title: `Flash the Magisk-patched image to ${partitionHint}`,
        body: 'Use Detect patched image to load magisk_patched*.img from the host or phone Downloads, choose the correct partition, confirm the risk box, then start Magisk root.',
        state: 'guarded'
      },
      {
        id: 'verify',
        title: 'Reboot and verify root',
        body: 'Boot Android, open Magisk to complete setup if prompted, then reconnect ADB and run Root Check.',
        state: 'manual'
      }
    ]
  }
}

function normalizePartition(partition: MagiskFlashPartition): MagiskFlashPartition {
  if (partition === 'boot' || partition === 'init_boot' || partition === 'recovery') {
    return partition
  }
  throw new Error('Unsupported partition.')
}

async function listFastbootSerials(): Promise<string[]> {
  const res = await runFastboot(['devices'], 10_000)
  return res.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/)[0] ?? '')
    .filter(Boolean)
}

async function waitForFastbootSerials(timeoutMs: number): Promise<string[]> {
  const start = Date.now()
  let lastSeen: string[] = []
  while (Date.now() - start < timeoutMs) {
    lastSeen = await listFastbootSerials().catch(() => [])
    if (lastSeen.length > 0) return lastSeen
    await sleep(1500)
  }
  return lastSeen
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const otherToolsService = new OtherToolsService()
