import { Link } from "react-router-dom"
import { buildStockPickListRow } from "../../content/ydsStockPickListView.js"
import {
  estimateHoldPeriodLabel,
  estimateUpsidePct,
} from "../../content/ydsStockPickDashboardEngine.js"
import { resolveRecommendStatusView } from "../../content/ydsStockPickRecommendColors.js"
import { pickTodaySignalStock } from "../../content/ydsStockPickUxStatus.js"
import YdsStockPickAiConfidenceBar from "./YdsStockPickAiConfidenceBar.jsx"
import YdsStockPickRecommendStatusBadge from "./YdsStockPickRecommendStatusBadge.jsx"

/**
 * @param {{
 *   stocks: import("../../content/ydsStockPickModel.js").StockPickView[]
 *   loading?: boolean
 *   embedded?: boolean
 * }} props
 */
export default function YdsStockPickTodaySignal({ stocks, loading = false, embedded = false }) {
  const usStock = pickTodaySignalStock(stocks, "US")
  const krStock = pickTodaySignalStock(stocks, "KR")
  const hasSignal = Boolean(usStock || krStock)

  if (loading && !hasSignal) {
    if (embedded) return <p className="yds-spick-empty">시세 조회 중…</p>
    return (
      <section className="yds-spick-section yds-spick-section--signal" aria-labelledby="spick-today-signal">
        <h2 id="spick-today-signal" className="yds-spick-section__title">오늘의 추천</h2>
        <p className="yds-spick-empty">시세 조회 중…</p>
      </section>
    )
  }

  if (!hasSignal) return null

  const grid = (
    <div className="yds-spick-signal-grid">
      {usStock ? <SignalCard stock={usStock} countryLabel="US" priority={1} /> : null}
      {krStock ? <SignalCard stock={krStock} countryLabel="KR" priority={2} /> : null}
    </div>
  )

  if (embedded) return grid

  return (
    <section className="yds-spick-section yds-spick-section--signal" aria-labelledby="spick-today-signal">
      <h2 id="spick-today-signal" className="yds-spick-section__title">오늘의 추천</h2>
      {grid}
    </section>
  )
}

/**
 * @param {{
 *   stock: import("../../content/ydsStockPickModel.js").StockPickView
 *   countryLabel: string
 *   priority: number
 * }} props
 */
function SignalCard({ stock, countryLabel, priority }) {
  const to = `/stock-picks/${encodeURIComponent(stock.ticker)}`
  const trust = stock.trustReport
  const row = buildStockPickListRow(stock)
  const status = resolveRecommendStatusView(stock)
  const reasons = (trust?.topReasons ?? [])
    .map((r) => r.text)
    .slice(0, 3)
  const upside = estimateUpsidePct(stock, stock.rank - 1)
  const holdPeriod = estimateHoldPeriodLabel(status.id)

  return (
    <article className="yds-spick-signal-card yds-spick-signal-card--cta">
      <div className="yds-spick-signal-card__head">
        <span className="yds-spick-signal-card__country">{countryLabel}</span>
        <span className="yds-spick-signal-card__priority font-mono tabular-nums">
          우선순위 #{priority}
        </span>
      </div>

      <Link to={to} className="yds-spick-signal-card__name-link">
        <h3 className="yds-spick-signal-card__name">{stock.name}</h3>
      </Link>

      <YdsStockPickRecommendStatusBadge stock={stock} className="yds-spick-signal-card__status" />

      {reasons.length ? (
        <ul className="yds-spick-signal-card__reasons">
          {reasons.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      ) : null}

      <dl className="yds-spick-signal-card__metrics">
        <div>
          <dt>추천가</dt>
          <dd className="font-mono tabular-nums">{row.recommendedPriceLabel}</dd>
        </div>
        <div>
          <dt>현재가</dt>
          <dd className="font-mono tabular-nums">{row.currentPriceLabel}</dd>
        </div>
        <div>
          <dt>상승여력</dt>
          <dd className="font-mono tabular-nums">+{upside}%</dd>
        </div>
        <div>
          <dt>보유기간</dt>
          <dd>{holdPeriod}</dd>
        </div>
      </dl>

      <YdsStockPickAiConfidenceBar
        score={trust?.aiConfidence?.score}
        className="yds-spick-signal-card__conf"
      />

      <Link to={to} className="yds-spick-signal-card__cta">
        AI 상세 분석 보기
      </Link>
    </article>
  )
}
