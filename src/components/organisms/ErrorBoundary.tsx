import { Component, type ReactNode } from 'react'
import { PrimaryButton } from '@/components/atoms/Button'

type Props = { children: ReactNode }
type State = { hasError: boolean }

// getDerivedStateFromError alone makes this a valid error boundary — no componentDidCatch,
// since main.tsx's root onCaughtError (Sentry.reactErrorHandler()) already reports every
// caught error centrally; a second manual report here would double-count it.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100svh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
          textAlign: 'center',
          backgroundColor: 'var(--color-bg-deep)',
          fontFamily: 'Georgia, serif',
        }}>
          <h1 style={{ color: 'var(--color-gold-light)', fontSize: 22, letterSpacing: '1px' }}>Something broke</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14, maxWidth: 360 }}>
            The page hit an error and couldn&rsquo;t continue. Reloading usually fixes it — your
            progress is saved on the server, not in this tab.
          </p>
          <PrimaryButton onClick={() => window.location.reload()}>Reload</PrimaryButton>
        </div>
      )
    }
    return this.props.children
  }
}
