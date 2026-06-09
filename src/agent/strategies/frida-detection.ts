/**
 * Anti-anti-Frida (manual-only). Defeats the most common native detection
 * primitive — scanning `/proc/self/maps` for "frida"/"gum"/"gadget" — by
 * blanking those lines as they're read through `fgets`.
 *
 * Safety: we deliberately do NOT replace `strstr` (libc calls it constantly;
 * a JS callback per call bogs down and crashes processes). We hook only
 * `fgets` and use `Interceptor.attach` + `onLeave` (the returned buffer IS
 * the line), so we never replace a hot function or call back into the
 * original. Even so this touches a global libc symbol, so it's flagged
 * `autoApply: false` — Auto-Pwn won't apply it; the user opts in from the
 * bypass checklist when an app actually detects Frida.
 */

import type { Strategy } from '../core/registry'
import type { ReconContext } from '../core/context'
import type { StrategyRun } from '../core/strategy'
import { ModuleRT } from '../core/native'

const FRIDA_MARKERS = /frida|gum-js|gmain|gdbus|linjector|gadget|re\.frida/i

/** Native libs that strongly imply active anti-tamper / anti-Frida. */
const PROTECTOR_HINT =
  /(libjiagu|libdexhelper|libsecshell|libsecmain|libtup|libtprt|libtosprotection|libnesec|libsgmain|libexecmain|libdexprotector|libcovault|libchaosvmp|libnqshield|libapssec)/i

export const fridaDetectionStrategy: Strategy = {
  id: 'frida-detection',
  label: 'Anti-anti-Frida (manual)',
  category: 'frida-detection',
  description:
    'Blanks "frida"/"gum"/"gadget" lines from /proc/self/maps as they are read (fgets). Manual-only — touches a global libc symbol.',
  autoApply: false,
  applies(ctx: ReconContext): boolean {
    return ctx.modules.some((m) => PROTECTOR_HINT.test(m.name))
  },
  apply(_ctx: ReconContext, run: StrategyRun): void {
    run.hook('fgets(/proc maps) scrub', () => {
      const p = ModuleRT.findExportByName(null, 'fgets')
      if (!p) throw new Error('fgets not found')
      // attach (not replace): let the original run, then inspect/blank the
      // returned line. retval is the char* buffer fgets returned (or NULL).
      Interceptor.attach(p, {
        onLeave(retval) {
          if (retval.isNull()) return
          try {
            const line = retval.readUtf8String()
            if (line && FRIDA_MARKERS.test(line)) retval.writeUtf8String('')
          } catch (_e) {
            /* unreadable line — leave it untouched */
          }
        }
      })
      run.note('fgets() scrubs Frida lines from /proc maps')
    })
  }
}
