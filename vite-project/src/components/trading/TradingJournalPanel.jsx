import { Link } from "react-router-dom"

/**
 * TradingView-style dark trade log table
 *
 * @param {{
 *   journal: ReturnType<import("../../trading-zone/ydsPrecursorEnginePhase28.js").buildTradingJournalFromTrades>
 *   compact?: boolean
 * }} props
 */
export default function TradingJournalPanel({ journal, compact = false }) {
  const { available, recentTrades, stats, asOf } = journal

  if (!available) {
    return <p className="yds-trading-journal__empty">트레이드 기록이 없습니다.</p>
  }

  return (
    <div className={`yds-trading-journal${compact ? " yds-trading-journal--compact" : ""}`}>
      {!compact && asOf ? (
        <p className="yds-trading-journal__asof">기준 {String(asOf).slice(0, 10)} · 브라우저 저장</p>
      ) : null}

      <div className="yds-trading-journal__stats" role="group" aria-label="통계">
        <div className="yds-trading-journal__stat">
          <span className="yds-trading-journal__stat-key">총 거래</span>
          <strong className="yds-trading-journal__stat-val font-mono tabular-nums">
            {stats.totalTrades}
          </strong>
        </div>
        <div className="yds-trading-journal__stat">
          <span className="yds-trading-journal__stat-key">승률</span>
          <strong className="yds-trading-journal__stat-val font-mono tabular-nums">
            {stats.winRateDisplay}
          </strong>
        </div>
        <div className="yds-trading-journal__stat">
          <span className="yds-trading-journal__stat-key">평균 수익</span>
          <strong className="yds-trading-journal__stat-val yds-trading-journal__stat-val--up font-mono tabular-nums">
            {stats.avgProfitDisplay}
          </strong>
        </div>
        <div className="yds-trading-journal__stat">
          <span className="yds-trading-journal__stat-key">평균 손실</span>
          <strong className="yds-trading-journal__stat-val yds-trading-journal__stat-val--down font-mono tabular-nums">
            {stats.avgLossDisplay}
          </strong>
        </div>
        <div className="yds-trading-journal__stat">
          <span className="yds-trading-journal__stat-key">손익비</span>
          <strong className="yds-trading-journal__stat-val font-mono tabular-nums">
            {stats.profitFactorDisplay}
          </strong>
        </div>
        <div className="yds-trading-journal__stat">
          <span className="yds-trading-journal__stat-key">최대 수익</span>
          <strong className="yds-trading-journal__stat-val yds-trading-journal__stat-val--up font-mono tabular-nums">
            {stats.maxProfitDisplay}
          </strong>
        </div>
        <div className="yds-trading-journal__stat">
          <span className="yds-trading-journal__stat-key">최대 손실</span>
          <strong className="yds-trading-journal__stat-val yds-trading-journal__stat-val--down font-mono tabular-nums">
            {stats.maxLossDisplay}
          </strong>
        </div>
      </div>

      <div className="yds-trading-journal__table-wrap">
        <table className="yds-trading-journal__table">
          <thead>
            <tr>
              <th scope="col">종목</th>
              <th scope="col">진입일</th>
              <th scope="col" className="yds-trading-journal__num">
                진입가
              </th>
              <th scope="col" className="yds-trading-journal__num">
                현재가
              </th>
              <th scope="col" className="yds-trading-journal__num">
                수익률
              </th>
              <th scope="col">상태</th>
            </tr>
          </thead>
          <tbody>
            {recentTrades.map((row) => (
              <tr key={row.id} className={`yds-trading-journal__row yds-trading-journal__row--${row.status}`}>
                <td>
                  <span className="yds-trading-journal__name">{row.name}</span>
                  {row.entryGrade ? (
                    <span className="yds-trading-journal__grade">{row.entryGrade}</span>
                  ) : null}
                </td>
                <td className="yds-trading-journal__date font-mono tabular-nums">{row.entryDate}</td>
                <td className="yds-trading-journal__num font-mono tabular-nums">{row.entryPriceDisplay}</td>
                <td className="yds-trading-journal__num font-mono tabular-nums">{row.currentPriceDisplay}</td>
                <td
                  className={[
                    "yds-trading-journal__num font-mono tabular-nums",
                    row.tone === "up"
                      ? "yds-trading-journal__pct--up"
                      : row.tone === "down"
                        ? "yds-trading-journal__pct--down"
                        : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {row.returnDisplay}
                </td>
                <td>
                  <span
                    className={[
                      "yds-trading-journal__status",
                      `yds-trading-journal__status--${row.status}`,
                    ].join(" ")}
                  >
                    {row.statusLabel}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!compact ? (
        <p className="yds-trading-journal__foot">
          최근 20건 ·{" "}
          <Link to="/trading-log" className="yds-trading-journal__link">
            전체 트레이딩 로그
          </Link>
          {weightsNote ? null : null}
        </p>
      ) : null}
    </div>
  )
}
