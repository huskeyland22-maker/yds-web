import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { filterHubHistoryRows, HUB_HISTORY_FILTERS } from "../../content/ydsPickLifecycleEngine.js"
import {
  filterHubHistoryByPeriod,
  groupHubHistoryByTicker,
  HUB_HISTORY_PERIOD_FILTERS,
} from "../../content/ydsStockPickHubHistoryGroupEngine.js"

/**
 * @param {{
 *   report: import("../../content/ydsStockPickTrustEngine.js").ReturnType<typeof import("../../content/ydsStockPickTrustEngine.js").buildStockPickHubHistoryReport>
 *   className?: string
 * }} props
 */
export default function YdsStockPickHubHistory({ report, className = "" }) {
  const [statusFilter, setStatusFilter] = useState("all")
  const [periodFilter, setPeriodFilter] = useState(/** @type {import("../../content/ydsStockPickHubHistoryGroupEngine.js").HubHistoryPeriodId} */ ("all"))
  const [expandedTickers, setExpandedTickers] = useState(() => new Set())

  const filteredRows = useMemo(() => {
    const byStatus = filterHubHistoryRows(report?.rows ?? [], statusFilter)
    return filterHubHistoryByPeriod(byStatus, periodFilter)
  }, [report?.rows, statusFilter, periodFilter])

  const groups = useMemo(() => groupHubHistoryByTicker(filteredRows), [filteredRows])

  const toggleGroup = (ticker) => {
    setExpandedTickers((prev) => {
      const next = new Set(prev)
      if (next.has(ticker)) next.delete(ticker)
      else next.add(ticker)
      return next
    })
  }

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
          {groups.length}종목 · {filteredRows.length}건
        </span>
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

      <div className="yds-spick-hub-history__filters" role="tablist" aria-label="추천 상태 필터">
        {HUB_HISTORY_FILTERS.map((f) => (
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

      {!groups.length ? (
        <p className="yds-spick-hub-history__empty">해당 조건의 추천 이력이 없습니다.</p>
      ) : (
        <div className="yds-spick-hub-history__groups yds-spick-hub-table-scroll">
          <ul className="yds-spick-hub-history__group-list">
            {groups.map((group) => {
              const expanded = expandedTickers.has(group.ticker)
              const latest = group.rows[0]
              return (
                <li key={group.ticker} className="yds-spick-hub-history__group">
                  <button
                    type="button"
                    className="yds-spick-hub-history__group-head"
                    aria-expanded={expanded}
                    onClick={() => toggleGroup(group.ticker)}
                  >
                    <span className="yds-spick-hub-history__group-name">{group.name}</span>
                    <span className="yds-spick-hub-history__group-meta font-mono tabular-nums">
                      {expanded ? "▲" : "▼"} 추천 {group.count}회
                    </span>
                  </button>

                  {!expanded ? (
                    <div className="yds-spick-hub-history__group-preview">
                      <span className="font-mono tabular-nums">
                        {String(latest?.recommendedAt ?? "").slice(0, 10)}
                      </span>
                      <span
                        className={[
                          "yds-spick-hub-history__status",
                          `yds-spick-hub-history__status--${latest?.statusTone ?? "active"}`,
                        ].join(" ")}
                      >
                        {latest?.statusLabel}
                      </span>
                      <span className="font-mono tabular-nums">{latest?.returnLabel}</span>
                    </div>
                  ) : (
                    <ul className="yds-spick-hub-history__entries">
                      {group.rows.map((row) => (
                        <li key={`${row.ticker}-${row.recommendedAt}`} className="yds-spick-hub-history__entry">
                          <span className="yds-spick-hub-history__entry-date font-mono tabular-nums">
                            {String(row.recommendedAt).slice(0, 10)}
                          </span>
                          <span className="font-mono tabular-nums">{row.recommendedPrice ?? "—"}</span>
                          <span className="font-mono tabular-nums">{row.returnLabel}</span>
                          <span
                            className={[
                              "yds-spick-hub-history__status",
                              `yds-spick-hub-history__status--${row.statusTone ?? "active"}`,
                            ].join(" ")}
                          >
                            {row.statusLabel}
                          </span>
                          <span className="yds-spick-hub-history__badge">{row.resultBadge}</span>
                          {row.pickId ? (
                            <Link
                              to={`/performance-validation/pick/${encodeURIComponent(row.pickId)}`}
                              className="yds-spick-hub-history__link"
                            >
                              상세
                            </Link>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
