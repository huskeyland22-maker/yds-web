import { useMemo } from "react"
import { buildMarketCycleProgressReport } from "../../content/ydsMarketCycleProgress.js"

/**
 * @param {{
 *   flow: import("../../content/ydsMarketCycleFlow.js").MarketCycleFlowReport
 *   className?: string
 *   embedded?: boolean
 *   showTitle?: boolean
 * }} props
 */
export default function YdsMarketStateTimeline({
  flow,
  className = "",
  embedded = false,
  showTitle = false,
}) {
  const progress = useMemo(() => buildMarketCycleProgressReport(flow), [flow])

  if (!progress.visible || !progress.track.length) return null

  return (
    <nav
      className={[
        "yds-market-cycle-progress",
        embedded ? "yds-market-cycle-progress--embedded" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="시장 사이클 현재 위치"
    >
      {showTitle ? <p className="yds-market-cycle-progress__title">시장 사이클</p> : null}

      <div className="yds-market-cycle-progress__rail" role="list">
        {progress.track.map((stage, index) => (
          <span key={stage.id} className="yds-market-cycle-progress__segment" role="listitem">
            {index > 0 ? (
              <span className="yds-market-cycle-progress__arrow" aria-hidden>
                →
              </span>
            ) : null}
            <span
              className={[
                "yds-market-cycle-progress__stage",
                stage.isCurrent ? "yds-market-cycle-progress__stage--current" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {stage.isCurrent ? `[${stage.label}]` : stage.label}
            </span>
          </span>
        ))}
      </div>

      <dl className="yds-market-cycle-progress__stats">
        <div>
          <dt>현재 단계 지속</dt>
          <dd className="font-mono tabular-nums">{progress.currentDurationDays}일</dd>
        </div>
        <div>
          <dt>최근 {progress.windowDays}일 전환</dt>
          <dd className="font-mono tabular-nums">{progress.transitionCount}회</dd>
        </div>
        {flow.etfSensitivity?.applied && flow.etfSensitivity.reason ? (
          <div className="yds-market-cycle-progress__etf-note">
            <dt>지수 민감도</dt>
            <dd>{flow.etfSensitivity.reason}</dd>
          </div>
        ) : null}
        {flow.recoveryGate?.applied && flow.recoveryGate.reason ? (
          <div className="yds-market-cycle-progress__etf-note">
            <dt>회복 확인</dt>
            <dd>{flow.recoveryGate.reason}</dd>
          </div>
        ) : null}
      </dl>
    </nav>
  )
}
