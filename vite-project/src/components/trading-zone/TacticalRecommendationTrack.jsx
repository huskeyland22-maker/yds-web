import { Link } from "react-router-dom"
import {
  buildRecommendationTrackRows,
  formatRecommendDateShort,
  formatRecommendPriceRangeCompact,
} from "../../trading-zone/tradingZoneRecommendationTrack.js"

/**
 * @param {{
 *   positions: import("../../trading-zone/tacticalTradingZoneData.js").TradingZonePosition[]
 *   priorityIds?: string[]
 *   liveById?: Record<string, { price?: number | null }>
 * }} props
 */
export default function TacticalRecommendationTrack({
  positions = [],
  priorityIds = [],
  liveById = {},
}) {
  const rows = buildRecommendationTrackRows(positions, priorityIds, liveById)
  if (!rows.length) return null

  return (
    <section
      className="tactical-zone-recommend-track tactical-zone-recommend-track--terminal"
      aria-label="추천 종목 성과 추적"
    >
      <div className="tactical-zone-recommend-track__head">
        <p className="m-0 tactical-zone-recommend-track__title">추천 종목 성과</p>
        <Link to="/panic-validation" className="tactical-zone-recommend-track__link">
          검증
        </Link>
      </div>
      <ul className="m-0 tactical-zone-recommend-track__list">
        {rows.map((row) => {
          const ret = row.returnPct
          const retTone = ret == null ? "flat" : ret > 0 ? "up" : ret < 0 ? "down" : "flat"
          const retLabel =
            ret == null ? "—" : `${ret > 0 ? "+" : ""}${ret.toFixed(1)}%`
          const priceRange = formatRecommendPriceRangeCompact(
            row.recommendedPrice,
            row.currentPrice,
            row.market,
          )

          return (
            <li key={row.id} className="tactical-zone-recommend-track__row">
              <span className="tactical-zone-recommend-track__symbol">{row.symbol}</span>
              <span className="tactical-zone-recommend-track__date font-mono tabular-nums">
                {formatRecommendDateShort(row.recommendedAt)}
              </span>
              <span
                className="tactical-zone-recommend-track__range font-mono tabular-nums"
                title={`추천가 → 현재가 · ${priceRange}`}
              >
                {priceRange}
              </span>
              <span
                className={[
                  "tactical-zone-recommend-track__return font-mono tabular-nums",
                  `tactical-zone-recommend-track__return--${retTone}`,
                ].join(" ")}
              >
                {retLabel}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
