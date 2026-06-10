import { useMemo } from "react"
import { resolveMomentumLayer } from "../../content/ydsMomentumLayer.js"
import {
  MARKET_LABEL_PANIC_INTENSITY,
  resolveMarketStageSnapshot,
} from "../../content/ydsMarketStageLabels.js"
import { getFinalScore } from "../../utils/tradingScores.js"

/**
 * 패닉 강도 — 지금 행동해야 하는지
 * @param {{ panicData?: object | null; historyRows?: object[]; className?: string; embedded?: boolean }} props
 */
export default function YdsMarketPanicCard({
  panicData = null,
  historyRows = [],
  className = "",
  embedded = false,
}) {
  const view = useMemo(() => {
    if (!panicData) return null
    const score = getFinalScore(panicData)
    if (!Number.isFinite(score)) return null
    const momentum = resolveMomentumLayer(panicData, historyRows)
    const snapshot = resolveMarketStageSnapshot(Math.round(score), momentum)
    if (!snapshot.panic) return null
    return { panic: snapshot.panic, ydsScore: snapshot.ydsScore }
  }, [panicData, historyRows])

  if (!view) return null

  const { panic, ydsScore } = view

  const scoreCard = (
    <article
      className={[
        "yds-market-hero__score-card",
        embedded ? "yds-market-hero__score-card--embedded" : "yds-market-hero__score-card--solo",
      ].join(" ")}
      aria-label={`${MARKET_LABEL_PANIC_INTENSITY} ${ydsScore}`}
    >
      <p className="yds-market-hero__card-label">{MARKET_LABEL_PANIC_INTENSITY}</p>
      <p className="yds-market-hero__score font-mono tabular-nums">{ydsScore}</p>
      <p className="yds-market-hero__status" style={{ "--hero-color": panic.color }}>
        {panic.emoji} {panic.label}
      </p>
      {panic.hint ? <p className="yds-market-hero__status-hint">{panic.hint}</p> : null}
    </article>
  )

  if (embedded) {
    return scoreCard
  }

  return (
    <section className={["yds-market-panic-card", className].filter(Boolean).join(" ")}>
      <h2 className="yds-market-desk__block-label">{MARKET_LABEL_PANIC_INTENSITY}</h2>
      {scoreCard}
    </section>
  )
}
