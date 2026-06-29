import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { loadValidationPicks } from "../../content/ydsValidationStorage.js"
import { buildRecommendPerfReport } from "../../content/ydsRecommendPerfReportEngine.js"
import { formatPerfPct } from "../../content/ydsPickPerformanceEngine.js"

/**
 * @param {{ className?: string; windowDays?: number }} props
 */
export default function YdsRecommendPerformanceReport({ className = "", windowDays = 30 }) {
  const [horizonKey, setHorizonKey] = useState("d30")
  const report = useMemo(() => {
    const picks = loadValidationPicks()
    return buildRecommendPerfReport(picks, windowDays)
  }, [windowDays])

  const kpi = report.horizons.find((h) => h.key === horizonKey) ?? report.kpi

  if (!report.visible) {
    return (
      <section className={["yds-rec-perf-report yds-rec-perf-report--empty", className].filter(Boolean).join(" ")}>
        <p className="yds-rec-perf-report__title">추천 성과 리포트</p>
        <p className="yds-rec-perf-report__empty">저장된 추천 데이터가 쌓이면 성과가 표시됩니다.</p>
      </section>
    )
  }

  return (
    <section
      className={["yds-rec-perf-report", className].filter(Boolean).join(" ")}
      aria-label={report.title}
    >
      <div className="yds-rec-perf-report__head">
        <div>
          <h2 className="yds-rec-perf-report__title">{report.title}</h2>
          <p className="yds-rec-perf-report__sub">최근 {windowDays}일 · 실제 저장 추천 기준</p>
        </div>
        <Link to="/performance-validation" className="yds-rec-perf-report__link">
          상세 검증 →
        </Link>
      </div>

      <div className="yds-rec-perf-report__tabs" role="tablist" aria-label="성과 기간">
        {report.horizons.map((h) => (
          <button
            key={h.key}
            type="button"
            role="tab"
            aria-selected={horizonKey === h.key}
            className={[
              "yds-rec-perf-report__tab",
              horizonKey === h.key ? "yds-rec-perf-report__tab--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setHorizonKey(h.key)}
          >
            {h.label}
          </button>
        ))}
      </div>

      <dl className="yds-rec-perf-report__kpi">
        <div>
          <dt>추천 종목 수</dt>
          <dd className="font-mono tabular-nums">{kpi.count}</dd>
        </div>
        <div>
          <dt>승률</dt>
          <dd className="font-mono tabular-nums">
            {kpi.winRate != null ? `${kpi.winRate}%` : kpi.successRate != null ? `${kpi.successRate}%` : "—"}
          </dd>
        </div>
        <div>
          <dt>평균 수익률</dt>
          <dd className="font-mono tabular-nums">{formatPerfPct(kpi.avgReturn)}</dd>
        </div>
        <div>
          <dt>평균 손실률</dt>
          <dd className="font-mono tabular-nums">{formatPerfPct(kpi.avgLoss)}</dd>
        </div>
        <div>
          <dt>손익비</dt>
          <dd className="font-mono tabular-nums">
            {kpi.profitFactor != null ? kpi.profitFactor.toFixed(2) : "—"}
          </dd>
        </div>
        <div>
          <dt>평균 보유기간</dt>
          <dd>{kpi.avgHoldDays != null ? `${kpi.avgHoldDays}일` : "—"}</dd>
        </div>
        <div>
          <dt>Alpha (SPY 대비)</dt>
          <dd className="font-mono tabular-nums">{formatPerfPct(kpi.alpha)}</dd>
        </div>
      </dl>

      {report.recentPicks.length ? (
        <div className="yds-rec-perf-report__table-wrap">
          <p className="yds-rec-perf-report__table-title">최근 추천 종목</p>
          <table className="yds-rec-perf-report__table">
            <thead>
              <tr>
                <th>종목</th>
                <th>추천일</th>
                <th>추천가</th>
                <th>현재가</th>
                <th>수익률</th>
                <th>최고</th>
                <th>최대손실</th>
                <th>유지일</th>
                <th>결과</th>
              </tr>
            </thead>
            <tbody>
              {report.recentPicks.map((row) => (
                <tr key={`${row.ticker}-${row.recommendedAt}`}>
                  <td>{row.name}</td>
                  <td className="font-mono tabular-nums">{row.recommendedAt}</td>
                  <td className="font-mono tabular-nums">{row.recommendedPrice}</td>
                  <td className="font-mono tabular-nums">{row.currentPrice}</td>
                  <td
                    className={[
                      "font-mono tabular-nums",
                      row.returnPct != null && row.returnPct >= 0
                        ? "yds-rec-perf-report__up"
                        : "yds-rec-perf-report__down",
                    ].join(" ")}
                  >
                    {row.returnLabel}
                  </td>
                  <td className="font-mono tabular-nums yds-rec-perf-report__up">{row.maxReturnLabel}</td>
                  <td className="font-mono tabular-nums yds-rec-perf-report__down">{row.maxLossLabel}</td>
                  <td>{row.daysHeldLabel}</td>
                  <td>{row.successLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}
