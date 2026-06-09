import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronRight, Copy, Loader2, Terminal, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useFridaStore } from '@/stores/useFridaStore'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EntryKind = 'input' | 'ok' | 'error' | 'log'
const MAX_REPL_ENTRIES = 500

interface ReplEntry {
  id: number
  kind: EntryKind
  text: string
}

let _nextId = 1
function nextId(): number {
  return _nextId++
}

function capEntries(entries: ReplEntry[]): ReplEntry[] {
  return entries.length > MAX_REPL_ENTRIES ? entries.slice(-MAX_REPL_ENTRIES) : entries
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GLYPH: Record<EntryKind, string> = {
  input: '›',
  ok: '←',
  error: '✗',
  log: '·'
}

const KIND_CLASS: Record<EntryKind, string> = {
  input: 'text-sky-400',
  ok: 'text-emerald-400',
  error: 'text-red-400',
  log: 'text-muted-foreground/75'
}

// ---------------------------------------------------------------------------
// ConsoleREPL
// ---------------------------------------------------------------------------

interface ConsoleREPLProps {
  sessionId: string | null
}

export function ConsoleREPL({ sessionId }: ConsoleREPLProps): JSX.Element {
  const [entries, setEntries] = useState<ReplEntry[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)

  // Command history — most-recent first.
  const [cmdHistory, setCmdHistory] = useState<string[]>([])
  const [historyIdx, setHistoryIdx] = useState(-1)
  // Saved draft so Down-arrow returns the user to what they were typing.
  const [savedDraft, setSavedDraft] = useState('')

  const outputRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Track how many store console entries we've already ingested so we can
  // pick up the delta on every re-render.
  const processedConsoleIdx = useRef(0)
  const storeConsole = useFridaStore((s) => s.console)

  // --- Helpers ---------------------------------------------------------------

  const addEntry = useCallback((kind: EntryKind, text: string) => {
    setEntries((prev) => capEntries([...prev, { id: nextId(), kind, text }]))
  }, [])

  // --- Session lifecycle -----------------------------------------------------

  // When the session changes: show a header banner and reset the console
  // pointer so we don't re-show historical messages from the bottom dock.
  useEffect(() => {
    if (!sessionId) return
    setEntries([
      {
        id: nextId(),
        kind: 'log',
        text: `─── session ${sessionId.slice(0, 8)}… ─── type Frida JS, press Enter to run ───`
      }
    ])
    processedConsoleIdx.current = storeConsole.length
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // --- console.log ingestion -------------------------------------------------

  // Whenever new console entries arrive for the active session, append them
  // as 'log' entries so they appear inline with REPL input/output.
  useEffect(() => {
    const fresh = storeConsole.slice(processedConsoleIdx.current)
    processedConsoleIdx.current = storeConsole.length
    if (fresh.length === 0) return
    const forSession = sessionId ? fresh.filter((e) => e.sessionId === sessionId) : fresh
    if (forSession.length === 0) return
    setEntries((prev) =>
      capEntries([
        ...prev,
        ...forSession.map((e) => ({
          id: nextId(),
          kind: 'log' as EntryKind,
          text: e.text
        }))
      ])
    )
  }, [storeConsole, sessionId])

  // --- Auto-scroll -----------------------------------------------------------

  useEffect(() => {
    const el = outputRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [entries, busy])

  // --- Textarea auto-height --------------------------------------------------

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 128)}px`
  }, [input])

  // --- Submit ----------------------------------------------------------------

  const submit = useCallback(async () => {
    const code = input.trim()
    if (!code || !sessionId || busy) return

    // Record to history (dedup, cap at 200).
    setCmdHistory((prev) => {
      const deduped = prev.filter((c) => c !== code)
      return [code, ...deduped].slice(0, 200)
    })
    setHistoryIdx(-1)
    setSavedDraft('')
    setInput('')
    addEntry('input', code)
    setBusy(true)

    const result = await window.api.frida.evalCode(sessionId, code)
    setBusy(false)

    if (!result.ok) {
      addEntry('error', `[ipc] ${result.error}`)
    } else if (!result.value.ok) {
      addEntry('error', result.value.value)
    } else {
      addEntry('ok', result.value.value)
    }
  }, [input, sessionId, busy, addEntry])

  // --- History navigation ----------------------------------------------------

  const navigateHistory = useCallback(
    (direction: 'up' | 'down') => {
      if (direction === 'up') {
        if (historyIdx === -1) setSavedDraft(input)
        const next = Math.min(historyIdx + 1, cmdHistory.length - 1)
        if (next >= 0 && cmdHistory[next] !== undefined) {
          setHistoryIdx(next)
          setInput(cmdHistory[next])
        }
      } else {
        if (historyIdx <= 0) {
          setHistoryIdx(-1)
          setInput(savedDraft)
        } else {
          const next = historyIdx - 1
          setHistoryIdx(next)
          setInput(cmdHistory[next] ?? '')
        }
      }
    },
    [cmdHistory, historyIdx, input, savedDraft]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void submit()
        return
      }
      // History navigation only when the input is single-line (no newlines).
      const isSingleLine = !input.includes('\n')
      if (e.key === 'ArrowUp' && isSingleLine) {
        e.preventDefault()
        navigateHistory('up')
        return
      }
      if (e.key === 'ArrowDown' && isSingleLine) {
        e.preventDefault()
        navigateHistory('down')
      }
    },
    [submit, input, navigateHistory]
  )

  // --- Toolbar actions -------------------------------------------------------

  const clearAll = useCallback(() => {
    setEntries([])
  }, [])

  const copyAll = useCallback(() => {
    const text = entries.map((e) => `${GLYPH[e.kind]} ${e.text}`).join('\n')
    void navigator.clipboard.writeText(text).then(() => toast.success('Copied to clipboard'))
  }, [entries])

  // ---------------------------------------------------------------------------
  // Empty state — no active session
  // ---------------------------------------------------------------------------

  if (!sessionId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <Terminal className="h-10 w-10 opacity-25" />
        <div className="text-center">
          <p className="text-sm font-medium">No active session</p>
          <p className="mt-0.5 text-xs opacity-70">
            Attach to a process, run Recon, or Auto-Pwn first
          </p>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // REPL
  // ---------------------------------------------------------------------------

  return (
    <div className="flex h-full flex-col bg-background font-mono text-xs">
      {/* Toolbar */}
      <div className="flex h-7 shrink-0 items-center gap-2 border-b border-border bg-surface/30 px-3">
        <Terminal className="h-3 w-3 shrink-0 text-primary/70" />
        <span className="truncate text-2xs text-muted-foreground">
          session <span className="text-foreground/60">{sessionId.slice(0, 8)}…</span>
          {busy && <Loader2 className="ml-2 inline h-2.5 w-2.5 animate-spin opacity-60" />}
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={copyAll}>
                <Copy className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Copy history</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={clearAll}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Clear output</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Output */}
      <div
        ref={outputRef}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-2"
        aria-live="polite"
        aria-label="REPL output"
      >
        {entries.length === 0 && (
          <div className="select-none py-1 text-muted-foreground/40">— console clear —</div>
        )}
        {entries.map((e) => (
          <div key={e.id} className={cn('flex min-w-0 gap-2 py-0.5 leading-5', KIND_CLASS[e.kind])}>
            <span className="w-4 shrink-0 select-none text-right opacity-50">{GLYPH[e.kind]}</span>
            <pre className="min-w-0 flex-1 whitespace-pre-wrap break-all">{e.text}</pre>
          </div>
        ))}
        {busy && (
          <div className="flex gap-2 py-0.5 text-muted-foreground/40">
            <span className="w-4 shrink-0 select-none text-right">…</span>
            <span>evaluating</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex shrink-0 items-end gap-1 border-t border-border bg-surface/20 px-3 py-1.5">
        <span className="mb-1 shrink-0 select-none font-semibold text-primary">›</span>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setHistoryIdx(-1)
          }}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Frida JS… (Enter to run · Shift+Enter for newline · ↑↓ history)"
          disabled={busy}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          className={cn(
            'min-h-[1.25rem] flex-1 resize-none overflow-hidden bg-transparent',
            'text-foreground placeholder:text-muted-foreground/40',
            'leading-5 outline-none',
            busy && 'cursor-not-allowed opacity-50'
          )}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="mb-0.5 h-6 w-6 shrink-0 text-primary disabled:opacity-30"
              disabled={!input.trim() || busy}
              onClick={() => void submit()}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Run (Enter)</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
