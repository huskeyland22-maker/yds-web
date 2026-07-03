import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  filterHubHistoryByPeriod,
  HUB_HISTORY_PERIOD_FILTERS,
} from "../../content/ydsStockPickHubHistoryGroupEngine.js"
import {
  filterHubHistoryViewRows,
  HUB_HISTORY_VIEW_FILTERS,
} from "../../content/ydsHubHistoryViewEngine.js"

/**
 * @param {{
 *   report: import("../../content/ydsStockPickTrustEngine.js").ReturnType<typeof import("../../content/ydsStockPickTrustEngine.js").buildStockPickHubHistoryReport>
 *   className?: string
 * }} props
 */
export default function YdsStockPickHubHistory({ report, className = "" }) {
  const [statusFilter, setStatusFilter] = useState("all")
  const [periodFilter, setPeriodFilter] = useState(/** @type {import("../../content/ydsStockPickHubHistoryGroupEngine.js").HubHistoryPeriodId} */ ("all"))

  const filteredRows = useMemo(() => {
    const byStatus = filterHubHistoryViewRows(report?.rows ?? [], statusFilter)
    return filterHubHistoryByPeriod(byStatus, periodFilter)
  }, [report?.rows, statusFilter, periodFilter])

  if (!report?.visible || !report.rows?.length) return null

  return (
    <section
      className={["yds-spick-section", "yds-spick-hub-history", className].filter(Boolean).join(" ")}
      aria-label={report.title}
    >
      <div className="yds-spick-hub-history__head">
        <h2 className="yds-spick-section__title yds-spick-section__title--tier">
          {report.title}
        </h2>
        <span className="yds-spick-hub-history__count font-mono tabular-nums">
          {filteredRows.length}건 · 최신순
        </span>
      </div>

      <div className="yds-spick-hub-history__filters" role="tablist" aria-label="상태 필터">
        {HUB_HISTORY_VIEW_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={statusFilter === f.id}
            className={[
              "yds-spick-hub-history__filter",
              statusFilter === f.id ? "yds-spick-hub-history__filter--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setStatusFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="yds-spick-hub-history__filters" role="tablist" aria-label="기간 필터">
        {HUB_HISTORY_PERIOD_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={periodFilter === f.id}
            className={[
              "yds-spick-hub-history__filter",
              periodFilter === f.id ? "yds-spick-hub-history__filter--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setPeriodFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!filteredRows.length ? (
        <p className="yds-spick-hub-history__empty">해당 조건의 추천 이력이 없습니다.</p>
      ) : (
        <div className="yds-spick-hub-history__scroll yds-spick-hub-table-scroll">
          <table className="yds-spick-hub-history__table yds-spick-hub-history__table--rich">
            <thead>
              <tr>
                <th>종목</th>
                <th>추천일</th>
                <th>추천가</th>
                <th>현재가</th>
                <th>수익률</th>
                <th>경과</th>
                <th>AI 등급</th>
                <th>추천 사유</th>
                <th>배지</th>
                <th aria-label="상세" />
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.pickId}>
                  <td>
                    <Link
                      to={`/stock-picks/${encodeURIComponent(row.ticker)}`}
                      className="yds-spick-hub-history__name-link"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="font-mono tabular-nums">{row.recommendedAtLabel}</td>
                  <td className="font-mono tabular-nums">{row.recommendedPriceLabel}</td>
                  <td className="font-mono tabular-nums">{row.currentPriceLabel}</td>
                  <td
                    className={[
                      "font-mono tabular-nums",
                      `yds-spick-hub-history__ret--${row.returnTone}`,
                    ].join(" ")}
                  >
                    {row.returnLabel}
                  </td>
                  <td className="font-mono tabular-nums">{row.elapsedLabel}</td>
                  <td>{row.aiGradeLabel}</td>
                  <td className="yds-spick-hub-history__reason" title={row.reasonLine}>
                    {row.reasonLine}
                  </td>
                  <td>
                    <div className="yds-spick-hub-history__badge-row">
                      {row.badges.map((badge) => (
                        <span
                          key={`${row.pickId}-${badge.label}`}
                          className={[
                            "yds-spick-hub-history__badge-chip",
                            `yds-spick-hub-history__badge-chip--${badge.tone}`,
                          ].join(" ")}
                        >
                          {badge.emoji} {badge.label}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    {row.pickId ? (
                      <Link
                        to={`/performance-validation/pick/${encodeURIComponent(row.pickId)}`}
                        className="yds-spick-hub-history__link"
                      >
                        상세
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
