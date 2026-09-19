import { Component } from 'react'

/** Keeps a crashing card or view from taking down the whole app. */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[Stxck]', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    if (this.props.inline) {
      return (
        <div className="error-box">
          This card couldn’t be displayed. The rest of the answer is unaffected.
        </div>
      )
    }
    return (
      <div className="crash">
        <h1>Something went wrong</h1>
        <p>Stxck hit an unexpected error. Your chats and portfolio are saved on this device.</p>
        <button className="btn btn--primary" onClick={() => location.reload()}>
          Reload Stxck
        </button>
      </div>
    )
  }
}
