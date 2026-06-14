import { useMemo } from "react"
import { MARKET_LABEL_PANIC_INTENSITY } from "../../content/ydsMarketStageLabels.js"
import { resolveMarketStateCenterView } from "../../content/ydsMarketStateCenter.js"
import YdsMarketDeskMiniCard from "./YdsMarketDeskMiniCard.jsx"

/**
 * 패닉 강도 (보조) — 현재 패닉 수준 · 매수 강도
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
    <div className="yds-market-panic-secondary">
      <p className="yds-market-panic-secondary__badge">보조 지표</p>
      <YdsMarketDeskMiniCard
        title={MARKET_LABEL_PANIC_INTENSITY}
        score={view.panicScore}
        stages={view.panicRail}
        variant="panic"
        embedded={embedded}
        ariaLabel={`${MARKET_LABEL_PANIC_INTENSITY} ${view.panicScore}, ${view.panicLabel}`}
      />

      <div className="yds-market-panic-secondary__meta">
        <p className="yds-market-panic-secondary__level">
          {view.panicEmoji} {view.panicLabel}
        </p>
        <p className="yds-market-panic-secondary__intensity font-mono tabular-nums">
          {view.buyIntensityLabel}
        </p>
        <p className="yds-market-panic-secondary__hint">
          신규 투입 기준 · 시장 상태가 우선
        </p>
      </div>
    </div>
  )

  if (embedded) return card

  return (
    <section className={["yds-market-panic-secondary-wrap", className].filter(Boolean).join(" ")}>
      {card}
    </section>
  )
}
