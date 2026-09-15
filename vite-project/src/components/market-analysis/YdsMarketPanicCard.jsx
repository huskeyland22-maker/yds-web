import { useMemo } from "react"
import { MARKET_LABEL_PANIC_INTENSITY } from "../../content/ydsMarketStageLabels.js"
import { resolvePanicActionView } from "../../content/ydsPanicActionView.js"
import { getPanicScoreV2 } from "../../utils/tradingScores.js"
import YdsMarketDeskMiniCard from "./YdsMarketDeskMiniCard.jsx"

/**
 * 패닉 강도 — Panic Index V2
 * @param {{ panicData?: object | null; historyRows?: object[]; className?: string; embedded?: boolean }} props
 */
export default function YdsMarketPanicCard({
  panicData = null,
  historyRows: _historyRows = [],
  className = "",
  embedded = false,
}) {
  const view = useMemo(() => {
    if (!panicData) return null
    const score = getPanicScoreV2(panicData)
    if (score == null) return null
    return resolvePanicActionView(Math.round(score))
  }, [panicData])

  if (!view) return null

  const card = (
    <YdsMarketDeskMiniCard
      title={MARKET_LABEL_PANIC_INTENSITY}
      score={view.score}
      stages={view.rail}
      variant="panic"
      embedded={embedded}
    />
  )

  if (embedded) {
    return card
  }

  return (
    <section className={["yds-market-panic-card", className].filter(Boolean).join(" ")}>
      {card}
    </section>
  )
}
