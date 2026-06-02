import { Link } from "react-router-dom"
import { buildRecommendationTrackRows } from "../../trading-zone/tradingZoneRecommendationTrack.js"

/**
 * @param {{
 *   positions: import("../../trading-zone/tacticalTradingZoneData.js").TradingZonePosition[]
 *   priorityIds?: string[]
 *   liveById?: Record<string, { price?: number | null }>
 * }} props
 */
export default function TacticalRecommendationValidationCard({
  positions = [],
  priorityIds = [],
  liveById = {},
}) {
  const rows = buildRecommendationTrackRows(positions, priorityIds, liveById)
  if (!rows.length) return null

  const withRet = rows.filter((r) => Number.isFinite(r.returnPct))
  const winRate = withRet.length
    ? (withRet.filter((r) => Number(r.returnPct) > 0).length / withRet.length) * 100
    : null
  const avgReturn = withRet.length
    ? withRet.reduce((sum, r) => sum + Number(r.returnPct), 0) / withRet.length
    : null
  const sorted = [...withRet].sort((a, b) => Number(b.returnPct) - Number(a.returnPct))
  const best = sorted[0] ?? null

  const fmtPct = (v) => {
    if (v == null || !Number.isFinite(v)) return "—"
    return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`
  }

  return (
    <section className="tactical-zone-validation-card" aria-label="추천엔진 검증 요약">
      <div className="tactical-zone-validation-card__head">
        <p className="m-0 tactical-zone-validation-card__title">추천엔진 검증 요약</p>
        <Link to="/panic-validation" className="tactical-zone-validation-card__link">
          전체 검증 보기
        </Link>
      </div>
      <div className="tactical-zone-validation-card__grid">
        <p className="m-0 tactical-zone-validation-card__item">
          <span>승률</span>
          <strong className="font-mono tabular-nums">{winRate != null ? `${winRate.toFixed(1)}%` : "—"}</strong>
        </p>
        <p className="m-0 tactical-zone-validation-card__item">
          <span>평균 수익률</span>
          <strong className="font-mono tabular-nums">{fmtPct(avgReturn)}</strong>
        </p>
        <p className="m-0 tactical-zone-validation-card__item tactical-zone-validation-card__item--full">
          <span>최고 수익 종목</span>
          <strong className="font-mono tabular-nums">
            {best ? `${best.symbol} ${fmtPct(best.returnPct)}` : "—"}
          </strong>
        </p>
      </div>
    </section>
  )
}
