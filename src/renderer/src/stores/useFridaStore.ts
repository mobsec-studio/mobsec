import { create } from 'zustand'
import type { FridaProcess, FridaScript, FridaStatus } from '@shared/types'
import type { AppIntelligenceReport, FridaEvent, StrategyResult } from '@shared/frida-intel'

/** A live instrumentation event with a stable local id for React keys. */
export interface LiveEvent extends FridaEvent {
  id: number
}

const MAX_EVENTS = 2000

export interface ConsoleEntry {
  /** Monotonic local id so React keys are stable. */
  id: number
  sessionId: string
  level: 'info' | 'warn' | 'error'
  text: string
  /** Wall-clock when received in the renderer. */
  at: string
}

/**
 * What the user has highlighted in the process pane. `pid` is `0` for an
 * installed-but-not-running app — those rows trigger a spawn (by identifier)
 * instead of an attach. Multiple pid=0 apps coexist, so equality must
 * compare both fields, not pid alone.
 */
export interface FridaTarget {
  pid: number
  identifier: string | null
}

export function isSameTarget(a: FridaTarget | null, b: FridaTarget | null): boolean {
  if (!a || !b) return a === b
  return a.pid === b.pid && (a.identifier ?? null) === (b.identifier ?? null)
}

interface FridaState {
  status: FridaStatus
  processes: FridaProcess[]
  processFilter: string
  /** When true, hide system/native processes from the picker. Most Frida
   *  workflows target Android apps, so this defaults on. */
  appsOnly: boolean
  selectedTarget: FridaTarget | null
  builtinScripts: FridaScript[]
  userScripts: FridaScript[]
  /** The script we'd send if the user clicks Attach. Edited in Monaco. */
  draftScript: string
  /** A non-empty value here means the editor is currently showing one of
   *  the built-in / user-saved scripts (so we can warn before overwriting). */
  draftSourceId: string | null
  activeSessionId: string | null
  console: ConsoleEntry[]
  busy: boolean
  /** Most recent App Intelligence Report from a reconnaissance run. */
  lastReport: AppIntelligenceReport | null
  /** True while a reconnaissance run is in flight. */
  reconBusy: boolean
  /** Strategy results from the most recent Auto-Pwn (or manual apply). */
  lastStrategyResults: StrategyResult[] | null
  /** True while an Auto-Pwn run is in flight. */
  autoPwnBusy: boolean
  /** The session currently running the intelligence agent (for tracing). */
  agentSessionId: string | null
  /** Live structured instrumentation events (ring buffer). */
  events: LiveEvent[]
  /** When true, incoming events are dropped (UI paused). */
  eventsPaused: boolean
  /** Count of dropped live events while the UI stream is paused. */
  eventsPausedCount: number

  setStatus: (s: FridaStatus) => void
  setProcesses: (procs: FridaProcess[]) => void
  setProcessFilter: (filter: string) => void
  setAppsOnly: (next: boolean) => void
  selectTarget: (target: FridaTarget | null) => void
  setDraftScript: (text: string) => void
  setDraftSourceId: (id: string | null) => void
  appendConsole: (entry: Omit<ConsoleEntry, 'id' | 'at'>) => void
  clearConsole: () => void
  setLastReport: (report: AppIntelligenceReport | null) => void
  setReconBusy: (busy: boolean) => void
  setStrategyResults: (results: StrategyResult[] | null) => void
  setAutoPwnBusy: (busy: boolean) => void
  setAgentSessionId: (sessionId: string | null) => void
  appendEvent: (event: FridaEvent) => void
  clearEvents: () => void
  setEventsPaused: (paused: boolean) => void
  hydrate: () => Promise<void>
  refreshScripts: () => Promise<void>
}

let nextEntryId = 1

export const useFridaStore = create<FridaState>((set) => ({
  status: { state: 'disconnected', deviceId: null, serverVersion: null },
  processes: [],
  processFilter: '',
  appsOnly: true,
  selectedTarget: null,
  builtinScripts: [],
  userScripts: [],
  draftScript:
    "// Frida script. Saved scripts live in the library on the right.\n// `Java` is only defined inside Android-app (Dalvik/ART) processes,\n// and on a Frida *spawn* it can take a moment to appear after the\n// process starts. Poll briefly before deciding it's a native process.\n\nsend('hello from frida — pid ' + Process.id + ' (' + Process.arch + ')')\n\nfunction whenJavaReady(cb, attemptsLeft) {\n  if (typeof Java !== 'undefined' && Java.available) {\n    Java.perform(cb)\n  } else if (attemptsLeft > 0) {\n    setTimeout(() => whenJavaReady(cb, attemptsLeft - 1), 50)\n  } else {\n    send('no java vm here — this looks like a native process')\n  }\n}\n\n// ~3s of polling at 50ms covers an ART cold-start spawn.\nwhenJavaReady(() => {\n  send('java vm is up, ready to hook android classes')\n}, 60)\n",
  draftSourceId: null,
  activeSessionId: null,
  console: [],
  busy: false,
  lastReport: null,
  reconBusy: false,
  lastStrategyResults: null,
  autoPwnBusy: false,
  agentSessionId: null,
  events: [],
  eventsPaused: false,
  eventsPausedCount: 0,
  setStatus: (status) =>
    set((s) => {
      if (status.state === 'connected') return { status }
      return {
        status,
        processes: status.state === 'connecting' ? s.processes : [],
        selectedTarget: status.state === 'connecting' ? s.selectedTarget : null,
        activeSessionId: null,
        agentSessionId: null,
        reconBusy: false,
        autoPwnBusy: false
      }
    }),
  setProcesses: (procs) =>
    set((s) => {
      if (!s.selectedTarget) return { processes: procs }
      const match = procs.find((p) =>
        s.selectedTarget?.identifier
          ? p.identifier === s.selectedTarget.identifier
          : p.pid === s.selectedTarget?.pid
      )
      return {
        processes: procs,
        selectedTarget: match
          ? { pid: match.pid, identifier: match.identifier }
          : s.selectedTarget.pid === 0
            ? s.selectedTarget
            : null
      }
    }),
  setProcessFilter: (filter) => set({ processFilter: filter }),
  setAppsOnly: (next) => set({ appsOnly: next }),
  selectTarget: (target) => set({ selectedTarget: target }),
  setDraftScript: (text) => set({ draftScript: text }),
  setDraftSourceId: (id) => set({ draftSourceId: id }),
  appendConsole: (entry) =>
    set((s) => ({
      console: [
        ...s.console.slice(-499),
        {
          ...entry,
          id: nextEntryId++,
          at: new Date().toISOString()
        }
      ]
    })),
  clearConsole: () => set({ console: [] }),
  setLastReport: (report) => set({ lastReport: report }),
  setReconBusy: (busy) => set({ reconBusy: busy }),
  setStrategyResults: (results) => set({ lastStrategyResults: results }),
  setAutoPwnBusy: (busy) => set({ autoPwnBusy: busy }),
  setAgentSessionId: (sessionId) => set({ agentSessionId: sessionId }),
  appendEvent: (event) =>
    set((s) => {
      if (s.eventsPaused) return { eventsPausedCount: s.eventsPausedCount + 1 }
      const next = s.events.length >= MAX_EVENTS ? s.events.slice(-(MAX_EVENTS - 1)) : s.events
      return { events: [...next, { ...event, id: nextEntryId++ }] }
    }),
  clearEvents: () => set({ events: [], eventsPausedCount: 0 }),
  setEventsPaused: (paused) =>
    set({
      eventsPaused: paused,
      eventsPausedCount: 0
    }),
  hydrate: async () => {
    const status = await window.api.frida.getStatus()
    set(() => {
      if (status.state === 'connected') return { status }
      return {
        status,
        processes: [],
        selectedTarget: null,
        activeSessionId: null,
        agentSessionId: null,
        reconBusy: false,
        autoPwnBusy: false
      }
    })
    await Promise.all([
      window.api.frida.listBuiltinScripts().then((r) => {
        if (r.ok) set({ builtinScripts: r.value })
      }),
      window.api.frida.listUserScripts().then((r) => {
        if (r.ok) set({ userScripts: r.value })
      })
    ])
  },
  refreshScripts: async () => {
    const r = await window.api.frida.listUserScripts()
    if (r.ok) set({ userScripts: r.value })
  }
}))
