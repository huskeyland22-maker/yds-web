import { useMemo } from "react"
import { resolveMomentumLayer } from "../../content/ydsMomentumLayer.js"
import {
  MARKET_LABEL_MARKET_STATE,
  resolveMarketStageSnapshot,
} from "../../content/ydsMarketStageLabels.js"
import { getFinalScore } from "../../utils/tradingScores.js"

/**
 * 시장 상태 — 현재 시장이 어느 단계인지
 * @param {{ panicData?: object | null; historyRows?: object[]; className?: string }} props
 */
export default function YdsMarketStateCard({ panicData = null, historyRows = [], className = "" }) {
  const cycle = useMemo(() => {
    if (!panicData) return null
    const score = getFinalScore(panicData)
    if (!Number.isFinite(score)) return null
    const momentum = resolveMomentumLayer(panicData, historyRows)
    const snapshot = resolveMarketStageSnapshot(Math.round(score), momentum)
    return snapshot.cycle
  }, [panicData, historyRows])

  if (!cycle) return null

  return (
    <section
      className={["yds-market-state-card", className].filter(Boolean).join(" ")}
      aria-label={`${MARKET_LABEL_MARKET_STATE} ${cycle.score}`}
    >
      <h2 className="yds-market-desk__block-label">{MARKET_LABEL_MARKET_STATE}</h2>
      <article className="yds-market-hero__score-card yds-market-hero__score-card--solo">
        <p className="yds-market-hero__score font-mono tabular-nums">{cycle.score}</p>
        <p className="yds-market-hero__status" style={{ "--hero-color": cycle.color }}>
          {cycle.emoji} {cycle.label}
        </p>
        {cycle.hint ? <p className="yds-market-hero__status-hint">{cycle.hint}</p> : null}
      </article>
    </section>
  )
}
