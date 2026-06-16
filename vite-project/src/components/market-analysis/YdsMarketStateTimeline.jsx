/**
 * V7 — 시장 상태 타임라인 (날짜 + 상태 + 점수)
 * @param {{ steps: import("../../content/ydsMarketPositionTimeline.js").MarketPositionTimelineStep[]; className?: string }} props
 */
export default function YdsMarketStateTimeline({ steps, className = "" }) {
  if (!steps.length) return null

  return (
    <nav
      className={["yds-market-state-timeline", className].filter(Boolean).join(" ")}
      aria-label="시장 상태 흐름"
    >
      <p className="yds-market-state-timeline__label">시장 사이클 흐름</p>
      <ol className="yds-market-state-timeline__list">
        {steps.map((step, index) => (
          <li
            key={`${step.date}-${step.positionId}`}
            className={[
              "yds-market-state-timeline__step",
              step.isCurrent ? "yds-market-state-timeline__step--current" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {index > 0 ? (
              <span className="yds-market-state-timeline__arrow" aria-hidden>
                ↓
              </span>
            ) : null}
            <span className="yds-market-state-timeline__node">
              <span className="yds-market-state-timeline__date font-mono tabular-nums">
                {step.dateShort}
                {step.isCurrent ? <em className="yds-market-state-timeline__current">현재</em> : null}
              </span>
              <span className="yds-market-state-timeline__zone">
                {step.emoji} {step.label} {step.phase}
                <span className="yds-market-state-timeline__score font-mono tabular-nums">
                  ({step.score})
                </span>
              </span>
            </span>
            <p className="yds-market-state-timeline__strategy">
              {step.strategy} · {step.pickLabel}
            </p>
          </li>
        ))}
      </ol>
    </nav>
  )
}
