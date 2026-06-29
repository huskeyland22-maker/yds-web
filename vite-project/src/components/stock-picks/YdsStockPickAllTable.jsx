import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  buildStockPickListRow,
  loadStockPickTableColumnPrefs,
  saveStockPickTableColumnPrefs,
  sortStockPickList,
  STOCK_PICK_TABLE_COLUMNS,
} from "../../content/ydsStockPickListView.js"
import { applyStockPickFilters } from "../../content/ydsStockPickFilterEngine.js"
import YdsStockPickFilterBar from "./YdsStockPickFilterBar.jsx"
import YdsStockPickRecommendStatusBadge from "./YdsStockPickRecommendStatusBadge.jsx"

/** @typedef {import("../../content/ydsStockPickListView.js").StockPickListSortKey} SortKey */

/**
 * @param {SortKey} colId
 * @param {ReturnType<typeof buildStockPickListRow>} row
 * @param {import("../../content/ydsStockPickModel.js").StockPickView} stock
 */
function renderCell(colId, row, stock) {
  const to = `/stock-picks/${encodeURIComponent(stock.ticker)}`
  switch (colId) {
    case "name":
      return (
        <Link to={to} className="yds-spick-all-table__name">
          {stock.name}
        </Link>
      )
    case "recommendStatusId":
      return <YdsStockPickRecommendStatusBadge stock={stock} compact />
    case "recommendedAt":
      return row.recommendedAt ?? "—"
    case "daysSinceRecommend":
      return row.daysSinceRecommend != null ? `${row.daysSinceRecommend}일` : "—"
    case "recommendedPrice":
      return row.recommendedPriceLabel
    case "currentPriceLabel":
      return row.currentPriceLabel
    case "maxReturnPct": {
      const tone = row.maxReturnPct == null ? "muted" : row.maxReturnPct >= 0 ? "up" : "down"
      return (
        <span className={`yds-spick-all-table__ret--${tone}`}>{row.maxReturnLabel}</span>
      )
    }
    case "returnPct": {
      const tone = row.returnPct == null ? "muted" : row.returnPct >= 0 ? "up" : "down"
      return (
        <span className={`yds-spick-all-table__ret--${tone}`}>{row.returnLabel}</span>
      )
    }
    case "mddPct": {
      const tone = row.mddPct == null ? "muted" : row.mddPct >= 0 ? "up" : "down"
      return (
        <span className={`yds-spick-all-table__ret--${tone}`}>{row.mddLabel}</span>
      )
    }
    case "aiDelta": {
      const tone = row.aiDelta == null ? "muted" : row.aiDelta > 0 ? "up" : row.aiDelta < 0 ? "down" : "muted"
      return (
        <span className={`yds-spick-all-table__ret--${tone}`}>{row.aiDeltaLabel}</span>
      )
    }
    case "recommendGrade":
      return <span className="yds-spick-all-table__grade">{row.recommendGrade}</span>
    default:
      return row[colId] ?? "—"
  }
}

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
  const [visibleCols, setVisibleCols] = useState(() => loadStockPickTableColumnPrefs())
  const [pickerOpen, setPickerOpen] = useState(false)

  const filtered = useMemo(
    () => applyStockPickFilters(stocks, filters, { isFavorite }),
    [stocks, filters, isFavorite],
  )

  const sorted = useMemo(
    () => sortStockPickList(filtered, sortKey, sortDir),
    [filtered, sortKey, sortDir],
  )

  const columns = useMemo(
    () => STOCK_PICK_TABLE_COLUMNS.filter((c) => visibleCols.has(c.id)),
    [visibleCols],
  )

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"))
      return
    }
    setSortKey(key)
    setSortDir("desc")
  }

  const toggleColumn = (id) => {
    setVisibleCols((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        if (next.size <= 3) return prev
        next.delete(id)
      } else {
        next.add(id)
      }
      saveStockPickTableColumnPrefs(next)
      return next
    })
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
        <div className="yds-spick-all-table__tools">
          <button
            type="button"
            className="yds-spick-all-table__col-btn"
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen((v) => !v)}
          >
            컬럼 {pickerOpen ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {pickerOpen ? (
        <div className="yds-spick-all-table__col-picker" role="group" aria-label="표시 컬럼">
          {STOCK_PICK_TABLE_COLUMNS.map((col) => (
            <label key={col.id} className="yds-spick-all-table__col-opt">
              <input
                type="checkbox"
                checked={visibleCols.has(col.id)}
                onChange={() => toggleColumn(col.id)}
              />
              {col.label}
            </label>
          ))}
        </div>
      ) : null}

      {showFilters ? (
        <YdsStockPickFilterBar
          filters={filters}
          onChange={onFiltersChange}
          resultCount={filterResultCount ?? sorted.length}
          className="yds-spick-all-table__filters"
        />
      ) : null}

      {loading && !sorted.length ? (
        <div className="yds-spick-skeleton__table" aria-hidden />
      ) : null}

      {!loading && !sorted.length ? (
        <p className="yds-spick-empty">조건에 맞는 종목이 없습니다.</p>
      ) : null}

      {sorted.length ? (
        <div className="yds-spick-all-table__scroll">
          <table className="yds-spick-all-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.id} scope="col">
                    <button
                      type="button"
                      className={[
                        "yds-spick-all-table__th-sort",
                        sortKey === col.id ? "yds-spick-all-table__th-sort--active" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => toggleSort(col.id)}
                    >
                      {col.label}
                      {sortKey === col.id ? (sortDir === "desc" ? " ↓" : " ↑") : null}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((stock) => {
                const row = buildStockPickListRow(stock)
                return (
                  <tr key={stock.ticker}>
                    {columns.map((col) => (
                      <td
                        key={col.id}
                        className={[
                          "font-mono tabular-nums",
                          col.id === "name" || col.id === "sector" || col.id === "recommendStatusId"
                            ? "yds-spick-all-table__td--text"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {renderCell(col.id, row, stock)}
                      </td>
                    ))}
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
