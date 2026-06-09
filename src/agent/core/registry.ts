/**
 * Plugin registries for the intelligence engine.
 *
 * Phase 1 ships the Detector plugin (reconnaissance). The Strategy and
 * Tracer shapes are declared here too so the engine's plugin API is
 * stable as later phases (bypass arsenal, deep tracing) plug in without
 * reworking the core.
 */

import type { AgentChannel, SecurityControlKind, StrategyVerification } from '@shared/frida-intel'
import type { ReconContext } from './context'
import type { ReportBuilder } from './report'
import type { StrategyRun } from './strategy'

/** A reconnaissance plugin: inspects the runtime, contributes report slices. */
export interface Detector {
  id: string
  /** Run-order hint; higher runs first. Defaults to 0. */
  priority?: number
  detect(ctx: ReconContext, out: ReportBuilder): void
}

/**
 * A bypass / instrumentation plugin. Each strategy is self-contained,
 * idempotent, and self-guarding: it installs hooks through the `run`
 * accumulator so a failed hook is recorded, not thrown.
 */
export interface Strategy {
  id: string
  label: string
  category: SecurityControlKind
  description: string
  /**
   * Whether Auto-Pwn applies this automatically. Defaults to true. Set
   * false for risky/native strategies (global libc hooks, BoringSSL
   * patching) that can destabilise an app — those stay manual-only.
   */
  autoApply?: boolean
  /** Cheap predicate gating whether this strategy is relevant. */
  applies(ctx: ReconContext): boolean
  /** Install the hooks. Must be idempotent and self-guarding. */
  apply(ctx: ReconContext, run: StrategyRun): void
  /**
   * Optional active verification — a cheap, safe, in-process re-probe that
   * confirms the bypass took (e.g. RootBeer.isRooted() now returns false).
   * Must never make network calls or block.
   */
  verify?(ctx: ReconContext): StrategyVerification
}

/**
 * A long-running observation plugin (live monitor). Toggleable: `start`
 * installs hooks, `stop` reverts them. Emits structured events on its
 * channel while active.
 */
export interface Tracer {
  id: string
  label: string
  description: string
  channel: AgentChannel
  start(ctx: ReconContext): void
  stop(): void
}

const detectors: Detector[] = []

export function registerDetector(d: Detector): void {
  if (!detectors.some((x) => x.id === d.id)) detectors.push(d)
}

export function getDetectors(): Detector[] {
  return detectors.slice().sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
}

const strategies: Strategy[] = []
const appliedStrategies = new Set<string>()

export function registerStrategy(s: Strategy): void {
  if (!strategies.some((x) => x.id === s.id)) strategies.push(s)
}

export function getStrategies(): Strategy[] {
  return strategies.slice()
}

export function getStrategy(id: string): Strategy | null {
  return strategies.find((s) => s.id === id) ?? null
}

/** Mark a strategy as applied in this session (for idempotency reporting). */
export function markApplied(id: string): void {
  appliedStrategies.add(id)
}

export function isApplied(id: string): boolean {
  return appliedStrategies.has(id)
}

const tracers: Tracer[] = []
const activeTracers = new Set<string>()

export function registerTracer(t: Tracer): void {
  if (!tracers.some((x) => x.id === t.id)) tracers.push(t)
}

export function getTracers(): Tracer[] {
  return tracers.slice()
}

export function getTracer(id: string): Tracer | null {
  return tracers.find((t) => t.id === id) ?? null
}

export function setTracerActive(id: string, active: boolean): void {
  if (active) activeTracers.add(id)
  else activeTracers.delete(id)
}

export function isTracerActive(id: string): boolean {
  return activeTracers.has(id)
}
