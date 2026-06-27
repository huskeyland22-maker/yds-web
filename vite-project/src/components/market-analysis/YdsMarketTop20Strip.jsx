import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { assignRanks, filterByCountry, getRecommendEngineSortScore } from "../../content/ydsStockPickModel.js"
import { getRegimeTopStocks } from "../../content/ydsStockPickMarketRegime.js"
import { useStockPickLiveData } from "../../hooks/useStockPickLiveData.js"
import { useYdsMarketContext } from "../../hooks/useYdsMarketContext.js"

/** @typedef {'recommend' | 'ai' | 'upside'} Top20SortKey */

const SORT_OPTIONS = /** @type {ReadonlyArray<{ id: Top20SortKey; label: string }>} */ ([
  { id: "recommend", label: "추천점수순" },
  { id: "ai", label: "AI점수순" },
  { id: "upside", label: "상승확률순" },
])

const TOP20_LIMIT = 20

/**
 * @param {import("../../content/ydsStockPickModel.js").StockPickView} stock
 * @param {Top20SortKey} sortKey
 */
function sortValue(stock, sortKey) {
  if (sortKey === "recommend") return getRecommendEngineSortScore(stock)
  if (sortKey === "ai") return stock.scoreBreakdown?.quality ?? stock.v4Score?.quality ?? 0
  return stock.v4Score?.timing ?? stock.scoreBreakdown?.timing ?? 0
}

/**
 * @param {import("../../content/ydsStockPickModel.js").StockPickView[]} stocks
 * @param {Top20SortKey} sortKey
 */
function sortTopStocks(stocks, sortKey) {
  return [...stocks].sort((a, b) => sortValue(b, sortKey) - sortValue(a, sortKey))
}

/**
 * @param {{ className?: string }} props
 */
export default function YdsMarketTop20Strip({ className = "" }) {
  const [sortKey, setSortKey] = useState(/** @type {Top20SortKey} */ ("recommend"))
  const marketContext = useYdsMarketContext()
  const { stocks: liveStocks, loading } = useStockPickLiveData(marketContext)

  const ranked = useMemo(() => {
    const us = assignRanks(filterByCountry(liveStocks, "US"))
    const limit = Math.min(TOP20_LIMIT, marketContext.pickDisplayLimit ?? TOP20_LIMIT)
    const capped = getRegimeTopStocks(us, limit)
    return sortTopStocks(capped, sortKey).slice(0, TOP20_LIMIT)
  }, [liveStocks, marketContext.pickDisplayLimit, sortKey])

  if (!marketContext.ready) return null

  return (
    <section
      className={["yds-market-top20", className].filter(Boolean).join(" ")}
      aria-label="TOP20 랭킹"
    >
      <div className="yds-market-top20__head">
        <h2 className="yds-market-top20__title">TOP20</h2>
        <div className="yds-market-top20__sorts" role="tablist" aria-label="정렬">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={sortKey === opt.id}
              className={[
                "yds-market-top20__sort",
                sortKey === opt.id ? "yds-market-top20__sort--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setSortKey(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !ranked.length ? (
        <p className="yds-market-top20__loading" role="status">
          랭킹 동기화 중…
        </p>
      ) : ranked.length ? (
        <ol className="yds-market-top20__list">
          {ranked.map((stock, index) => (
            <li key={stock.ticker} className="yds-market-top20__item">
              <span className="yds-market-top20__rank font-mono tabular-nums">{index + 1}</span>
              <Link
                to={`/stock-picks/${encodeURIComponent(stock.ticker)}`}
                className="yds-market-top20__name"
              >
                {stock.name}
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="yds-market-top20__empty">현재 구간 랭킹을 준비 중입니다.</p>
      )}
    </section>
  )
}
