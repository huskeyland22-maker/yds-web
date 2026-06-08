import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { sortStockPicks } from "../../content/ydsStockPickModel.js"

/** @typedef {import("../../content/ydsStockPickModel.js").StockPickSortKey} StockPickSortKey */

/**
 * @param {{
 *   stocks: import("../../content/ydsStockPickModel.js").StockPickView[]
 * }} props
 */
export default function YdsStockPickRanking({ stocks }) {
  const [sortKey, setSortKey] = useState(/** @type {StockPickSortKey} */ ("rank"))
  const [sortDir, setSortDir] = useState(/** @type {'asc' | 'desc'} */ ("asc"))

  const ranked = useMemo(() => sortStockPicks(stocks, sortKey, sortDir), [stocks, sortKey, sortDir])

  /** @param {StockPickSortKey} key */
  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
      return
    }
    setSortKey(key)
    setSortDir(key === "name" ? "asc" : "desc")
  }

  /** @param {StockPickSortKey} key */
  function sortIndicator(key) {
    if (sortKey !== key) return ""
    return sortDir === "asc" ? " ↑" : " ↓"
  }

  return (
    <section className="yds-spick-section" aria-labelledby="spick-ranking">
      <h2 id="spick-ranking" className="yds-spick-section__title">
        추천 순위
      </h2>

      <div className="yds-spick-ranking">
        <div className="yds-spick-ranking__head" role="row">
          <button type="button" className="yds-spick-ranking__th" onClick={() => toggleSort("rank")}>
            순위{sortIndicator("rank")}
          </button>
          <button type="button" className="yds-spick-ranking__th" onClick={() => toggleSort("name")}>
            종목{sortIndicator("name")}
          </button>
          <span className="yds-spick-ranking__th yds-spick-ranking__th--static">상태</span>
          <span className="yds-spick-ranking__th yds-spick-ranking__th--static">행동</span>
        </div>

        <ol className="yds-spick-ranking__list">
          {ranked.map((stock, index) => (
            <li key={stock.ticker} className="yds-spick-ranking__row">
              <Link to={`/stock-picks/${stock.ticker}`} className="yds-spick-ranking__link">
                <span className="yds-spick-ranking__rank font-mono tabular-nums">
                  {sortKey === "rank" ? stock.rank : index + 1}
                </span>
                <span className="yds-spick-ranking__name">
                  <strong>{stock.name}</strong>
                  <span className="yds-spick-ranking__ticker font-mono tabular-nums">{stock.ticker}</span>
                </span>
                <span className="yds-spick-ranking__status">
                  {stock.stockStatus.emoji} {stock.stockStatus.label}
                </span>
                <span className="yds-spick-ranking__action">
                  {stock.stockAction.emoji} {stock.stockAction.label}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
