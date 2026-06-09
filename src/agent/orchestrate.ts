/**
 * Strategy execution + selection. Turns a Strategy into a StrategyResult,
 * keeps things idempotent across calls in a session, and drives the
 * "apply everything applicable" Auto-Pwn selection. Everything is wrapped
 * so one bad strategy never aborts the rest.
 */

import type { StrategyResult, StrategyVerification } from '@shared/frida-intel'
import type { ReconContext } from './core/context'
import type { Strategy } from './core/registry'
import { getStrategies, getStrategy, isApplied, markApplied } from './core/registry'
import { StrategyRun } from './core/strategy'
import { channel } from './core/log'
import { safe } from './core/safe'

const log = channel('bypass')

export function runStrategy(ctx: ReconContext, strategy: Strategy): StrategyResult {
  const already = isApplied(strategy.id)
  const run = new StrategyRun()

  if (already) {
    run.note('already applied earlier in this session')
  } else {
    log.info(`applying ${strategy.label}…`)
    safe(
      `strategy:${strategy.id}`,
      () => strategy.apply(ctx, run),
      (message) => run.errors.push(message)
    )
    markApplied(strategy.id)
  }

  let verification: StrategyVerification | null = null
  const verifyFn = strategy.verify
  if (verifyFn) {
    verification =
      safe(`verify:${strategy.id}`, () => verifyFn(ctx)) ??
      ({ ran: true, ok: false, detail: 'verification threw' } as StrategyVerification)
  }

  const applied = already || run.hooksInstalled > 0
  log.info(
    `${strategy.label}: ${run.hooksInstalled} hook(s)` +
      (run.errors.length ? `, ${run.errors.length} error(s)` : '') +
      (verification ? `, verify=${verification.ok ? 'ok' : 'fail'}` : '')
  )

  return {
    id: strategy.id,
    label: strategy.label,
    category: strategy.category,
    applied,
    alreadyActive: already,
    hooksInstalled: run.hooksInstalled,
    notes: run.notes,
    errors: run.errors,
    verification
  }
}

export function applyStrategiesByIds(ctx: ReconContext, ids: string[]): StrategyResult[] {
  const out: StrategyResult[] = []
  for (const id of ids) {
    const strategy = getStrategy(id)
    if (!strategy) {
      out.push({
        id,
        label: id,
        category: 'tamper-detection',
        applied: false,
        alreadyActive: false,
        hooksInstalled: 0,
        notes: [],
        errors: ['unknown strategy id'],
        verification: null
      })
      continue
    }
    out.push(runStrategy(ctx, strategy))
  }
  return out
}

/**
 * Auto-Pwn selection: apply every *safe* strategy that declares itself
 * relevant. Strategies flagged `autoApply: false` (risky native hooks like
 * the anti-anti-Frida libc replacement or BoringSSL patching) are skipped
 * here — they can destabilise an app, so they're manual-only via the
 * bypass checklist. This is the core of the "Auto-Pwn shouldn't crash the
 * app" guarantee.
 */
export function autoApplyApplicable(ctx: ReconContext): StrategyResult[] {
  const out: StrategyResult[] = []
  for (const strategy of getStrategies()) {
    if (strategy.autoApply === false) {
      log.debug(`skip ${strategy.label} (manual-only / risky)`)
      continue
    }
    const relevant = safe(`applies:${strategy.id}`, () => strategy.applies(ctx)) ?? false
    if (!relevant) {
      log.debug(`skip ${strategy.label} (not applicable)`)
      continue
    }
    out.push(runStrategy(ctx, strategy))
  }
  const totalHooks = out.reduce((n, r) => n + r.hooksInstalled, 0)
  log.info(`Auto-Pwn applied ${out.length} safe strategy(ies), ${totalHooks} hook(s) total`)
  return out
}
