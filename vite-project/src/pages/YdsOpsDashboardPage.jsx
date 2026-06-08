import { useMemo } from "react"
import { Link } from "react-router-dom"
import { buildOpsDashboard } from "../content/ydsOpsDashboardEngine.js"
import { computeRecommendedAssetAllocation } from "../content/ydsPortfolioAllocationEngine.js"
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

  const { market, recentLogs, compliance, returns, summary, compare } = dash

  return (
    <div className="yds-ops min-w-0 px-3 py-4 sm:px-4">
      <header className="yds-ops__header">
        <p className="yds-ops__kicker">{UI_PAGE.opsDashboard.kicker}</p>
        <h1 className="yds-ops__title">{UI_PAGE.opsDashboard.title}</h1>
        <p className="yds-ops__sub">
          10초 운영 점검 ·{" "}
          <Link to="/action-log">행동 로그</Link>
          {" · "}
          <Link to="/yds-compare">비교</Link>
        </p>
      </header>

      <section className="yds-ops__summary" aria-label="요약">
        <p className="yds-ops__summary-line">
          <span className="yds-ops__summary-emoji">{summary.strategyEmoji}</span>
          <strong>{summary.strategyLabel}</strong>
        </p>
        <p className="yds-ops__summary-metrics font-mono tabular-nums">
          준수율 {summary.compliancePct != null ? `${summary.compliancePct}%` : "—"}
          {" · "}
          평균 수익률 {formatReturn(summary.avgReturnPct)}
        </p>
        {!compare.statsReady ? (
          <p className="yds-ops__summary-note">
            수익률 비교 통계 {compare.minSamples}건 이후 활성화 (현재 {compare.returnEntryCount}건)
          </p>
        ) : null}
      </section>

      <div className="yds-ops__grid">
        <section className="yds-ops__card" aria-labelledby="ops-market">
          <h2 id="ops-market" className="yds-ops__card-title">
            1 · 현재 시장
          </h2>
          <ul className="yds-ops__kv">
            <li>
              <span>패닉</span>
              <span>
                {market.panicEmoji} {market.panicLabel}
              </span>
            </li>
            <li>
              <span>전략</span>
              <span>
                {market.strategyEmoji} {market.strategyLabel}
              </span>
            </li>
            <li>
              <span>사이클</span>
              <span>
                {market.cycleEmoji} {market.cycleLabel}
              </span>
            </li>
            <li>
              <span>상태</span>
              <span>
                {market.marketEmoji} {market.marketLabel}
              </span>
            </li>
          </ul>
        </section>

        <section className="yds-ops__card" aria-labelledby="ops-alloc">
          <h2 id="ops-alloc" className="yds-ops__card-title">
            2 · 권장 비중
          </h2>
          <p className="yds-ops__alloc-hero font-mono tabular-nums">
            🇺🇸 {recommended.usPct}% · 🇰🇷 {recommended.krPct}% · 💵 {recommended.cashPct}%
          </p>
          <Link to="/portfolio" className="yds-ops__link">
            포트폴리오 상세 →
          </Link>
        </section>

        <section className="yds-ops__card yds-ops__card--wide" aria-labelledby="ops-logs">
          <h2 id="ops-logs" className="yds-ops__card-title">
            3 · 최근 행동 로그
          </h2>
          {!recentLogs.length ? (
            <p className="yds-ops__empty">
              <Link to="/action-log">행동 로그</Link> 기록 없음
            </p>
          ) : (
            <ul className="yds-ops__log-list">
              {recentLogs.map((log) => (
                <li key={log.id} className="yds-ops__log-item">
                  <span className="yds-ops__log-date font-mono tabular-nums">{log.date}</span>
                  <span className="yds-ops__log-val font-mono tabular-nums">
                    준수 {log.compliancePct}%
                    {log.returnPct != null ? ` · ${formatReturn(log.returnPct)}` : ""}
                  </span>
                  {log.memo ? <span className="yds-ops__log-memo">{log.memo}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="yds-ops__card" aria-labelledby="ops-compliance">
          <h2 id="ops-compliance" className="yds-ops__card-title">
            4 · 준수율
          </h2>
          <ul className="yds-ops__metric-list">
            <li className="font-mono tabular-nums">
              30일 {compliance.d30.overallCompliance ?? "—"}%
              <span className="yds-ops__metric-sub">({compliance.d30.count}건)</span>
            </li>
            <li className="font-mono tabular-nums">
              90일 {compliance.d90.overallCompliance ?? "—"}%
              <span className="yds-ops__metric-sub">({compliance.d90.count}건)</span>
            </li>
            <li className="font-mono tabular-nums">
              전체 {compliance.all.overallCompliance ?? "—"}%
              <span className="yds-ops__metric-sub">({compliance.all.count}건)</span>
            </li>
          </ul>
        </section>

        <section className="yds-ops__card" aria-labelledby="ops-returns">
          <h2 id="ops-returns" className="yds-ops__card-title">
            5 · 수익률
          </h2>
          <ul className="yds-ops__metric-list">
            <li className="font-mono tabular-nums">
              30일 {formatReturn(returns.d30.avgReturnPct)}
              <span className="yds-ops__metric-sub">({returns.d30.count}건)</span>
            </li>
            <li className="font-mono tabular-nums">
              90일 {formatReturn(returns.d90.avgReturnPct)}
              <span className="yds-ops__metric-sub">({returns.d90.count}건)</span>
            </li>
            <li className="font-mono tabular-nums">
              180일 {formatReturn(returns.d180.avgReturnPct)}
              <span className="yds-ops__metric-sub">({returns.d180.count}건)</span>
            </li>
          </ul>
        </section>
      </div>

      <p className="yds-ops__footnote">
        신규 신호 없음 · 기존 데이터 집계만 · YDS는 운영 시스템
      </p>
    </div>
  )
}
