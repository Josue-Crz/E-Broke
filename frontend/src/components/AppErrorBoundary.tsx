import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  failed: boolean
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('e-Broke render error', error, info)
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="fatal-error">
          <span className="brand__mark" aria-hidden="true">e</span>
          <p className="eyebrow">A tiny snag</p>
          <h1>Let’s give that another go.</h1>
          <p>The page hit an unexpected error. Your account and listings are still safe.</p>
          <button className="button button--primary" type="button" onClick={() => window.location.reload()}>
            <RefreshCw size={18} /> Refresh e-Broke
          </button>
        </main>
      )
    }
    return this.props.children
  }
}
