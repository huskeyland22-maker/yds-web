import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  buildRecommendationTrackRows,
  formatRecommendDateShort,
  formatRecommendPriceCompact,
  resolveRecommendationPerformance,
  summarizeRecommendationPerformance,
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
  const [open, setOpen] = useState(false)
  const rows = buildRecommendationTrackRows(positions, priorityIds, liveById)
  if (!rows.length) return null
  const summary = useMemo(() => summarizeRecommendationPerformance(rows), [rows])

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
      <div className="tactical-zone-recommend-track__summary">
        <p className="m-0 tactical-zone-recommend-track__summary-item">
          <span>승률</span>
          <strong className="font-mono tabular-nums">
            {summary.successRate != null ? `${summary.successRate.toFixed(1)}%` : "—"}
          </strong>
        </p>
        <p className="m-0 tactical-zone-recommend-track__summary-item">
          <span>평균 수익률</span>
          <strong className="font-mono tabular-nums">
            {summary.avgReturn != null
              ? `${summary.avgReturn > 0 ? "+" : ""}${summary.avgReturn.toFixed(1)}%`
              : "—"}
          </strong>
        </p>
        <p className="m-0 tactical-zone-recommend-track__summary-item tactical-zone-recommend-track__summary-item--full">
          <span>최고 수익 종목</span>
          <strong className="font-mono tabular-nums">
            {summary.best
              ? `${summary.best.symbol} ${summary.best.returnPct > 0 ? "+" : ""}${summary.best.returnPct.toFixed(1)}%`
              : "—"}
          </strong>
        </p>
      </div>
      <button
        type="button"
        className="tactical-zone-recommend-track__toggle"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "전체 성과 닫기 ▲" : "전체 성과 보기 ▼"}
      </button>
      {open ? <ul className="m-0 tactical-zone-recommend-track__list">
        <li className="tactical-zone-recommend-track__row tactical-zone-recommend-track__row--head" aria-hidden>
          <span>종목</span>
          <span>추천일</span>
          <span>추천가</span>
          <span>현재가</span>
          <span>수익률</span>
          <span>상태</span>
        </li>
        {rows.map((row) => {
          const ret = row.returnPct
          const perf = resolveRecommendationPerformance(ret)
          const retTone = perf.tone
          const retLabel =
            ret == null ? "—" : `${ret > 0 ? "+" : ""}${ret.toFixed(1)}%`
          const recommendedPrice = formatRecommendPriceCompact(row.recommendedPrice, row.market)
          const currentPrice = formatRecommendPriceCompact(row.currentPrice, row.market)

          return (
            <li key={row.id} className="tactical-zone-recommend-track__row">
              <span className="tactical-zone-recommend-track__symbol">{row.symbol}</span>
              <span className="tactical-zone-recommend-track__date font-mono tabular-nums">
                {formatRecommendDateShort(row.recommendedAt)}
              </span>
              <span className="tactical-zone-recommend-track__price font-mono tabular-nums">
                {recommendedPrice}
              </span>
              <span className="tactical-zone-recommend-track__price font-mono tabular-nums">
                {currentPrice}
              </span>
              <span
                className={[
                  "tactical-zone-recommend-track__return font-mono tabular-nums",
                  `tactical-zone-recommend-track__return--${retTone}`,
                ].join(" ")}
              >
                {retLabel}
              </span>
              <span
                className={[
                  "tactical-zone-recommend-track__status",
                  `tactical-zone-recommend-track__status--${perf.id}`,
                ].join(" ")}
                title={`${perf.label} 기준`}
              >
                {`${perf.emoji} ${perf.label}`}
              </span>
            </li>
          )
        })}
      </ul> : null}
    </section>
  )
}
