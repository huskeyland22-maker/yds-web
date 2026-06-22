/**
 * @param {{ flow: import("../../content/ydsMarketCycleFlow.js").MarketCycleFlowReport; className?: string }} props
 */
export default function YdsMarketStateTimeline({ flow, className = "" }) {
  if (!flow?.visible || !flow.steps?.length) return null

  return (
    <nav
      className={["yds-market-state-timeline", className].filter(Boolean).join(" ")}
      aria-label="시장 사이클 흐름"
    >
      <p className="yds-market-state-timeline__label">시장 사이클 흐름</p>

      <ol className="yds-market-state-timeline__list">
        {flow.steps.map((step, index) => (
          <li
            key={`${step.date}-${step.label}-${index}`}
            className={[
              "yds-market-state-timeline__step",
              step.isCurrent ? "yds-market-state-timeline__step--current" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {index > 0 && step.daysGap != null ? (
              <span className="yds-market-state-timeline__arrow font-mono tabular-nums">
                ↓ {step.daysGap}일
              </span>
            ) : null}
            {step.isCurrent ? (
              <span className="yds-market-state-timeline__node">
                <em className="yds-market-state-timeline__current">현재</em>
                <span className="yds-market-state-timeline__zone">{step.label}</span>
              </span>
            ) : (
              <span className="yds-market-state-timeline__zone">{step.label}</span>
            )}
          </li>
        ))}
      </ol>

      <dl className="yds-market-state-timeline__stats">
        <div>
          <dt>현재 상태 지속</dt>
          <dd className="font-mono tabular-nums">{flow.currentDurationDays}일</dd>
        </div>
        <div>
          <dt>최근 {flow.windowDays}일 전환</dt>
          <dd className="font-mono tabular-nums">{flow.transitionCount}회</dd>
        </div>
        <div>
          <dt>최장 유지 상태</dt>
          <dd>{flow.longestHeldState}</dd>
        </div>
      </dl>
    </nav>
  )
}
