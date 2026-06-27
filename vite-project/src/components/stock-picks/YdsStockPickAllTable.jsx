import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  buildStockPickListRow,
  sortStockPickList,
} from "../../content/ydsStockPickListView.js"
import { filterBySector } from "../../content/ydsStockPickModel.js"
import YdsStockPickFavoriteButton from "./YdsStockPickFavoriteButton.jsx"
import YdsStockPickAiConfidenceBar from "./YdsStockPickAiConfidenceBar.jsx"

/** @typedef {import("../../content/ydsStockPickListView.js").StockPickListSortKey} SortKey */

const SORT_OPTIONS = [
  { id: "aiScore", label: "AI점수" },
  { id: "recommendGrade", label: "추천등급" },
  { id: "returnPct", label: "수익률" },
]

/**
 * @param {{
 *   stocks: import("../../content/ydsStockPickModel.js").StockPickView[]
 *   sectorId?: string
 *   onSectorChange?: (id: string) => void
 *   isFavorite: (ticker: string) => boolean
 *   onToggleFavorite: (ticker: string) => void
 *   sectionId?: string
 *   loading?: boolean
 * }} props
 */
export default function YdsStockPickAllTable({
  stocks,
  sectorId = "all",
  isFavorite,
  onToggleFavorite,
  sectionId = "spick-all",
  loading = false,
}) {
  const [sortKey, setSortKey] = useState(/** @type {SortKey} */ ("aiScore"))
  const [sortDir, setSortDir] = useState(/** @type {'asc' | 'desc'} */ ("desc"))

  const filtered = useMemo(
    () => filterBySector(stocks, sectorId),
    [stocks, sectorId],
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

      {loading && !sorted.length ? (
        <p className="yds-spick-empty">시세 조회 중…</p>
      ) : null}

      {!loading && !sorted.length ? (
        <p className="yds-spick-empty">표시할 종목이 없습니다.</p>
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
                <th scope="col">섹터</th>
                <th scope="col">추천가</th>
                <th scope="col">현재가</th>
                <th scope="col">수익률</th>
                <th scope="col">신뢰도</th>
                <th scope="col" aria-label="관심등록" />
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
                      <span
                        className={`yds-spick-all-table__status yds-spick-all-table__status--${row.statusTone}`}
                      >
                        {row.statusLabel}
                      </span>
                    </td>
                    <td className="yds-spick-all-table__sector">{row.sector}</td>
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
                    <td className="yds-spick-all-table__conf">
                      <YdsStockPickAiConfidenceBar
                        score={row.confidenceScore}
                        compact
                        showMeta={false}
                      />
                    </td>
                    <td>
                      <YdsStockPickFavoriteButton
                        active={isFavorite(stock.ticker)}
                        onToggle={() => onToggleFavorite(stock.ticker)}
                      />
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
