import forge from 'node-forge'
import { existsSync, readFileSync } from 'node:fs'
import { writeFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { CaInstallResult } from '@shared/types'
import { proxyService } from './proxy'
import { pushFile, root, remount, shell } from './adb'
import { deviceService } from './device'
import { getLogger } from '../utils/logger'

/**
 * Auto-install the mitmproxy CA into the active device's trust store so
 * apps (Chrome, WebViews, third-party apps with strict NSC) accept the
 * intercepted HTTPS certs without user intervention.
 *
 * Three install paths, picked from the device's capability matrix:
 *
 *   1. **Magisk module** (rooted + Magisk detected) — writes a tiny
 *      module dir to `/data/adb/modules/mobsec-ca/` with the cert in
 *      `system/etc/security/cacerts/<hash>.0`. Survives factory resets
 *      of /system and persists across reboots. Magisk needs a reboot
 *      to mount it, so we *also* do the system-store install for the
 *      current session.
 *
 *   2. **System store** (rooted, no Magisk) — the classic `adb root +
 *      remount + push to /system/etc/security/cacerts/<hash>.0` flow.
 *      Works for our embedded emulator (userdebug + writable-system)
 *      and any traditionally-rooted real device.
 *
 *   3. **User store** (not rooted) — pushes the cert as
 *      `/sdcard/Download/mobsec-ca.crt` and launches the system
 *      credentials installer activity so the user can tap through. We
 *      cannot bypass the activity because Android intentionally requires
 *      manual confirmation for trust changes. The renderer surfaces the
 *      `user-action-required` state with clear instructions.
 *
 * On Android 7+, apps only honour the *system* store. The user store
 * gets used by apps whose Network Security Config explicitly opts in,
 * which most apps don't — so the user-store path is best-effort and we
 * tell the user that up front.
 */

const installedSerials = new Map<string, string>() // serial → installed hash

const MAGISK_MODULE_ID = 'mobsec-ca'
const MAGISK_MODULE_NAME = 'MobSec MitM CA'
const MAGISK_MODULE_AUTHOR = 'MobSec Studio'

/**
 * The most recent CA-install outcome, cached so the renderer can hydrate
 * the CertInstallWizard on first mount without re-running the install
 * flow. Updated on every `ensureCaInstalled` call regardless of path.
 */
let lastResult: CaInstallResult | null = null

export function lastCaInstallResult(): CaInstallResult | null {
  return lastResult
}

export async function ensureCaInstalled(serial: string): Promise<CaInstallResult> {
  const log = getLogger()
  const caPath = proxyService.caCertPath()
  if (!existsSync(caPath)) {
    return { state: 'skipped', message: 'mitmproxy CA not generated yet' }
  }

  let pem: string
  try {
    pem = readFileSync(caPath, 'utf8')
  } catch (err) {
    return {
      state: 'error',
      message: `Could not read CA cert: ${err instanceof Error ? err.message : String(err)}`
    }
  }

  let hash: string
  try {
    hash = subjectHashOld(pem)
  } catch (err) {
    return {
      state: 'error',
      message: `Could not compute subject hash: ${err instanceof Error ? err.message : String(err)}`
    }
  }

  // Look up the device so we can pick the right install path. If the
  // device isn't tracked yet (the poll hasn't seen it), fall back to the
  // system-store path — that matches the pre-multi-device behaviour for
  // the emulator boot race.
  const device = deviceService.list().find((d) => d.serial === serial) ?? null
  const caps = device?.capabilities
  const path: NonNullable<CaInstallResult['path']> = caps?.canInstallMagiskCa
    ? 'magisk-module'
    : caps?.canInstallSystemCa
      ? 'system-store'
      : 'user-store'

  // Fast cache: if we just installed this hash on this serial, skip.
  if (installedSerials.get(serial) === hash) {
    const r: CaInstallResult = {
      state: 'already-installed',
      message: `Cert ${hash}.0 already installed`,
      path
    }
    lastResult = r
    return r
  }

  log.info('ca-install: branch chosen', { serial, hash, path })

  try {
    if (path === 'system-store') {
      const r = await installSystemStore(serial, pem, hash, log)
      lastResult = r
      return r
    }
    if (path === 'magisk-module') {
      // Try the Magisk module for persistence, but ALSO install into the
      // live system store so it works without a reboot. The system-store
      // path is the same code that handles the rooted-no-Magisk case —
      // it just gets re-overlaid every reboot when Magisk mounts our
      // module dir, which is fine because the contents are byte-identical.
      const sysResult = await installSystemStore(serial, pem, hash, log).catch(
        (err): CaInstallResult => ({
          state: 'error',
          message: `Live system-store install failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
          path: 'system-store'
        })
      )
      const moduleResult = await installMagiskModule(serial, pem, hash, log)
      if (sysResult.state === 'installed' || moduleResult.state === 'installed') {
        const r: CaInstallResult = {
          state: 'installed',
          message: 'Installed mitmproxy CA (live + Magisk module for persistence).',
          path: 'magisk-module',
          guidance:
            'The cert is active right now AND will survive reboots via the mobsec-ca Magisk module. Reboot once if you want to verify the persistent path took effect.'
        }
        lastResult = r
        return r
      }
      // Both branches failed — propagate the module error verbatim.
      lastResult = moduleResult
      return moduleResult
    }
    const r = await installUserStore(serial, pem, device?.sdkLevel ?? null, log)
    lastResult = r
    return r
  } finally {
    if (installedSerials.get(serial) !== hash && path !== 'user-store') {
      // Mark installed at the *end* so retries are clean.
      installedSerials.set(serial, hash)
    }
  }
}

/**
 * The original install flow: `adb root → adb remount → push → chmod →
 * chcon`. Lives until the next `/system` remount but works without
 * Magisk and on every userdebug emulator.
 */
async function installSystemStore(
  serial: string,
  pem: string,
  hash: string,
  log: ReturnType<typeof getLogger>
): Promise<CaInstallResult> {
  const devicePath = `/system/etc/security/cacerts/${hash}.0`

  // Verify on-device — the user may have wiped data, restored a
  // snapshot, etc.
  try {
    const res = await shell(serial, `ls ${devicePath}`)
    if (res.exitCode === 0 && res.stdout.includes(`${hash}.0`)) {
      installedSerials.set(serial, hash)
      return {
        state: 'already-installed',
        message: `Cert ${hash}.0 already on device`,
        path: 'system-store'
      }
    }
  } catch {
    // ignore — proceed with install
  }

  try {
    await root(serial)
  } catch (err) {
    return {
      state: 'error',
      message: `adb root failed: ${err instanceof Error ? err.message : String(err)}`,
      path: 'system-store'
    }
  }

  try {
    await remount(serial)
  } catch (err) {
    return {
      state: 'error',
      message: `adb remount failed: ${err instanceof Error ? err.message : String(err)}. On a real device you may need to disable verified boot; on the emulator, boot with -writable-system (the Quick Setup default).`,
      path: 'system-store'
    }
  }

  const localTmp = join(tmpdir(), `mobsec-${hash}.0`)
  try {
    await writeFile(localTmp, pem, 'utf8')
    await pushFile(serial, localTmp, devicePath)
    await shell(serial, `chmod 644 ${devicePath}`)
    await shell(serial, `chcon u:object_r:system_file:s0 ${devicePath}`).catch(() => undefined)
    log.info('CA installed in device system trust store', { serial, hash, devicePath })

    // Force-stop common browsers / WebView host apps. Trust stores are
    // read when each app builds its first SSLEngine, so a force-stop
    // makes the new cert take effect immediately.
    const packagesToKick = [
      'com.android.chrome',
      'com.android.webview',
      'com.google.android.webview',
      'com.android.browser'
    ]
    for (const pkg of packagesToKick) {
      await shell(serial, `am force-stop ${pkg}`).catch(() => undefined)
    }

    return {
      state: 'installed',
      message: `Installed mitmproxy CA as ${hash}.0 in the system trust store.`,
      certPathOnDevice: devicePath,
      path: 'system-store'
    }
  } catch (err) {
    return {
      state: 'error',
      message: `Push failed: ${err instanceof Error ? err.message : String(err)}`,
      path: 'system-store'
    }
  } finally {
    try {
      await unlink(localTmp)
    } catch {
      /* best-effort cleanup */
    }
  }
}

/**
 * Stamp out a minimal Magisk module under `/data/adb/modules/mobsec-ca/`
 * that drops the CA into `system/etc/security/cacerts/<hash>.0`. Magisk
 * picks this up at boot and overlays it onto the real `/system`. The
 * module survives factory-resets of `/system` (Magisk re-mounts on every
 * boot) and is removable cleanly via `rm -r /data/adb/modules/mobsec-ca`.
 */
async function installMagiskModule(
  serial: string,
  pem: string,
  hash: string,
  log: ReturnType<typeof getLogger>
): Promise<CaInstallResult> {
  const moduleDir = `/data/adb/modules/${MAGISK_MODULE_ID}`
  const certDirOnDevice = `${moduleDir}/system/etc/security/cacerts`
  const certPath = `${certDirOnDevice}/${hash}.0`

  // Need root to write under /data/adb. We rely on `su -c` working —
  // that's what `deviceService.probeRoot` confirmed before we picked
  // the magisk-module path.
  const shellSu = async (cmd: string): Promise<void> => {
    const res = await shell(serial, `su -c "${cmd.replace(/"/g, '\\"')}"`)
    if (res.exitCode !== 0) {
      throw new Error(
        `su -c '${cmd}' exited ${res.exitCode}: ${res.stderr.trim() || res.stdout.trim()}`
      )
    }
  }

  try {
    // Lay out the module skeleton.
    await shellSu(`mkdir -p ${certDirOnDevice}`)
    const moduleProp = [
      `id=${MAGISK_MODULE_ID}`,
      `name=${MAGISK_MODULE_NAME}`,
      'version=v1.0',
      'versionCode=1',
      `author=${MAGISK_MODULE_AUTHOR}`,
      'description=Installs the MobSec/mitmproxy root CA into the system trust store via Magisk.'
    ].join('\n')

    const localProp = join(tmpdir(), `${MAGISK_MODULE_ID}.module.prop`)
    const localCert = join(tmpdir(), `${MAGISK_MODULE_ID}.${hash}.0`)
    await writeFile(localProp, moduleProp + '\n', 'utf8')
    await writeFile(localCert, pem, 'utf8')

    // Stage in /sdcard/ first — we don't have permission to push to
    // /data/adb directly without elevating the adb daemon, but su can
    // copy from a world-readable path.
    const stagingProp = `/sdcard/${MAGISK_MODULE_ID}.module.prop`
    const stagingCert = `/sdcard/${MAGISK_MODULE_ID}.${hash}.0`
    await pushFile(serial, localProp, stagingProp)
    await pushFile(serial, localCert, stagingCert)

    await shellSu(`cp ${stagingProp} ${moduleDir}/module.prop`)
    await shellSu(`cp ${stagingCert} ${certPath}`)
    await shellSu(`chmod 644 ${moduleDir}/module.prop ${certPath}`)
    await shellSu(
      `chcon u:object_r:system_file:s0 ${certPath} 2>/dev/null || true`
    )
    // Clean up staging.
    await shell(serial, `rm -f ${stagingProp} ${stagingCert}`).catch(() => undefined)

    // Local cleanup.
    await unlink(localProp).catch(() => undefined)
    await unlink(localCert).catch(() => undefined)

    log.info('Magisk module installed', { serial, moduleDir, hash })

    return {
      state: 'installed',
      message: `Wrote Magisk module ${MAGISK_MODULE_ID} carrying ${hash}.0.`,
      certPathOnDevice: certPath,
      path: 'magisk-module',
      guidance:
        'Magisk mounts modules at boot — reboot the device once to make the system trust store reflect the new CA permanently.'
    }
  } catch (err) {
    return {
      state: 'error',
      message: `Magisk module install failed: ${err instanceof Error ? err.message : String(err)}`,
      path: 'magisk-module'
    }
  }
}

/**
 * Non-rooted device path: drop the cert in `/sdcard/Download/` and
 * launch the credentials installer activity. The user has to tap
 * through — Android intentionally requires manual confirmation for
 * trust changes. We can't bypass that, so we make the steps as obvious
 * as possible in the UI.
 *
 * Caveat: Android 7+ apps only honour the user trust store if their
 * Network Security Config explicitly opts in (`<trust-anchors><certificates
 * src="user"/>`). Many apps don't, so the user-store install is
 * best-effort. We surface this in `guidance` so the user isn't surprised
 * when a target app still pins.
 */
async function installUserStore(
  serial: string,
  pem: string,
  sdkLevel: number | null,
  log: ReturnType<typeof getLogger>
): Promise<CaInstallResult> {
  // Use a `.crt` extension because Android's file picker filters by it.
  // Push to /sdcard/Download because that's the path users see in their
  // file picker when navigating "Install from storage". Some Android
  // builds reject /sdcard/ at the top level — Download is universally OK.
  const remoteName = 'mobsec-ca.crt'
  const remotePath = `/sdcard/Download/${remoteName}`
  const localTmp = join(tmpdir(), remoteName)

  try {
    await writeFile(localTmp, pem, 'utf8')
    await pushFile(serial, localTmp, remotePath)
    log.info('User-store CA: cert pushed', { serial, remotePath })
  } catch (err) {
    return {
      state: 'error',
      message: `Could not push the CA cert to the device: ${
        err instanceof Error ? err.message : String(err)
      }`,
      path: 'user-store'
    }
  } finally {
    await unlink(localTmp).catch(() => undefined)
  }

  // Try several launch paths in order — Android's cert-install UX has
  // shifted across versions and OEM skins, and the file:// URI path that
  // works on Android 9 may be blocked by scoped storage on Android 11+.
  // We stop at the first activity that resolves successfully; if all
  // fail we open Security Settings so the user can navigate manually.
  //
  // Empirically:
  //   - Android 7–10: `CertInstaller` with file:// works directly.
  //   - Android 11+: launch SECURITY_SETTINGS; user picks "Install from
  //     storage" → "CA certificate" → mobsec-ca.crt from Downloads.
  //   - Some OEMs (Xiaomi/MIUI): `.CertInstallerMain` is the right name.
  const launches = [
    {
      name: 'CertInstaller activity (file://)',
      cmd: `am start -n com.android.certinstaller/.CertInstaller -d file://${remotePath} -t application/x-x509-ca-cert`
    },
    {
      name: 'CertInstallerMain activity (file://)',
      cmd: `am start -n com.android.certinstaller/.CertInstallerMain -d file://${remotePath} -t application/x-x509-ca-cert`
    },
    {
      name: 'VIEW intent (file://)',
      cmd: `am start -a android.intent.action.VIEW -d file://${remotePath} -t application/x-x509-ca-cert`
    },
    {
      name: 'Security settings (manual nav)',
      cmd: 'am start -a android.settings.SECURITY_SETTINGS'
    }
  ]

  let launchedVia: string | null = null
  for (const attempt of launches) {
    const res = await shell(serial, attempt.cmd).catch(() => null)
    if (
      res &&
      res.exitCode === 0 &&
      !/Error|Activity not started|unable to find/i.test(res.stdout + res.stderr)
    ) {
      launchedVia = attempt.name
      log.info('User-store CA: launched installer', { serial, via: attempt.name })
      break
    }
  }

  const newAndroid = sdkLevel != null && sdkLevel >= 30 // Android 11+
  const guidance = newAndroid
    ? [
        'On your phone right now:',
        '  1. You should see Settings → Security (or Privacy).',
        '  2. Tap "Encryption & credentials" → "Install a certificate" → "CA certificate".',
        '  3. Confirm the security warning if shown.',
        '  4. Pick "mobsec-ca.crt" from Downloads.',
        '',
        "If the Settings page didn't open: open Files / Downloads, tap mobsec-ca.crt, then confirm.",
        '',
        "Caveat: Android 7+ apps only trust the user store if their Network Security Config opts in. Browsers (Chrome included) and apps with permissive NSC work; most banking/messaging apps don't. Root the device for full coverage."
      ].join('\n')
    : [
        'On your phone right now:',
        '  1. The "Install certificate" screen should be open.',
        '  2. Name it anything (e.g. "MobSec CA").',
        '  3. Pick "VPN and apps" (or "Used for: VPN and apps") and tap OK.',
        '',
        "If the screen didn't open: Settings → Security → Install from storage → CA certificate, then pick mobsec-ca.crt from Downloads.",
        '',
        "Caveat: Android 7+ apps only trust the user store if their Network Security Config opts in. Most production apps don't. Use a rooted device for full coverage."
      ].join('\n')

  return {
    state: 'user-action-required',
    message: launchedVia
      ? `Cert pushed to the device and ${launchedVia} launched — finish the install on your phone.`
      : 'Cert pushed to the device but no installer activity launched. Open Settings → Security manually.',
    certPathOnDevice: remotePath,
    path: 'user-store',
    guidance
  }
}

/**
 * Compute the OpenSSL `subject_hash_old` of a PEM-encoded X.509 cert. This
 * is the filename Android (and OpenSSL ≤ 1.0.x) uses to index trusted CAs:
 * MD5 of the DER-encoded subject, first 4 bytes interpreted as a
 * little-endian uint32, formatted as 8 hex chars.
 */
function subjectHashOld(pem: string): string {
  const cert = forge.pki.certificateFromPem(pem)
  const subjectAsn1 = forge.pki.distinguishedNameToAsn1(cert.subject)
  const derBytes = forge.asn1.toDer(subjectAsn1).getBytes()
  const md = forge.md.md5.create()
  md.update(derBytes)
  const digest = md.digest().getBytes()
  const u32 =
    (digest.charCodeAt(0) & 0xff) |
    ((digest.charCodeAt(1) & 0xff) << 8) |
    ((digest.charCodeAt(2) & 0xff) << 16) |
    ((digest.charCodeAt(3) & 0xff) << 24)
  return (u32 >>> 0).toString(16).padStart(8, '0')
}
