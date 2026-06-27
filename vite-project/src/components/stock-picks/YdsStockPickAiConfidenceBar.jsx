import { confidenceDisplayTier } from "../../content/ydsStockPickListView.js"

const BAR_SLOTS = 10

/**
 * @param {{
 *   score?: number | null
 *   label?: string
 *   compact?: boolean
 *   showMeta?: boolean
 *   className?: string
 * }} props
 */
export default function YdsStockPickAiConfidenceBar({
  score = null,
  label,
  compact = false,
  showMeta = true,
  className = "",
}) {
  if (score == null || !Number.isFinite(score)) return null

  const pct = Math.max(0, Math.min(100, Math.round(score)))
  const filled = Math.round((pct / 100) * BAR_SLOTS)
  const tier = confidenceDisplayTier(pct)
  const displayLabel = label ?? tier.label
  const blocks = "█".repeat(filled) + "░".repeat(BAR_SLOTS - filled)

  return (
    <div
      className={[
        "yds-spick-conf-bar",
        compact ? "yds-spick-conf-bar--compact" : "",
        `yds-spick-conf-bar--${tier.tone}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={`AI Confidence ${pct}% ${displayLabel}`}
    >
      <div className="yds-spick-conf-bar__track">
        <span className="yds-spick-conf-bar__blocks font-mono" aria-hidden="true">
          {blocks}
        </span>
        <span className="yds-spick-conf-bar__pct font-mono tabular-nums">{pct}%</span>
      </div>
      {showMeta ? (
        <p className="yds-spick-conf-bar__meta">
          신뢰도 <strong className="font-mono tabular-nums">{tier.min > 0 ? `${tier.min}+` : "50↓"}</strong>{" "}
          {displayLabel}
        </p>
      ) : null}
    </div>
  )
}