import { useMemo } from "react"
import { MARKET_LABEL_MARKET_STATE } from "../../content/ydsMarketStageLabels.js"
import { resolveMarketPositionView } from "../../content/ydsMarketPositionEngine.js"
import YdsMarketDeskMiniCard from "./YdsMarketDeskMiniCard.jsx"

/**
 * 시장 상태 — 큰 수치 + 단계 레일
 * @param {{ panicData?: object | null; historyRows?: object[]; className?: string; embedded?: boolean }} props
 */
export default function YdsMarketStateCard({
  panicData = null,
  historyRows: _historyRows = [],
  className = "",
  embedded = false,
}) {
  const view = useMemo(() => resolveMarketPositionView(panicData), [panicData])

  if (!view) return null

  const card = (
    <YdsMarketDeskMiniCard
      title={MARKET_LABEL_MARKET_STATE}
      score={view.score}
      stages={view.rail}
      variant="state"
      embedded={embedded}
    />
  )

  if (embedded) {
    return card
  }

  return (
    <section className={["yds-market-state-card", className].filter(Boolean).join(" ")}>
      {card}
    </section>
  )
}
