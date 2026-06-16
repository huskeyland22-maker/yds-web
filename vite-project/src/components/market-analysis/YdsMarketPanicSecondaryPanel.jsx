import { useMemo } from "react"
import { MARKET_LABEL_PANIC_INTENSITY } from "../../content/ydsMarketStageLabels.js"
import { resolveMarketStateCenterView } from "../../content/ydsMarketStateCenter.js"

/** @param {number} score */
function resolvePanicAccentTier(score) {
  if (score >= 85) return "critical"
  if (score >= 70) return "high"
  if (score >= 40) return "mid"
  return "low"
}

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
  const filled = Math.max(0, Math.min(10, Math.round((view.buyIntensityPct ?? 0) / 10)))
  const bar = `${"■".repeat(filled)}${"□".repeat(10 - filled)}`
  const accentTier = resolvePanicAccentTier(view.panicScore)
  const showAggressiveBadge = view.panicScore >= 85

  const card = (
    <div
      className={[
        "yds-market-panic-secondary",
        "yds-market-panic-secondary--v7",
        `yds-market-panic-secondary--accent-${accentTier}`,
      ].join(" ")}
    >
      <p className="yds-market-panic-secondary__title">{MARKET_LABEL_PANIC_INTENSITY}</p>
      {showAggressiveBadge ? (
        <p className="yds-market-panic-secondary__alert-badge">🚨 적극 매수 구간</p>
      ) : null}
      <div className="yds-market-panic-secondary__body">
        <div className="yds-market-panic-secondary__core">
          <p className="yds-market-panic-secondary__score font-mono tabular-nums">
            {view.panicScore}
          </p>
          <p className="yds-market-panic-secondary__level">{view.panicLabel}</p>
          <p className="yds-market-panic-secondary__meter font-mono tabular-nums">{bar}</p>
        </div>
        <p className="yds-market-panic-secondary__intensity font-mono tabular-nums">
          {view.buyIntensityLabel}
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
