import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from './ui/button'

interface ErrorBoundaryProps {
  /** Optional key — when this changes, the boundary resets and re-mounts.
   *  Useful for "switch back to a different tool" recovery. */
  resetKey?: unknown
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Stops a thrown render error from unmounting the entire app shell. Without
 * this, an oversized Monaco buffer or a malformed captured request blanks
 * the whole window and leaves the user with no recovery path other than
 * deleting `<userData>` by hand.
 *
 * The fallback exposes a "Reset" action that clears the boundary's stored
 * error and re-renders the children — combined with `resetKey`, this gives
 * us per-tool isolation without a full app restart.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface to the structured logger via the preload bridge so the
    // failure also lands in the main process log file.
    try {
      window.api.log.write('error', `Renderer ErrorBoundary: ${error.message}`, {
        stack: error.stack,
        componentStack: info.componentStack
      })
    } catch {
      // ignore — logger may be unavailable if the crash hit the preload too
    }
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught', error, info)
  }

  override componentDidUpdate(prev: ErrorBoundaryProps): void {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  private reset = (): void => {
    this.setState({ error: null })
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div className="max-w-md space-y-2">
          <h2 className="text-base font-semibold tracking-tight">Something crashed in this view</h2>
          <p className="font-mono text-xs leading-relaxed text-muted-foreground">
            {this.state.error.message}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            The rest of MobSec Studio is still alive. Try again or switch to another tool.
          </p>
        </div>
        <Button size="sm" onClick={this.reset}>
          <RotateCcw className="h-3.5 w-3.5" /> Try again
        </Button>
      </div>
    )
  }
}
