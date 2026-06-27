import { useMemo } from "react"
import YdsMarketStatePrimaryPanel from "./YdsMarketStatePrimaryPanel.jsx"
import YdsMarketPanicSecondaryPanel from "./YdsMarketPanicSecondaryPanel.jsx"

/**
 * V8 Hero — 시장 상태(메인) + 패닉 강도(보조)
 * @param {{
 *   panicData?: object | null
 *   historyRows?: object[]
 *   cycleFlow?: import("../../content/ydsMarketCycleFlow.js").MarketCycleFlowReport | null
 *   dualLiquidity?: import("../../market-os/liquidityDualEngine.js").DualLiquidityReport | null
 *   etfContext?: object | null
 *   className?: string
 * }} props
 */
export default function YdsMarketScoreHero({
  panicData = null,
  historyRows = [],
  cycleFlow = null,
  dualLiquidity = null,
  etfContext = null,
  className = "",
}) {
  return (
    <section
      className={[
        "yds-market-score-hero",
        "yds-market-hero--desk",
        "yds-market-score-hero--v7",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="시장 상태 · 패닉 강도"
    >
      <div className="yds-market-score-hero__stack yds-market-desk__slot yds-market-desk__slot--scores">
        <div className="yds-market-desk__slot yds-market-desk__slot--market-state">
          <YdsMarketStatePrimaryPanel
            embedded
            panicData={panicData}
            historyRows={historyRows}
            cycleFlow={cycleFlow}
            dualLiquidity={dualLiquidity}
            etfContext={etfContext}
          />
        </div>
        <div className="yds-market-desk__slot yds-market-desk__slot--panic-intensity">
          <YdsMarketPanicSecondaryPanel
            embedded
            panicData={panicData}
            historyRows={historyRows}
            etfContext={etfContext}
          />
        </div>
      </div>
    </section>
  )
}
