import { useMemo } from "react"
import { buildMarketStateHistoryView } from "../../content/ydsMarketStateHistory.js"

/** @param {string} dateStr */
function formatMd(dateStr) {
  const m = String(dateStr).slice(5, 7)
  const d = String(dateStr).slice(8, 10)
  return m && d ? `${Number(m)}/${Number(d)}` : dateStr
}

/**
 * @param {{
 *   historyRows?: object[]
 *   cycleFlow?: import("../../content/ydsMarketCycleFlow.js").MarketCycleFlowReport | null
 *   panicData?: object | null
 *   dualLiquidity?: import("../../market-os/liquidityDualEngine.js").DualLiquidityReport | null
 *   className?: string
 * }} props
 */
export default function YdsMarketStateHistory({
  historyRows = [],
  cycleFlow = null,
  panicData = null,
  dualLiquidity = null,
  className = "",
}) {
  const entries = useMemo(
    () => buildMarketStateHistoryView(historyRows, cycleFlow, panicData, dualLiquidity, 30),
    [historyRows, cycleFlow, panicData, dualLiquidity],
  )

  if (!entries.length) return null

  return (
    <details
      className={["yds-market-state-history", className].filter(Boolean).join(" ")}
      aria-label="시장 상태 히스토리"
    >
      <summary className="yds-market-state-history__summary">시장 상태 히스토리 (30일)</summary>
      <ol className="yds-market-state-history__list">
        {entries.map((entry) => (
          <li key={entry.date} className="yds-market-state-history__row">
            <div className="yds-market-state-history__head">
              <span className="yds-market-state-history__date font-mono tabular-nums">
                {formatMd(entry.date)}
              </span>
              <strong className="yds-market-state-history__label">{entry.unifiedLabel}</strong>
            </div>
            <p className="yds-market-state-history__scores font-mono tabular-nums">
              {entry.marketScore != null ? `시장 ${entry.marketScore}` : null}
              {entry.panicScore != null ? ` · 패닉 ${entry.panicScore}` : null}
              {entry.liquidityScore != null ? ` · 유동성 ${entry.liquidityScore}` : null}
            </p>
            {entry.changeReason ? (
              <p className="yds-market-state-history__reason">{entry.changeReason}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </details>
  )
}
