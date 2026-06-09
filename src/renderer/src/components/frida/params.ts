/**
 * Frida script parameter convention.
 *
 * A script declares typed inputs in its header with lines like:
 *
 *   // @param TARGET_CLASS string "Fully-qualified class" com.example.Foo
 *   // @param LOG_STACK    boolean "Log call stack"        false
 *   // @param MAX_DEPTH    number  "Max depth"             3
 *
 * Before the script is loaded into a session, MobSec parses these,
 * collects values from the user via a small form, and injects a
 * preamble of `const <NAME> = <literal>;` declarations at the top of
 * the source. The script body then references the params as plain
 * globals — no templating syntax, no runtime lookups.
 *
 * This keeps generic scripts (hook one method, trace a class, attach a
 * native interceptor) reusable across targets without ever editing
 * their code.
 */

export type FridaParamType = 'string' | 'boolean' | 'number'

export interface FridaParam {
  name: string
  type: FridaParamType
  label: string
  defaultValue: string
}

const PARAM_RE = /^[ \t]*\/\/\s*@param\s+(\w+)\s+(string|boolean|number)\s+"([^"]*)"\s*(.*)$/gm

export function parseScriptParams(source: string): FridaParam[] {
  const out: FridaParam[] = []
  const seen = new Set<string>()
  PARAM_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = PARAM_RE.exec(source)) !== null) {
    const name = m[1]!
    if (seen.has(name)) continue
    seen.add(name)
    out.push({
      name,
      type: m[2] as FridaParamType,
      label: m[3]!,
      defaultValue: (m[4] ?? '').trim()
    })
  }
  return out
}

/**
 * Build the injected `const` preamble from collected values. Values
 * are coerced + literal-encoded per type so the resulting JS is valid:
 * strings via JSON.stringify (handles quotes/escapes), booleans/numbers
 * as bare literals.
 */
export function buildParamPreamble(
  params: FridaParam[],
  values: Record<string, string>
): string {
  if (params.length === 0) return ''
  const lines = params.map((p) => {
    const raw = values[p.name] ?? p.defaultValue
    let literal: string
    if (p.type === 'boolean') {
      literal = raw.trim().toLowerCase() === 'true' ? 'true' : 'false'
    } else if (p.type === 'number') {
      const n = Number(raw)
      literal = Number.isFinite(n) ? String(n) : '0'
    } else {
      literal = JSON.stringify(raw)
    }
    return `const ${p.name} = ${literal};`
  })
  return (
    '/* --- MobSec: injected script parameters --- */\n' +
    lines.join('\n') +
    '\n/* --- end parameters --- */\n\n'
  )
}

/**
 * Combine a preamble with the original source. We strip the original
 * `// @param` comment lines from the body so the injected `const`s are
 * the single source of truth (otherwise a stray re-declaration is
 * possible if the script also defines the same names).
 */
export function applyParams(
  source: string,
  params: FridaParam[],
  values: Record<string, string>
): string {
  if (params.length === 0) return source
  const preamble = buildParamPreamble(params, values)
  return preamble + source
}
