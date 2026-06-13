import { Link } from "react-router-dom"
import {
  buildTodaySignalReasons,
  pickTodaySignalStock,
} from "../../content/ydsStockPickUxStatus.js"
import YdsStockPickScoreGrid from "./YdsStockPickScoreGrid.jsx"
import YdsStockPickUxStatusBadge from "./YdsStockPickUxStatusBadge.jsx"

/**
 * @param {{
 *   stocks: import("../../content/ydsStockPickModel.js").StockPickView[]
 *   loading?: boolean
 * }} props
 */
export default function YdsStockPickTodaySignal({ stocks, loading = false }) {
  const usStock = pickTodaySignalStock(stocks, "US")
  const krStock = pickTodaySignalStock(stocks, "KR")
  const hasSignal = Boolean(usStock || krStock)

  if (loading && !hasSignal) {
    return (
      <section
        className="yds-spick-section yds-spick-section--signal"
        aria-labelledby="spick-today-signal"
      >
        <h2 id="spick-today-signal" className="yds-spick-section__title">
          🔥 오늘의 시그널
        </h2>
        <p className="yds-spick-empty">시세 조회 중…</p>
      </section>
    )
  }

  if (!hasSignal) return null

  return (
    <section
      className="yds-spick-section yds-spick-section--signal"
      aria-labelledby="spick-today-signal"
    >
      <h2 id="spick-today-signal" className="yds-spick-section__title">
        🔥 오늘의 시그널
      </h2>
      <div className="yds-spick-signal-grid">
        {usStock ? (
          <SignalCard stock={usStock} countryLabel="US" />
        ) : null}
        {krStock ? (
          <SignalCard stock={krStock} countryLabel="KR" />
        ) : null}
      </div>
    </section>
  )
}

/**
 * @param {{
 *   stock: import("../../content/ydsStockPickModel.js").StockPickView
 *   countryLabel: string
 * }} props
 */
function SignalCard({ stock, countryLabel }) {
  const to = `/stock-picks/${encodeURIComponent(stock.ticker)}`
  const reasons = buildTodaySignalReasons(stock, 3)

  return (
    <article className="yds-spick-signal-card">
      <span className="yds-spick-signal-card__country">{countryLabel}</span>
      <Link to={to} className="yds-spick-signal-card__link">
        <h3 className="yds-spick-signal-card__name">{stock.name}</h3>
        <YdsStockPickScoreGrid decomposed={stock.decomposedScores} variant="compact" />
        <YdsStockPickUxStatusBadge
          stock={stock}
          className="yds-spick-signal-card__status"
        />
        {reasons.length ? (
          <ul className="yds-spick-signal-card__reasons">
            {reasons.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        ) : null}
      </Link>
    </article>
  )
}
