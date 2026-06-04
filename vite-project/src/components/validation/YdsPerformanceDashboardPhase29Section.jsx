import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  buildPerformanceDashboardFromPaperTrading,
  PERFORMANCE_DASHBOARD_LABEL,
  PERFORMANCE_DASHBOARD_PIPELINE,
  PERFORMANCE_PERIOD_FILTERS,
} from "../../trading-zone/ydsPerformanceDashboardEngine.js"

export default function YdsPerformanceDashboardPhase29Section() {
  const [period, setPeriod] = useState("all")
  const report = useMemo(
    () => buildPerformanceDashboardFromPaperTrading(period),
    [period],
  )
  const { summary, counts, pipeline, notes } = report

  return (
    <section
      className="panic-validation-panel yds-perf-dash-p29"
      aria-labelledby="yds-perf-dash-p29-title"
    >
      <h2 id="yds-perf-dash-p29-title" className="panic-validation-panel__h2">
        {PERFORMANCE_DASHBOARD_LABEL}
      </h2>
      <p className="panic-validation-panel__note">
        Paper Trading OPEN·CLOSED 집계 · 실제 매매 아님 · 독립 모듈
      </p>

      <div className="yds-perf-dash-p29__filters" role="tablist" aria-label="기간 필터">
        {PERFORMANCE_PERIOD_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={period === f.id}
            className={period === f.id ? "is-active" : ""}
            onClick={() => setPeriod(/** @type {typeof period} */ (f.id))}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!report.available ? (
        <p className="yds-perf-dash-p29__empty">Paper Trading 기록 없음</p>
      ) : (
        <div className="yds-perf-dash-p29__summary">
          <span>총 {summary.totalTrades}건</span>
          <span>승률 {summary.winRateDisplay}</span>
          <span>평균 {summary.avgProfitDisplay}</span>
          <span>MDD {summary.mddDisplay}</span>
          <span>
            OPEN {counts.open} · CLOSED {counts.closed}
          </span>
        </div>
      )}

      <p className="yds-perf-dash-p29__link-wrap">
        <Link to="/performance-dashboard" className="yds-perf-dash-p29__link">
          Performance Dashboard 전체 화면 →
        </Link>
      </p>

      <div className="yds-perf-dash-p29__block">
        <h3 className="yds-perf-dash-p29__h3">파이프라인</h3>
        <ol className="yds-perf-dash-p29__pipeline">
          {pipeline.map((step, i) => (
            <li key={step.id}>
              <span>{step.label}</span>
              <span className="yds-perf-dash-p29__pipe--active">활성</span>
              {i < PERFORMANCE_DASHBOARD_PIPELINE.length - 1 ? (
                <span className="yds-perf-dash-p29__pipe-arrow" aria-hidden>
                  ↓
                </span>
              ) : null}
            </li>
          ))}
        </ol>
        <pre className="yds-perf-dash-p29__export-json">
          {JSON.stringify(
            {
              period: report.period,
              summary: report.summary,
              counts: report.counts,
            },
            null,
            2,
          )}
        </pre>
      </div>

      <ul className="panic-validation-panel__footnotes">
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </section>
  )
}
