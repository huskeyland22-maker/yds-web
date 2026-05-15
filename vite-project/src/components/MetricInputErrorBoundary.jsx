import { Component } from "react"

/** Isolates market-metric input panel render errors from the rest of the app. */
export default class MetricInputErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(err) {
    return { error: err instanceof Error ? err : new Error(String(err ?? "unknown")) }
  }

  componentDidCatch(err, info) {
    console.error("[MetricInputErrorBoundary]", err, info?.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="fixed top-0 right-0 z-[9999] flex h-[100dvh] w-[min(100vw,22rem)] flex-col justify-center border-l border-rose-500/30 bg-[#0a0d12]/98 p-4 text-slate-200"
          role="alert"
        >
          <p className="m-0 text-sm font-semibold text-rose-200">?? ?? ??</p>
          <p className="m-0 mt-2 text-xs text-slate-400">???? ??? ??? ? ?? ??? ???.</p>
          <button
            type="button"
            className="mt-4 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs hover:bg-white/10"
            onClick={() => this.setState({ error: null })}
          >
            ?? ?? ??
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
