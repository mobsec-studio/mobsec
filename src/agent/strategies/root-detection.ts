/**
 * Root-detection bypass. Hooks the platform choke-points root checks use
 * (File.exists, Runtime.exec, Build.TAGS, PackageManager) plus the
 * RootBeer library, so the obvious checks fail. Includes a cheap, safe
 * active verifier.
 */

import type { Strategy } from '../core/registry'
import type { ReconContext } from '../core/context'
import type { StrategyRun } from '../core/strategy'
import { safeOr } from '../core/safe'

const SUSPICIOUS_PATHS = [
  '/system/bin/su',
  '/system/xbin/su',
  '/sbin/su',
  '/su/bin/su',
  '/system/app/Superuser.apk',
  '/system/app/SuperSU',
  '/system/xbin/daemonsu',
  '/system/xbin/busybox',
  '/system/bin/.ext',
  '/data/local/tmp/frida-server',
  '/dev/com.koushikdutta.superuser.daemon',
  '/sbin/.magisk',
  '/sbin/.core/mirror',
  '/data/adb/magisk',
  '/data/adb/modules',
  '/cache/.disable_magisk',
  '/cache/magisk.log',
  'magisk',
  'supersu'
]

const ROOT_PACKAGES = [
  'com.topjohnwu.magisk',
  'eu.chainfire.supersu',
  'com.koushikdutta.superuser',
  'com.noshufou.android.su',
  'com.thirdparty.superuser',
  'com.yellowes.su'
]

const ROOTBEER_METHODS = [
  'isRooted',
  'isRootedWithoutBusyBoxCheck',
  'detectRootManagementApps',
  'detectPotentiallyDangerousApps',
  'checkForSuBinary',
  'checkForBusyBoxBinary',
  'checkForDangerousProps',
  'checkForRWPaths',
  'detectTestKeys',
  'checkSuExists',
  'checkForRootNative',
  'detectRootCloakingApps'
]

function looksSuspicious(path: string): boolean {
  const p = path.toLowerCase()
  return SUSPICIOUS_PATHS.some((s) => p.indexOf(s) !== -1)
}

export const rootDetectionStrategy: Strategy = {
  id: 'root-detection',
  label: 'Root detection bypass',
  category: 'root-detection',
  description:
    'Hides su binaries, Magisk paths and root-manager packages from File.exists, Runtime.exec, PackageManager and RootBeer.',
  applies(ctx: ReconContext): boolean {
    void ctx
    return true
  },
  apply(ctx: ReconContext, run: StrategyRun): void {
    // 1. File.exists — hide suspicious paths.
    run.hook('File.exists(su/magisk paths)', () => {
      const File = Java.use('java.io.File')
      const exists = File.exists
      exists.implementation = function () {
        const path = String(this.getAbsolutePath())
        if (looksSuspicious(path)) return false
        return exists.call(this)
      }
    })

    // 2. Runtime.exec — block su / which su.
    run.hook('Runtime.exec(su)', () => {
      const Runtime = Java.use('java.lang.Runtime')
      const IOException = Java.use('java.io.IOException')
      const execStr = Runtime.exec.overload('java.lang.String')
      execStr.implementation = function (cmd: string) {
        if (cmd && (cmd === 'su' || cmd.indexOf('which su') !== -1 || cmd.indexOf('/su') !== -1)) {
          throw IOException.$new(`Cannot run program "${cmd}"`)
        }
        return execStr.call(this, cmd)
      }
      const execArr = Runtime.exec.overload('[Ljava.lang.String;')
      execArr.implementation = function (args: Java.Wrapper) {
        const first = args && args.length > 0 ? String(args[0]) : ''
        if (first === 'su' || first === 'which' || first.indexOf('/su') !== -1) {
          throw IOException.$new(`Cannot run program "${first}"`)
        }
        return execArr.call(this, args)
      }
    })

    // 3. Build.TAGS test-keys → release-keys.
    run.hook('Build.TAGS → release-keys', () => {
      const Build = Java.use('android.os.Build')
      const field = Build.class.getDeclaredField('TAGS')
      field.setAccessible(true)
      field.set(null, 'release-keys')
    })

    // 4. PackageManager.getPackageInfo — hide root-manager packages.
    run.hook('PackageManager.getPackageInfo(root apps)', () => {
      const PM = Java.use('android.app.ApplicationPackageManager')
      const NameNotFound = Java.use('android.content.pm.PackageManager$NameNotFoundException')
      const getPkg = PM.getPackageInfo.overload('java.lang.String', 'int')
      getPkg.implementation = function (name: string, flags: number) {
        if (ROOT_PACKAGES.indexOf(name) !== -1) throw NameNotFound.$new(name)
        return getPkg.call(this, name, flags)
      }
    })

    // 5. RootBeer — every public check returns false.
    run.hook('RootBeer.* → false', () => {
      const RootBeer = ctx.useClass('com.scottyab.rootbeer.RootBeer')
      if (!RootBeer) return
      for (const name of ROOTBEER_METHODS) {
        const method = RootBeer[name]
        if (!method || !method.overloads) continue
        method.overloads.forEach((ov: Java.Wrapper) => {
          ov.implementation = function () {
            return false
          }
        })
      }
      run.note('RootBeer checks forced to false')
    })
  },
  verify(ctx: ReconContext) {
    // Active, in-process, side-effect-free checks.
    const fileHidden = safeOr<boolean>(false, () => {
      const File = Java.use('java.io.File')
      return File.$new('/system/xbin/su').exists() === false
    })
    const rootBeerOk = safeOr<boolean | null>(null, () => {
      const RB = ctx.useClass('com.scottyab.rootbeer.RootBeer')
      if (!RB) return null
      const ctxClass = Java.use('android.app.ActivityThread').currentApplication()
      const instance = RB.$new(ctxClass)
      return instance.isRooted() === false
    })
    const ok = fileHidden && rootBeerOk !== false
    const parts = [`File.exists(su)=${fileHidden ? 'hidden' : 'visible'}`]
    if (rootBeerOk !== null) parts.push(`RootBeer.isRooted=${rootBeerOk ? 'false' : 'true'}`)
    return { ran: true, ok, detail: parts.join(', ') }
  }
}
