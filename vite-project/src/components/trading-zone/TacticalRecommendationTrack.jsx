import { useMemo, useState } from "react"
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
  const [open, setOpen] = useState(false)
  const rows = buildRecommendationTrackRows(positions, priorityIds, liveById)
  if (!rows.length) return null
  const summary = useMemo(() => {
    const withRet = rows.filter((r) => Number.isFinite(r.returnPct))
    const winRate = withRet.length
      ? (withRet.filter((r) => Number(r.returnPct) > 0).length / withRet.length) * 100
      : null
    const avg = withRet.length
      ? withRet.reduce((sum, r) => sum + Number(r.returnPct), 0) / withRet.length
      : null
    const best = [...withRet].sort((a, b) => Number(b.returnPct) - Number(a.returnPct))[0] ?? null
    return { winRate, avg, best }
  }, [rows])

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
            {summary.winRate != null ? `${summary.winRate.toFixed(1)}%` : "—"}
          </strong>
        </p>
        <p className="m-0 tactical-zone-recommend-track__summary-item">
          <span>평균 수익률</span>
          <strong className="font-mono tabular-nums">
            {summary.avg != null ? `${summary.avg > 0 ? "+" : ""}${summary.avg.toFixed(1)}%` : "—"}
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
      </ul> : null}
    </section>
  )
}
