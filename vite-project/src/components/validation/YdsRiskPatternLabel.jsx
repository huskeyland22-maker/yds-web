import { useId, useState } from "react"
import {
  formatRiskPatternDisplayLine,
  getRiskPatternDisplay,
} from "../../trading-zone/ydsPrecursorMetricDisplay.js"

/**
 * @param {{
 *   patternId?: string | null
 *   patternLabel?: string | null
 *   showInfo?: boolean
 *   compact?: boolean
 *   className?: string
 * }} props
 */
export default function YdsRiskPatternLabel({
  patternId = null,
  patternLabel = null,
  showInfo = true,
  compact = false,
  className = "",
}) {
  const [open, setOpen] = useState(false)
  const infoId = useId()
  const display = getRiskPatternDisplay(patternId, patternLabel)
  const line = formatRiskPatternDisplayLine(patternId, patternLabel)

  if (display.name === "—") {
    return <span className={className}>—</span>
  }

  return (
    <span className={["yds-risk-pattern-label", className].filter(Boolean).join(" ")}>
      <span
        className="yds-risk-pattern-label__text"
        title={display.description}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {compact ? (
          <>
            <span className="yds-risk-pattern-label__emoji" aria-hidden>
              {display.emoji}
            </span>{" "}
            {display.name}
          </>
        ) : (
          line
        )}
      </span>
      {showInfo ? (
        <button
          type="button"
          className="yds-risk-pattern-label__info"
          aria-expanded={open}
          aria-controls={infoId}
          title="패턴 설명"
          onClick={() => setOpen((v) => !v)}
          onBlur={() => setOpen(false)}
        >
          i
        </button>
      ) : null}
      {open && display.description ? (
        <span id={infoId} role="tooltip" className="yds-risk-pattern-label__tip">
          {display.description}
        </span>
      ) : null}
    </span>
  )
}
