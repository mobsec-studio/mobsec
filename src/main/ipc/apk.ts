import extract from 'extract-zip'
import { ipcMain } from 'electron'
import { mkdtempSync, readFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { IPC } from '@shared/ipc-channels'
import { installApk, installMultipleApks } from '../services/adb'
import { apkAnalyzerService } from '../services/apk-analyzer'
import { jadxService } from '../services/jadx'
import { deviceService } from '../services/device'
import { fridaService } from '../services/frida'
import { getLogger } from '../utils/logger'
import { getPaths } from '../utils/paths'
import { dirname, join, resolve as resolvePath } from 'node:path'
import { existsSync, readdirSync } from 'node:fs'
import { safe } from '../utils/result'

export function registerApkIpc(): void {
  ipcMain.handle(IPC.apk.analyze, (_e, raw: unknown) =>
    safe('apk.analyze', () => {
      if (typeof raw !== 'string') throw new Error('File path must be a string')
      return apkAnalyzerService.analyze(raw)
    })
  )

  ipcMain.handle(IPC.apk.getManifest, (_e, raw: unknown) =>
    safe('apk.getManifest', () => {
      if (typeof raw !== 'string') throw new Error('File path must be a string')
      return apkAnalyzerService.getManifest(raw)
    })
  )

  ipcMain.handle(IPC.apk.decompile, (_e, raw: unknown) =>
    safe('apk.decompile', () => {
      if (typeof raw !== 'string') throw new Error('File path must be a string')
      return jadxService
        .decompile({
          inputPath: raw,
          clean: true,
          deobfuscate: true,
          showBadCode: true,
          noResources: false,
          exportGradle: false,
          mode: 'auto',
          threads: 4
        })
        .then((project) => ({ outputDir: project.outputDir }))
    })
  )

  ipcMain.handle(IPC.apk.searchSecrets, (_e, file: unknown, patterns: unknown) =>
    safe('apk.searchSecrets', () => {
      if (typeof file !== 'string') throw new Error('File path must be a string')
      const list = Array.isArray(patterns)
        ? patterns.filter((p): p is string => typeof p === 'string')
        : undefined
      return apkAnalyzerService.searchSecrets(file, list)
    })
  )

  ipcMain.handle(IPC.apk.listStrings, (_e, raw: unknown) =>
    safe('apk.listStrings', () => {
      if (typeof raw !== 'string') throw new Error('File path must be a string')
      return apkAnalyzerService.listStrings(raw)
    })
  )

  ipcMain.handle(IPC.apk.listPatterns, () =>
    safe('apk.listPatterns', () => {
      return apkAnalyzerService.listBuiltInPatterns().map((p) => ({
        id: p.id,
        label: p.label,
        description: p.description,
        severity: p.severity,
        regex: p.regex.source
      }))
    })
  )

  // Install the APK on whichever device the user has set active. Both
  // this and `spawnWithBypass` route through `smartInstall` so they
  // handle XAPK bundles, sibling-detection, and ABI filtering uniformly.
  ipcMain.handle(IPC.apk.installOnActiveDevice, (_e, raw: unknown) =>
    safe('apk.installOnActiveDevice', async () => {
      if (typeof raw !== 'string') throw new Error('File path must be a string')
      const device = deviceService.getActive()
      if (!device || device.state !== 'online') {
        throw new Error('No online device. Plug in a phone or start the emulator first.')
      }
      const result = await smartInstall(device.serial, device.abi, raw)
      return { packageName: result.packageName, serial: device.serial }
    })
  )

  // One-click power action: install + spawn-via-Frida + load a chosen
  // built-in script (defaults to ssl-pinning-bypass). Requires Frida
  // server already running on the active device.
  ipcMain.handle(IPC.apk.spawnWithBypass, (_e, raw: unknown, rawScript: unknown) =>
    safe('apk.spawnWithBypass', async () => {
      if (typeof raw !== 'string') throw new Error('File path must be a string')
      const scriptId = typeof rawScript === 'string' ? rawScript : 'ssl-pinning-bypass'

      const device = deviceService.getActive()
      if (!device || device.state !== 'online') {
        throw new Error('No online device. Plug in a phone or start the emulator first.')
      }

      const fridaStatus = fridaService.getStatus()
      if (fridaStatus.state !== 'connected') {
        throw new Error(
          'frida-server is not running on the active device. Open the Frida tab and click Start frida-server first.'
        )
      }

      // Use the same install pipeline the manual button does — that way
      // a Compass-style XAPK doesn't fall over with MISSING_SPLIT here
      // when the analyzer was perfectly happy to read its manifest.
      const installResult = await smartInstall(device.serial, device.abi, raw)
      const packageName = installResult.packageName || (await apkAnalyzerService.analyze(raw)).packageName
      if (!packageName) {
        throw new Error('Could not determine the package name from the APK manifest.')
      }

      const source = loadBuiltInScript(scriptId)
      const spawnResult = await fridaService.spawn(packageName, source)
      return { sessionId: spawnResult.sessionId, packageName }
    })
  )
}

/**
 * Install an APK / bundle on the given device, doing the right thing
 * for every common shape the user might hand us:
 *
 *   1. A single self-contained `.apk` → straight `adb install`.
 *   2. An `.xapk` / `.apks` / `.apkm` bundle file → unzip to a temp dir
 *      and install every `.apk` inside via `adb install-multiple`,
 *      filtered to the splits compatible with the device's ABI.
 *   3. A single APK that turns out to be part of a split bundle (adb
 *      fails with `INSTALL_FAILED_MISSING_SPLIT`) → scan the original
 *      directory for sibling APKs, filter by ABI, then `install-multiple`.
 *
 * The ABI filter is the new piece that fixes the
 * `INSTALL_FAILED_NO_MATCHING_ABIS` failure on x86_64 emulators: we
 * include only ABI-specific splits whose architecture the device can
 * actually execute, and abort with a clear "your device is x86_64,
 * bundle is arm-only" error before adb returns its opaque res=-113.
 */
async function smartInstall(
  serial: string,
  deviceAbi: string | null,
  apkPath: string
): Promise<{ packageName: string }> {
  const log = getLogger()
  const lower = apkPath.toLowerCase()

  if (lower.endsWith('.xapk') || lower.endsWith('.apks') || lower.endsWith('.apkm')) {
    const tempDir = mkdtempSync(join(tmpdir(), 'mobsec-xapk-'))
    try {
      await extract(apkPath, { dir: tempDir })
      const allApks = findApks(tempDir)
      if (allApks.length === 0) {
        throw new Error(
          `No APK files were found inside ${apkPath}. Is this really an XAPK / APKS bundle?`
        )
      }
      const filtered = enforceAbiCompatibility(allApks, deviceAbi)
      log.info('Installing extracted bundle', {
        total: allApks.length,
        selected: filtered.length,
        deviceAbi
      })
      await installMultipleApks(serial, filtered)
      // Best-effort: identify the base APK and read its package name.
      const base = filtered.find((p) => /base\.apk$/i.test(p)) ?? filtered[0]
      let packageName = ''
      if (base) {
        try {
          const summary = await apkAnalyzerService.analyze(base)
          packageName = summary.packageName
        } catch {
          // ignore
        }
      }
      return { packageName }
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
    }
  }

  // Single-APK path. Try plain install first; on MISSING_SPLIT, walk
  // the sibling directory and retry as a filtered install-multiple.
  try {
    const result = await installApk(serial, apkPath)
    return { packageName: result.packageName }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (!/INSTALL_FAILED_MISSING_SPLIT/i.test(message)) throw err
    log.info('Missing-split detected — scanning sibling APKs for install-multiple', {
      base: apkPath
    })
    const siblings = findApks(dirname(apkPath))
    const apks = [...new Set([resolvePath(apkPath), ...siblings])]
    if (apks.length < 2) {
      throw new Error(
        `${message}\n\nThis APK is part of a bundle but no sibling split APKs were found in ${dirname(apkPath)}. Re-pick the entire extracted folder, or pass the original .xapk / .apks file.`
      )
    }
    const filtered = enforceAbiCompatibility(apks, deviceAbi)
    log.info('Retrying with install-multiple', {
      total: apks.length,
      selected: filtered.length,
      deviceAbi
    })
    await installMultipleApks(serial, filtered)
    let packageName = ''
    try {
      const summary = await apkAnalyzerService.analyze(apkPath)
      packageName = summary.packageName
    } catch {
      // best-effort
    }
    return { packageName }
  }
}

/**
 * Filename patterns the Android tooling emits for ABI-specific splits.
 * Matches `config.arm64_v8a.apk`, `split_config.armeabi-v7a.apk`,
 * `config.x86_64.apk`, etc. The single capture group returns the raw
 * ABI string for downstream normalization.
 */
const ABI_SPLIT_REGEX = /(?:^|[._-])(armeabi(?:[_-]v7a)?|arm64[_-]v8a|x86[_-]?64|x86|mips64|mips)\.apk$/i

function normalizeAbi(s: string): string {
  const norm = s.toLowerCase().replace(/_/g, '-')
  // Android calls 64-bit x86 `x86_64` (underscore), not `x86-64`. Convert.
  if (norm === 'x86-64') return 'x86_64'
  return norm
}

/**
 * Given a device's primary ABI, return every ABI it can actually run.
 * Android's secondary-ABI compatibility is well-defined:
 *   - x86_64 → x86_64, x86
 *   - arm64-v8a → arm64-v8a, armeabi-v7a, armeabi
 *   - armeabi-v7a → armeabi-v7a, armeabi
 *   - x86 → x86
 * Older mips ABIs are listed for completeness but never appear in
 * modern devices.
 */
function compatibleAbis(primary: string): string[] {
  const p = normalizeAbi(primary)
  if (p === 'x86_64') return ['x86_64', 'x86']
  if (p === 'arm64-v8a') return ['arm64-v8a', 'armeabi-v7a', 'armeabi']
  if (p === 'armeabi-v7a') return ['armeabi-v7a', 'armeabi']
  if (p === 'mips64') return ['mips64', 'mips']
  return [p]
}

function abiOfSplit(filename: string): string | null {
  const m = filename.toLowerCase().match(ABI_SPLIT_REGEX)
  if (!m) return null
  return normalizeAbi(m[1]!)
}

/**
 * Walk the candidate APK list, keep every non-ABI split (base, density,
 * language) and every ABI split compatible with the device. If the
 * bundle contains ABI splits but none match the device, throw a
 * descriptive error BEFORE calling adb — that turns adb's cryptic
 * `INSTALL_FAILED_NO_MATCHING_ABIS / res=-113` into a user-readable
 * "the bundle only ships arm64-v8a + armeabi-v7a, but your device is
 * x86_64" plus a concrete suggestion to spin up an arm64 emulator.
 */
function enforceAbiCompatibility(apks: string[], deviceAbi: string | null): string[] {
  if (apks.length === 0) return apks
  const allowed = deviceAbi ? new Set(compatibleAbis(deviceAbi)) : null
  const seenAbis = new Set<string>()
  const matched: string[] = []
  const nonAbi: string[] = []

  for (const apk of apks) {
    const filename = apk.split(/[\\/]/).pop() ?? ''
    const splitAbi = abiOfSplit(filename)
    if (!splitAbi) {
      nonAbi.push(apk)
      continue
    }
    seenAbis.add(splitAbi)
    if (!allowed || allowed.has(splitAbi)) {
      matched.push(apk)
    }
  }

  if (seenAbis.size > 0 && matched.length === 0 && deviceAbi) {
    const bundleAbis = [...seenAbis].sort().join(', ')
    throw new Error(
      `This app's native libraries don't match your device's CPU architecture.\n\n` +
        `Device ABI: ${deviceAbi}\n` +
        `Bundle ships native code for: ${bundleAbis}\n\n` +
        `Create a compatible emulator from Settings → Quick setup (set ABI to ` +
        `${suggestAbi(deviceAbi, [...seenAbis])}), or run this on a real device with a matching CPU.`
    )
  }

  // Order: non-ABI first (so the base APK ranks ahead), then matching ABI splits.
  return [...nonAbi, ...matched]
}

function suggestAbi(deviceAbi: string, bundleAbis: string[]): string {
  // Suggest whichever bundle ABI is closest to "modern, common". Falls
  // back to whatever the bundle ships.
  const order = ['arm64-v8a', 'armeabi-v7a', 'x86_64', 'x86']
  for (const candidate of order) {
    if (bundleAbis.includes(candidate)) return candidate
  }
  void deviceAbi
  return bundleAbis[0] ?? 'arm64-v8a'
}

/**
 * Walk a directory (one level deep) looking for `.apk` files. Used by
 * the split-install fallback and by the XAPK-unzip flow.
 */
function findApks(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.apk')) {
      out.push(resolvePath(dir, entry.name))
    } else if (entry.isDirectory()) {
      // XAPK extractors sometimes nest splits under an inner folder.
      for (const inner of readdirSync(resolvePath(dir, entry.name), { withFileTypes: true })) {
        if (inner.isFile() && inner.name.toLowerCase().endsWith('.apk')) {
          out.push(resolvePath(dir, entry.name, inner.name))
        }
      }
    }
  }
  return out
}

function loadBuiltInScript(scriptId: string): string {
  // Built-in scripts ship under `resources/frida-scripts/<id>.js`. We
  // resolve through getPaths().bundledResources so both dev and prod
  // builds find the right copy (the toolchain service uses the same
  // approach for its asset lookups).
  const dirs = [
    join(getPaths().bundledResources, 'frida-scripts'),
    join(getPaths().bundledResources, 'resources', 'frida-scripts')
  ]
  for (const dir of dirs) {
    if (!existsSync(dir)) continue
    const path = join(dir, `${scriptId}.js`)
    if (existsSync(path)) return readFileSync(path, 'utf8')
    // Fuzzy-match by stripping common suffixes / prefixes.
    for (const filename of readdirSync(dir)) {
      if (filename === `${scriptId}.js`) return readFileSync(join(dir, filename), 'utf8')
    }
  }
  // Default fallback — wait for Java and send a heartbeat. The user
  // can still load a real script via the Frida tab afterwards.
  return [
    "// Bootstrap script — Java.perform smoke test.",
    'function whenJavaReady(cb) {',
    "  if (typeof Java !== 'undefined' && Java.available) Java.perform(cb)",
    '  else setTimeout(() => whenJavaReady(cb), 50)',
    '}',
    'whenJavaReady(() => send("[mobsec] hooked — pid=" + Process.id))'
  ].join('\n')
}
