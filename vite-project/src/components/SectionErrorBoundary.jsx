import { Component } from "react"

/**
 * 섹션 단위 오류 격리 — 한 카드가 터져도 나머지 라우트는 유지.
 * @extends {Component<{ children: import("react").ReactNode; label?: string; className?: string }>}
 */
export default class SectionErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(err) {
    return { error: err instanceof Error ? err : new Error(String(err)) }
  }

  componentDidCatch(err, info) {
    console.error(`[SectionErrorBoundary:${this.props.label ?? "section"}]`, err, info?.componentStack)
  }

  render() {
    const { error } = this.state
    if (error) {
      const wrap = this.props.className ?? "rounded-xl border border-rose-500/25 bg-rose-950/20 px-4 py-4 text-sm text-rose-100/90"
      return (
        <section className={wrap} role="alert">
          <p className="m-0 font-semibold text-rose-200">이 구역을 표시하지 못했습니다</p>
          <p className="m-0 mt-1 text-xs text-rose-200/75">{this.props.label ? `${this.props.label} · ` : ""}{error.message}</p>
          <button
            type="button"
            className="mt-3 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
            onClick={() => this.setState({ error: null })}
          >
            다시 시도
          </button>
        </section>
      )
    }
    return this.props.children
  }
}
