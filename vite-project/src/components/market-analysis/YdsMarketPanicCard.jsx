import { useMemo } from "react"
import { MARKET_LABEL_PANIC_INTENSITY } from "../../content/ydsMarketStageLabels.js"
import { resolvePanicActionView } from "../../content/ydsPanicActionView.js"
import { getFinalScore } from "../../utils/tradingScores.js"
import YdsMarketDeskMiniCard from "./YdsMarketDeskMiniCard.jsx"

/**
 * 패닉 강도 — 큰 수치 + 단계 레일
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
    const score = getFinalScore(panicData)
    if (!Number.isFinite(score)) return null
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
