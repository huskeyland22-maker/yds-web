import { useMemo } from "react"
import {
  buildQuickReadContext,
  resolveUnifiedMarketRegime,
} from "../../content/ydsStateEngine.js"

/**
 * V2.0 UX — 5초 Quick Read: 현재 위치 → 행동
 */
export default function YdsHeroQuickRead({
  cycle = null,
  actions = null,
  panicData = null,
  historyRows = [],
  momentumData = null,
  panicDistanceSlot = null,
}) {
  const regime = useMemo(
    () => resolveUnifiedMarketRegime(panicData, historyRows, momentumData),
    [panicData, historyRows, momentumData],
  )

  const contextLines = useMemo(
    () => (cycle?.label ? buildQuickReadContext(cycle.label, regime) : []),
    [cycle?.label, regime],
  )

  if (!cycle || !actions) return null

  return (
    <section className="yds-hero-quick-read" aria-label="5초 Quick Read">
      <div className="yds-hero-quick-read__position">
        <p
          className="yds-hero-quick-read__cycle"
          style={{ "--hero-color": cycle.color }}
        >
          {cycle.emoji} {cycle.label}
        </p>
        {contextLines.map((line) => (
          <p key={line} className="yds-hero-quick-read__context">
            {line}
          </p>
        ))}
      </div>

      {panicDistanceSlot}

      <div className="yds-hero-quick-read__action" aria-label="현재 행동">
        <h2 className="yds-hero-quick-read__action-title">현재 행동</h2>
        <ul className="yds-hero-quick-read__action-list">
          {actions.actions.slice(0, 3).map((item) => (
            <li key={item} className="yds-hero-quick-read__action-item">
              ✓ {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
