import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  buildStockPickListRow,
  sortStockPickList,
} from "../../content/ydsStockPickListView.js"
import { applyStockPickFilters } from "../../content/ydsStockPickFilterEngine.js"
import YdsStockPickFilterBar from "./YdsStockPickFilterBar.jsx"
import YdsStockPickRecommendStatusBadge from "./YdsStockPickRecommendStatusBadge.jsx"

/** @typedef {import("../../content/ydsStockPickListView.js").StockPickListSortKey} SortKey */

const SORT_OPTIONS = [
  { id: "aiScore", label: "AI점수" },
  { id: "recommendGrade", label: "추천등급" },
  { id: "returnPct", label: "수익률" },
]

/**
 * @param {{
 *   stocks: import("../../content/ydsStockPickModel.js").StockPickView[]
 *   filters: import("../../content/ydsStockPickFilterEngine.js").StockPickFilterState
 *   onFiltersChange: (f: import("../../content/ydsStockPickFilterEngine.js").StockPickFilterState) => void
 *   isFavorite: (ticker: string) => boolean
 *   sectionId?: string
 *   loading?: boolean
 *   showFilters?: boolean
 *   filterResultCount?: number
 * }} props
 */
export default function YdsStockPickAllTable({
  stocks,
  filters,
  onFiltersChange,
  isFavorite,
  sectionId = "spick-all",
  loading = false,
  showFilters = false,
  filterResultCount,
}) {
  const [sortKey, setSortKey] = useState(/** @type {SortKey} */ ("aiScore"))
  const [sortDir, setSortDir] = useState(/** @type {'asc' | 'desc'} */ ("desc"))

  const filtered = useMemo(
    () => applyStockPickFilters(stocks, filters, { isFavorite }),
    [stocks, filters, isFavorite],
  )

  const sorted = useMemo(
    () => sortStockPickList(filtered, sortKey, sortDir),
    [filtered, sortKey, sortDir],
  )

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"))
      return
    }
    setSortKey(key)
    setSortDir("desc")
  }

  return (
    <section
      className="yds-spick-section yds-spick-section--all-table"
      aria-labelledby={sectionId}
    >
      <div className="yds-spick-section__head-row">
        <h2 id={sectionId} className="yds-spick-section__title yds-spick-section__title--inline yds-spick-section__title--tier">
          ④ 전체 종목
        </h2>
        <div className="yds-spick-all-table__sorts" role="group" aria-label="정렬">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={[
                "yds-spick-all-table__sort",
                sortKey === opt.id ? "yds-spick-all-table__sort--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-pressed={sortKey === opt.id}
              onClick={() => toggleSort(/** @type {SortKey} */ (opt.id))}
            >
              {opt.label}
              {sortKey === opt.id ? (sortDir === "desc" ? " ↓" : " ↑") : null}
            </button>
          ))}
        </div>
      </div>

      {showFilters ? (
        <YdsStockPickFilterBar
          filters={filters}
          onChange={onFiltersChange}
          resultCount={filterResultCount ?? sorted.length}
          className="yds-spick-all-table__filters"
        />
      ) : null}

      {loading && !sorted.length ? (
        <p className="yds-spick-empty">시세 조회 중…</p>
      ) : null}

      {!loading && !sorted.length ? (
        <p className="yds-spick-empty">조건에 맞는 종목이 없습니다.</p>
      ) : null}

      {sorted.length ? (
        <div className="yds-spick-all-table__scroll">
          <table className="yds-spick-all-table">
            <thead>
              <tr>
                <th scope="col">종목</th>
                <th scope="col">AI</th>
                <th scope="col">등급</th>
                <th scope="col">상태</th>
                <th scope="col">추천가</th>
                <th scope="col">현재가</th>
                <th scope="col">수익률</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((stock) => {
                const row = buildStockPickListRow(stock)
                const to = `/stock-picks/${encodeURIComponent(stock.ticker)}`
                const retTone =
                  row.returnPct == null ? "muted" : row.returnPct >= 0 ? "up" : "down"
                return (
                  <tr key={stock.ticker}>
                    <td>
                      <Link to={to} className="yds-spick-all-table__name">
                        {stock.name}
                      </Link>
                    </td>
                    <td className="font-mono tabular-nums">{row.aiScore}</td>
                    <td className="font-mono tabular-nums yds-spick-all-table__grade">
                      {row.recommendGrade}
                    </td>
                    <td>
                      <YdsStockPickRecommendStatusBadge stock={stock} compact />
                    </td>
                    <td className="font-mono tabular-nums">{row.recommendedPriceLabel}</td>
                    <td className="font-mono tabular-nums">{row.currentPriceLabel}</td>
                    <td
                      className={[
                        "font-mono tabular-nums",
                        `yds-spick-all-table__ret--${retTone}`,
                      ].join(" ")}
                    >
                      {row.returnLabel}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}
