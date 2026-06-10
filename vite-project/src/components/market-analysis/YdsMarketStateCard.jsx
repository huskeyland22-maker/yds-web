import { useMemo } from "react"
import { resolveMomentumLayer } from "../../content/ydsMomentumLayer.js"
import {
  MARKET_LABEL_MARKET_STATE,
  resolveMarketStageSnapshot,
} from "../../content/ydsMarketStageLabels.js"
import { getFinalScore } from "../../utils/tradingScores.js"

/**
 * 시장 상태 — 현재 시장이 어느 단계인지
 * @param {{ panicData?: object | null; historyRows?: object[]; className?: string; embedded?: boolean }} props
 */
export default function YdsMarketStateCard({
  panicData = null,
  historyRows = [],
  className = "",
  embedded = false,
}) {
  const cycle = useMemo(() => {
    if (!panicData) return null
    const score = getFinalScore(panicData)
    if (!Number.isFinite(score)) return null
    const momentum = resolveMomentumLayer(panicData, historyRows)
    const snapshot = resolveMarketStageSnapshot(Math.round(score), momentum)
    return snapshot.cycle
  }, [panicData, historyRows])

  if (!cycle) return null

  const scoreCard = (
    <article
      className={[
        "yds-market-hero__score-card",
        embedded ? "yds-market-hero__score-card--embedded" : "yds-market-hero__score-card--solo",
      ].join(" ")}
      aria-label={`${MARKET_LABEL_MARKET_STATE} ${cycle.score}`}
    >
      <p className="yds-market-hero__card-label">{MARKET_LABEL_MARKET_STATE}</p>
      <p className="yds-market-hero__score font-mono tabular-nums">{cycle.score}</p>
      <p className="yds-market-hero__status" style={{ "--hero-color": cycle.color }}>
        {cycle.emoji} {cycle.label}
      </p>
      {cycle.hint && !embedded ? (
        <p className="yds-market-hero__status-hint">{cycle.hint}</p>
      ) : null}
    </article>
  )

  if (embedded) {
    return scoreCard
  }

  return (
    <section className={["yds-market-state-card", className].filter(Boolean).join(" ")}>
      <h2 className="yds-market-desk__block-label">{MARKET_LABEL_MARKET_STATE}</h2>
      {scoreCard}
    </section>
  )
}
