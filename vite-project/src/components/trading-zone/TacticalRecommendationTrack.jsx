import { Link } from "react-router-dom"
import {
  buildRecommendationTrackRows,
  formatRecommendDateShort,
  formatRecommendPrice,
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
    <section className="tactical-zone-recommend-track" aria-label="추천 종목 성과 추적">
      <div className="tactical-zone-recommend-track__head">
        <p className="m-0 tactical-zone-recommend-track__title">추천 종목 성과</p>
        <Link to="/panic-validation" className="tactical-zone-recommend-track__link">
          패닉지수 검증
        </Link>
      </div>
      <ul className="m-0 tactical-zone-recommend-track__list">
        {rows.map((row) => {
          const ret = row.returnPct
          const retTone = ret == null ? "flat" : ret > 0 ? "up" : ret < 0 ? "down" : "flat"
          const retLabel =
            ret == null ? "—" : `${ret > 0 ? "+" : ""}${ret.toFixed(1)}%`
          return (
            <li key={row.id} className="tactical-zone-recommend-track__item">
              <div className="tactical-zone-recommend-track__symbol-row">
                <span className="tactical-zone-recommend-track__symbol">{row.symbol}</span>
                <span
                  className={[
                    "tactical-zone-recommend-track__return font-mono tabular-nums",
                    `tactical-zone-recommend-track__return--${retTone}`,
                  ].join(" ")}
                >
                  {retLabel}
                </span>
              </div>
              <p className="m-0 tactical-zone-recommend-track__meta">
                {formatRecommendDateShort(row.recommendedAt)} 추천
              </p>
              <p className="m-0 tactical-zone-recommend-track__price font-mono tabular-nums">
                {formatRecommendPrice(row.recommendedPrice, row.market)} →{" "}
                {formatRecommendPrice(row.currentPrice, row.market)}
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
