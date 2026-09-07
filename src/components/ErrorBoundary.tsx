import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Without this, a single throw during render unmounts the entire application and leaves a
 * blank white document — no header, no footer, no way back. That is exactly what a malformed
 * artist id used to do: `doc(db, 'artists', 'bts/x')` throws synchronously, and the whole app
 * disappeared for the rest of the session.
 */
interface Props {
  children: ReactNode
}
interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          That page hit an error on our side. The rest of the site is fine.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <a href="/" className="btn-gradient inline-flex min-h-11 items-center rounded-full px-5 text-sm font-semibold">
            Back to rankings
          </a>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="inline-flex min-h-11 items-center rounded-full border border-[var(--color-hairline)] px-5 text-sm font-medium transition hover:bg-[var(--color-surface-sunken)] dark:border-[var(--color-hairline-dark)] dark:hover:bg-[var(--color-surface-sunken-dark)]"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }
}
