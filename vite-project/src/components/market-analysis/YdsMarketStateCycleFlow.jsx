import { formatCycleStageLabel } from "../../content/ydsMarketStateCycleVisual.js"

/**
 * @param {{
 *   segments: import("../../content/ydsMarketStateRecentChanges.js").MarketStateTimelineSegment[]
 *   className?: string
 * }} props
 */
export default function YdsMarketStateCycleFlow({ segments = [], className = "" }) {
  if (!segments.length) return null

  return (
    <ol className={["yds-market-state-cycle-flow", className].filter(Boolean).join(" ")}>
      {segments.map((segment, index) => (
        <li key={`${segment.startDate}-${segment.label}`} className="yds-market-state-cycle-flow__item">
          <span
            className={[
              "yds-market-state-cycle-flow__label",
              segment.isCurrent ? "yds-market-state-cycle-flow__label--current" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ "--state-color": segment.color }}
          >
            {formatCycleStageLabel(segment.label)}
            {segment.isCurrent ? (
              <span className="yds-market-state-cycle-flow__badge">(현재)</span>
            ) : null}
          </span>
          {index < segments.length - 1 ? (
            <span className="yds-market-state-cycle-flow__arrow" aria-hidden>
              ↓
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
