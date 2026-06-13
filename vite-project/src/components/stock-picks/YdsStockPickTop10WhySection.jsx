import { getTop10Stocks } from "../../content/ydsStockPickModel.js"
import YdsStockPickWhyCard from "./YdsStockPickWhyCard.jsx"

/**
 * @param {{
 *   stocks: import("../../content/ydsStockPickModel.js").StockPickView[]
 *   loading?: boolean
 * }} props
 */
export default function YdsStockPickTop10WhySection({ stocks, loading = false }) {
  const top10 = getTop10Stocks(stocks)

  if (!top10.length && !loading) return null

  return (
    <section className="yds-spick-section yds-spick-section--why" aria-labelledby="spick-top10-why">
      <h2 id="spick-top10-why" className="yds-spick-section__title">
        왜 이 종목인가? · TOP10
      </h2>
      <p className="yds-spick-section__subtitle">상위 추천 종목만 산업·병목·실적·기술·액션 요약</p>

      {loading && !top10.length ? (
        <p className="yds-spick-empty">시세 조회 중…</p>
      ) : null}

      {top10.length ? (
        <div className="yds-spick-why-list">
          {top10.map((stock, index) => (
            <YdsStockPickWhyCard key={stock.ticker} stock={stock} rank={index + 1} />
          ))}
        </div>
      ) : null}
    </section>
  )
}
