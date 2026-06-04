import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  buildRecommendationTrackRows,
  summarizeRecommendationPerformance,
} from "../../trading-zone/tradingZoneRecommendationTrack.js"

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
  const [windowDays, setWindowDays] = useState(30)
  const summary = useMemo(() => {
    const minDate = new Date(Date.now() - windowDays * 86_400_000).toISOString().slice(0, 10)
    const filtered = (positions ?? []).map((p) => ({
      ...p,
      stageHistory: (p.stageHistory ?? []).filter((h) => String(h.at ?? "").slice(0, 10) >= minDate),
    }))
    const rows = buildRecommendationTrackRows(filtered, priorityIds, liveById)
    return summarizeRecommendationPerformance(rows)
  }, [positions, priorityIds, liveById, windowDays])

  const fmtPct = (v) => {
    if (v == null || !Number.isFinite(v)) return "—"
    return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`
  }

  return (
    <section className="tactical-zone-validation-card" aria-label="추천엔진 검증 요약">
      <div className="tactical-zone-validation-card__head">
        <p className="m-0 tactical-zone-validation-card__title">추천엔진 검증 요약</p>
        <div className="tactical-zone-validation-card__toggle">
          <button type="button" className={windowDays === 30 ? "is-active" : ""} onClick={() => setWindowDays(30)}>
            최근 30일
          </button>
          <button type="button" className={windowDays === 90 ? "is-active" : ""} onClick={() => setWindowDays(90)}>
            최근 90일
          </button>
        </div>
        <Link to="/lab" className="tactical-zone-validation-card__link">
          전체 검증 보기
        </Link>
      </div>
      <div className="tactical-zone-validation-card__grid">
        <p className="m-0 tactical-zone-validation-card__item">
          <span>승률</span>
          <strong className="font-mono tabular-nums">
            {summary.successRate != null ? `${summary.successRate.toFixed(1)}%` : "—"}
          </strong>
        </p>
        <p className="m-0 tactical-zone-validation-card__item">
          <span>평균 수익률</span>
          <strong className="font-mono tabular-nums">{fmtPct(summary.avgReturn)}</strong>
        </p>
        <p className="m-0 tactical-zone-validation-card__item">
          <span>성공률</span>
          <strong className="font-mono tabular-nums">
            {summary.successRate != null ? `${summary.successRate.toFixed(1)}%` : "—"}
          </strong>
        </p>
        <p className="m-0 tactical-zone-validation-card__item">
          <span>진행중 비율</span>
          <strong className="font-mono tabular-nums">
            {summary.ongoingRate != null ? `${summary.ongoingRate.toFixed(1)}%` : "—"}
          </strong>
        </p>
        <p className="m-0 tactical-zone-validation-card__item">
          <span>실패율</span>
          <strong className="font-mono tabular-nums">
            {summary.failRate != null ? `${summary.failRate.toFixed(1)}%` : "—"}
          </strong>
        </p>
        <p className="m-0 tactical-zone-validation-card__item tactical-zone-validation-card__item--full">
          <span>표본</span>
          <strong className="font-mono tabular-nums">
            {windowDays}일 기준 · {summary.total}건
          </strong>
        </p>
      </div>
    </section>
  )
}
