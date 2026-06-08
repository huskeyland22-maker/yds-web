import { useMemo } from "react"
import { Link } from "react-router-dom"
import { buildOpsDashboard } from "../content/ydsOpsDashboardEngine.js"
import { computeRecommendedAssetAllocation } from "../content/ydsPortfolioAllocationEngine.js"
import { quickActionLabel } from "../content/ydsActionLogEngine.js"
import { useYdsActionLog } from "../hooks/useYdsActionLog.js"
import { useYdsMarketContext } from "../hooks/useYdsMarketContext.js"
import { UI_PAGE } from "../utils/ydsUiLabels.js"
import "../styles/yds-ops-dashboard.css"

function formatReturn(v) {
  if (v == null || !Number.isFinite(v)) return "—"
  return `${v > 0 ? "+" : ""}${v}%`
}

export default function YdsOpsDashboardPage() {
  const marketContext = useYdsMarketContext()
  const { entries } = useYdsActionLog()

  const recommended = useMemo(
    () => computeRecommendedAssetAllocation(marketContext),
    [marketContext],
  )

  const dash = useMemo(
    () => buildOpsDashboard(marketContext, entries, recommended),
    [marketContext, entries, recommended],
  )

  const { market, recentLogs, compliance, returns } = dash

  return (
    <div className="yds-ops min-w-0 px-3 py-4 sm:px-4">
      <header className="yds-ops__header">
        <p className="yds-ops__kicker">{UI_PAGE.opsDashboard.kicker}</p>
        <h1 className="yds-ops__title">{UI_PAGE.opsDashboard.title}</h1>
        <p className="yds-ops__sub">
          5초 운영 점검 ·{" "}
          <Link to="/action-log">행동 로그</Link>
        </p>
      </header>

      <div className="yds-ops__grid yds-ops__grid--core4">
        <section className="yds-ops__card" aria-labelledby="ops-market">
          <h2 id="ops-market" className="yds-ops__card-title">
            현재 시장
          </h2>
          <p className="yds-ops__card-lead">
            {market.strategyEmoji} <strong>{market.strategyLabel}</strong>
          </p>
          <ul className="yds-ops__kv yds-ops__kv--compact">
            <li>
              <span>패닉</span>
              <span>
                {market.panicEmoji} {market.panicLabel}
              </span>
            </li>
            <li>
              <span>사이클</span>
              <span>
                {market.cycleEmoji} {market.cycleLabel}
              </span>
            </li>
          </ul>
        </section>

        <section className="yds-ops__card" aria-labelledby="ops-alloc">
          <h2 id="ops-alloc" className="yds-ops__card-title">
            권장 비중
          </h2>
          <p className="yds-ops__alloc-hero font-mono tabular-nums">
            🇺🇸 {recommended.usPct}% · 🇰🇷 {recommended.krPct}% · 💵 {recommended.cashPct}%
          </p>
        </section>

        <section className="yds-ops__card yds-ops__card--wide" aria-labelledby="ops-logs">
          <h2 id="ops-logs" className="yds-ops__card-title">
            최근 행동
          </h2>
          {!recentLogs.length ? (
            <p className="yds-ops__empty">
              <Link to="/action-log">행동 기록</Link> 없음
            </p>
          ) : (
            <ul className="yds-ops__log-list">
              {recentLogs.map((log) => (
                <li key={log.id} className="yds-ops__log-item">
                  <span className="yds-ops__log-date font-mono tabular-nums">{log.date}</span>
                  <span className="yds-ops__log-val">
                    {log.quickAction
                      ? `${quickActionLabel(log.quickAction)}${log.ticker ? ` ${log.ticker}` : ""}`
                      : `준수 ${log.compliancePct}%`}
                  </span>
                  {log.memo ? <span className="yds-ops__log-memo">{log.memo}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="yds-ops__card" aria-labelledby="ops-compliance">
          <h2 id="ops-compliance" className="yds-ops__card-title">
            준수율
          </h2>
          <p className="yds-ops__compliance-hero font-mono tabular-nums">
            {compliance.d30.overallCompliance ?? "—"}%
          </p>
          <p className="yds-ops__compliance-meta">
            30일 · {compliance.d30.count}건
          </p>
        </section>
      </div>

      <details className="yds-ops__detail">
        <summary className="yds-ops__detail-summary">수익률 · 장기 준수율</summary>
        <div className="yds-ops__detail-body">
          <ul className="yds-ops__metric-list">
            <li className="font-mono tabular-nums">
              90일 준수 {compliance.d90.overallCompliance ?? "—"}%
              <span className="yds-ops__metric-sub">({compliance.d90.count}건)</span>
            </li>
            <li className="font-mono tabular-nums">
              30일 수익 {formatReturn(returns.d30.avgReturnPct)}
              <span className="yds-ops__metric-sub">({returns.d30.count}건)</span>
            </li>
            <li className="font-mono tabular-nums">
              90일 수익 {formatReturn(returns.d90.avgReturnPct)}
              <span className="yds-ops__metric-sub">({returns.d90.count}건)</span>
            </li>
          </ul>
          <Link to="/yds-compare" className="yds-ops__link">
            YDS vs 실제 비교 →
          </Link>
        </div>
      </details>

      <p className="yds-ops__footnote">
        결론 우선 · 근거는 상세에서 · YDS는 운영 시스템
      </p>
    </div>
  )
}
