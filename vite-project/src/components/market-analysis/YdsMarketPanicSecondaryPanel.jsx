import { useMemo } from "react"
import { MARKET_LABEL_PANIC_INTENSITY } from "../../content/ydsMarketStageLabels.js"
import { resolveMarketStateCenterView } from "../../content/ydsMarketStateCenter.js"

/**
 * V7 — 패닉 강도 보조 카드 (축소)
 * @param {{ panicData?: object | null; className?: string; embedded?: boolean }} props
 */
export default function YdsMarketPanicSecondaryPanel({
  panicData = null,
  className = "",
  embedded = false,
}) {
  const view = useMemo(() => resolveMarketStateCenterView(panicData), [panicData])
  if (!view || view.panicScore == null) return null

  const card = (
    <div className="yds-market-panic-secondary yds-market-panic-secondary--v7">
      <p className="yds-market-panic-secondary__badge">매수 강도</p>
      <p className="yds-market-panic-secondary__title">{MARKET_LABEL_PANIC_INTENSITY}</p>
      <p className="yds-market-panic-secondary__score font-mono tabular-nums">
        {view.panicScore}
      </p>
      <p className="yds-market-panic-secondary__level">
        {view.panicEmoji} {view.panicLabel}
      </p>
      <p className="yds-market-panic-secondary__intensity font-mono tabular-nums">
        {view.buyIntensityLabel}
      </p>
    </div>
  )

  if (embedded) return card

  return (
    <section className={["yds-market-panic-secondary-wrap", className].filter(Boolean).join(" ")}>
      {card}
    </section>
  )
}
