import { Component } from "react"

/**
 * 앱 루트 근처 마지막 방어선 — 미처리 렌더 예외 시 전체가 검은 화면만 나오는 것을 방지.
 * @extends {Component<{ children: import("react").ReactNode }>}
 */
export default class RootErrorBoundary extends Component {
  state = { error: null }

  clearCacheAndReload = () => {
    try {
      const u = new URL(window.location.href)
      u.searchParams.set("reset-cache", "true")
      window.location.href = u.toString()
    } catch {
      window.location.reload()
    }
  }

  static getDerivedStateFromError(err) {
    return { error: err instanceof Error ? err : new Error(String(err)) }
  }

  componentDidCatch(err, info) {
    console.error("[RootErrorBoundary]", err, info?.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="min-h-[100dvh] bg-[#0b0e14] px-4 py-10 text-slate-200">
        <div className="mx-auto max-w-lg rounded-xl border border-amber-500/30 bg-[#111827]/90 p-6 shadow-lg">
          <h1 className="m-0 text-lg font-semibold text-amber-100">화면을 그리는 중 문제가 생겼습니다</h1>
          <p className="m-0 mt-2 text-sm text-slate-400">
            일부 데이터나 컴포넌트 오류로 전체 UI가 중단되었습니다. 새로고침하면 대부분 복구됩니다.
          </p>
          <pre className="mt-4 max-h-40 overflow-auto rounded-md border border-white/10 bg-black/40 p-3 font-mono text-[11px] text-rose-200/90">
            {error.message}
          </pre>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-500/20"
              onClick={() => window.location.reload()}
            >
              새로고침
            </button>
            <button
              type="button"
              className="rounded-lg border border-violet-500/35 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-100 hover:bg-violet-500/20"
              onClick={this.clearCacheAndReload}
            >
              캐시 초기화 후 다시 로드
            </button>
          </div>
        </div>
      </div>
    )
  }
}
