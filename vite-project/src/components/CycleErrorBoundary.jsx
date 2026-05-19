import { Component } from "react"

/**
 * /cycle 전용 — 데스크 렌더 실패 시 흰 화면 대신 복구 UI.
 * @extends {Component<{ children: import("react").ReactNode }>}
 */
export default class CycleErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(err) {
    return { error: err instanceof Error ? err : new Error(String(err)) }
  }

  componentDidCatch(err, info) {
    console.error("[CycleErrorBoundary]", err, info?.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="market-cycle-page min-w-0 px-3 py-8" role="alert">
        <div className="mx-auto max-w-md rounded-xl border border-rose-500/30 bg-[#111827]/95 p-5 text-slate-200">
          <p className="m-0 text-sm font-semibold text-rose-100">시장 사이클 화면을 불러오지 못했습니다</p>
          <p className="m-0 mt-2 text-xs text-slate-400">일시적 오류일 수 있습니다. 새로고침해 주세요.</p>
          <pre className="mt-3 max-h-32 overflow-auto rounded border border-white/10 bg-black/40 p-2 font-mono text-[10px] text-rose-200/90">
            {error.message}
          </pre>
          <button
            type="button"
            className="mt-4 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100"
            onClick={() => window.location.reload()}
          >
            새로고침
          </button>
        </div>
      </div>
    )
  }
}
