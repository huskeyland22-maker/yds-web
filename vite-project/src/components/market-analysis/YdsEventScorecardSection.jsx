import { SCORECARD_HORIZONS } from "../../content/ydsEventScorecard.js"

function fmtPct(v) {
  if (v == null || !Number.isFinite(v)) return "—"
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`
}

function fmtWinRate(v) {
  if (v == null || !Number.isFinite(v)) return "—"
  return `${Math.round(v * 1000) / 10}%`
}

/**
 * V1.9 Event Scorecard — Timeline 아래
 * @param {{
 *   rows?: import("../../content/ydsEventScorecard.js").EventTypeScorecard[]
 *   loading?: boolean
 *   className?: string
 * }} props
 */
export default function YdsEventScorecardSection({ rows = [], loading = false, className = "" }) {
  const displayRows = rows.filter((r) => r.eventCount > 0)

  if (!loading && displayRows.length === 0) return null

  return (
    <section
      className={["yds-event-scorecard", className].filter(Boolean).join(" ")}
      aria-label="Event Scorecard"
    >
      <div className="yds-event-scorecard__head">
        <h2 className="yds-event-scorecard__title">Event Scorecard</h2>
        <p className="yds-event-scorecard__sub">SPY 발생 후 수익률 · 과거 적중률 (3·7·14 거래일)</p>
      </div>

      {loading ? (
        <p className="yds-event-scorecard__loading" role="status">
          SPY 히스토리 로딩 중…
        </p>
      ) : (
        <div className="yds-event-scorecard__table-wrap">
          <table className="yds-event-scorecard__table">
            <thead>
              <tr>
                <th scope="col">이벤트</th>
                <th scope="col">등급</th>
                <th scope="col">건수</th>
                <th scope="col">승률(14d)</th>
                {SCORECARD_HORIZONS.map((h) => (
                  <th key={h} scope="col">
                    {h}d
                  </th>
                ))}
                <th scope="col">MDD(14d)</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row) => (
                <tr key={row.type}>
                  <td className="yds-event-scorecard__event">{row.title}</td>
                  <td>
                    <span
                      className={[
                        "yds-event-scorecard__grade",
                        `yds-event-scorecard__grade--${row.grade.toLowerCase()}`,
                        row.insufficient ? "yds-event-scorecard__grade--insufficient" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {row.insufficient ? "D" : row.gradeLabel}
                    </span>
                  </td>
                  <td className="font-mono tabular-nums">{row.eventCount}</td>
                  <td className="font-mono tabular-nums">{fmtWinRate(row.winRate)}</td>
                  {SCORECARD_HORIZONS.map((h) => (
                    <td key={h} className="font-mono tabular-nums">
                      {fmtPct(row.avgReturnPct[h])}
                    </td>
                  ))}
                  <td className="font-mono tabular-nums">{fmtPct(row.maxDrawdownPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
