import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { loadValidationPicks } from "../../content/ydsValidationStorage.js"
import { buildRecommendPerfReport } from "../../content/ydsRecommendPerfReportEngine.js"
import { formatPerfPct } from "../../content/ydsPickPerformanceEngine.js"

/**
 * @param {{ className?: string; windowDays?: number; refreshKey?: number; stocks?: import("../../content/ydsStockPickModel.js").StockPickView[] }} props
 */
export default function YdsRecommendPerformanceReport({
  className = "",
  windowDays = 30,
  refreshKey = 0,
  stocks = [],
}) {
  const [horizonKey, setHorizonKey] = useState("d30")
  const [expanded, setExpanded] = useState(false)
  const report = useMemo(() => {
    const picks = loadValidationPicks()
    return buildRecommendPerfReport(picks, windowDays, stocks)
  }, [windowDays, refreshKey, stocks])

  const kpi = report.horizons.find((h) => h.key === horizonKey) ?? report.kpi
  const stats = report.trustStats ?? kpi
  const summary = report.summaryCards
  const winRate = stats.winRate != null ? `${stats.winRate}%` : "—"
  const initialCount = stats.initialRecommendCount ?? stats.count ?? 0
  const reCount = stats.reRecommendCount ?? 0
  const uniqueTickers = stats.uniqueTickerCount ?? initialCount
  const alpha = stats.alpha ?? kpi.alpha

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
      className={[
        "yds-rec-perf-report",
        expanded ? "yds-rec-perf-report--expanded" : "yds-rec-perf-report--collapsed",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={report.title}
    >
      <div className="yds-rec-perf-report__summary">
        <div className="yds-rec-perf-report__summary-head">
          <div>
            <h2 className="yds-rec-perf-report__title">{report.title}</h2>
            <p className="yds-rec-perf-report__sub">저장된 추천 이력 기준 · 최신순</p>
          </div>
          <Link to="/performance-validation/picks" className="yds-rec-perf-report__link">
            상세 검증 →
          </Link>
        </div>

        {report.briefing ? (
          <p className="yds-rec-perf-report__briefing">{report.briefing}</p>
        ) : null}

        {summary ? (
          <dl className="yds-rec-perf-report__hero-cards">
            <div className="yds-rec-perf-report__hero-card">
              <dt>총 추천</dt>
              <dd className="font-mono tabular-nums">{summary.totalCount}건</dd>
            </div>
            <div className="yds-rec-perf-report__hero-card">
              <dt>현재 진행</dt>
              <dd className="font-mono tabular-nums">{summary.activeCount}건</dd>
            </div>
            <div className="yds-rec-perf-report__hero-card">
              <dt>평균 수익률</dt>
              <dd className="font-mono tabular-nums">{summary.avgReturnLabel}</dd>
            </div>
            <div className="yds-rec-perf-report__hero-card">
              <dt>승률</dt>
              <dd className="font-mono tabular-nums">{summary.winRateLabel}</dd>
            </div>
            <div className="yds-rec-perf-report__hero-card yds-rec-perf-report__hero-card--wide">
              <dt>최고 수익 종목</dt>
              <dd>
                {summary.bestPick ? (
                  <>
                    <span className="yds-rec-perf-report__hero-name">{summary.bestPick.name}</span>
                    <span className="font-mono tabular-nums yds-rec-perf-report__up">
                      {summary.bestPick.returnLabel}
                    </span>
                  </>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div className="yds-rec-perf-report__hero-card yds-rec-perf-report__hero-card--wide">
              <dt>최대 손실 종목</dt>
              <dd>
                {summary.worstPick ? (
                  <>
                    <span className="yds-rec-perf-report__hero-name">{summary.worstPick.name}</span>
                    <span className="font-mono tabular-nums yds-rec-perf-report__down">
                      {summary.worstPick.returnLabel}
                    </span>
                  </>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
        ) : null}

        <dl className="yds-rec-perf-report__summary-kpi">
          <div>
            <dt>최근 {windowDays}일 추천</dt>
            <dd className="font-mono tabular-nums">{initialCount}건</dd>
          </div>
          <div>
            <dt>재추천</dt>
            <dd className="font-mono tabular-nums">{reCount}건</dd>
          </div>
          <div>
            <dt>고유 종목</dt>
            <dd className="font-mono tabular-nums">{uniqueTickers}개</dd>
          </div>
        </dl>
        <dl className="yds-rec-perf-report__summary-kpi yds-rec-perf-report__summary-kpi--secondary">
          <div>
            <dt>기간 평균수익</dt>
            <dd className="font-mono tabular-nums">{formatPerfPct(stats.avgReturn)}</dd>
          </div>
          <div>
            <dt>S&P 초과</dt>
            <dd className="font-mono tabular-nums">{formatPerfPct(alpha)}</dd>
          </div>
          <div>
            <dt>기간 승률</dt>
            <dd className="font-mono tabular-nums">{winRate}</dd>
          </div>
        </dl>

        <button
          type="button"
          className="yds-rec-perf-report__toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "접기 ▲" : "상세 보기 ▼"}
        </button>
      </div>

      {expanded ? (
        <div className="yds-rec-perf-report__detail">
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
              <dt>성공</dt>
              <dd className="font-mono tabular-nums">{stats.successCount ?? 0}</dd>
            </div>
            <div>
              <dt>실패</dt>
              <dd className="font-mono tabular-nums">{stats.failureCount ?? 0}</dd>
            </div>
            <div>
              <dt>종료</dt>
              <dd className="font-mono tabular-nums">{stats.endedCount ?? 0}</dd>
            </div>
            <div>
              <dt>보유중</dt>
              <dd className="font-mono tabular-nums">{stats.holdingCount ?? 0}</dd>
            </div>
            <div>
              <dt>평균 보유기간</dt>
              <dd>{stats.avgHoldDays != null ? `${stats.avgHoldDays}일` : "—"}</dd>
            </div>
            <div>
              <dt>평균 AI점수</dt>
              <dd className="font-mono tabular-nums">{stats.avgAiScore ?? "—"}</dd>
            </div>
          </dl>

          {report.recentPicks.length ? (
            <div className="yds-rec-perf-report__table-wrap yds-spick-hub-table-scroll">
              <p className="yds-rec-perf-report__table-title">최근 추천 종목</p>
              <table className="yds-rec-perf-report__table">
                <thead>
                  <tr>
                    <th>종목</th>
                    <th>추천일</th>
                    <th>추천가</th>
                    <th>현재가</th>
                    <th>수익률</th>
                    <th>유지일</th>
                    <th>상태</th>
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
                      <td>{row.daysHeldLabel}</td>
                      <td>{row.statusLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
