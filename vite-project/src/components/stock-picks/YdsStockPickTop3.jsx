import { useLayoutEffect, useRef } from "react"
import { TOP5_MEDALS } from "../../content/ydsStockPickModel.js"
import { markTimeline } from "../../content/ydsFirstEntryTimeline.js"
import { markTop5Paint } from "../../content/ydsStockPickPerf.js"
import { recordComponentMount } from "../../content/ydsStockPickRenderPerf.js"
import YdsStockPickHeroCard from "./YdsStockPickHeroCard.jsx"

/**
 * @param {{
 *   stocks: import("../../content/ydsStockPickModel.js").StockPickView[]
 *   isFavorite: (ticker: string) => boolean
 *   onToggleFavorite: (ticker: string) => void
 *   heldTickers?: Set<string>
 *   statusChanges?: Map<string, { fromLabel: string; toLabel: string }>
 *   loading?: boolean
 *   sectionId?: string
 * }} props
 */
export default function YdsStockPickTop3({
  stocks,
  isFavorite,
  onToggleFavorite,
  heldTickers = new Set(),
  loading,
  sectionId = "spick-top5",
}) {
  const renderT0 = useRef(null)

  if (stocks.length && !loading && renderT0.current == null) {
    renderT0.current = performance.now()
  }

  useLayoutEffect(() => {
    if (loading || !stocks.length || renderT0.current == null) return
    recordComponentMount("top5", performance.now() - renderT0.current, {
      count: stocks.length,
    })
    markTimeline("FIRST_RENDER")
    markTop5Paint()
  }, [loading, stocks.length])

  return (
    <section className="yds-spick-section yds-spick-section--hero" aria-labelledby={sectionId}>
      <h2 id={sectionId} className="yds-spick-section__title yds-spick-section__title--tier">
        ③ TOP5
      </h2>
      {loading && !stocks.length ? (
        <p className="yds-spick-empty">시세 조회 중…</p>
      ) : null}
      {stocks.length ? (
        <div className="yds-spick-top5 yds-spick-top5--hero">
          {stocks.map((stock, index) => (
            <YdsStockPickHeroCard
              key={stock.ticker}
              stock={stock}
              medal={TOP5_MEDALS[index]}
              rankIndex={index}
              isFavorite={isFavorite(stock.ticker)}
              onToggleFavorite={onToggleFavorite}
              isHeld={heldTickers.has(stock.ticker.toUpperCase())}
            />
          ))}
        </div>
      ) : !loading ? (
        <p className="yds-spick-empty">표시할 종목이 없습니다.</p>
      ) : null}
    </section>
  )
}
