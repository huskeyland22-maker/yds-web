import { getStagePhilosophy } from "../../content/ydsCyclePhilosophy.js"
import { resolveYdsStageNavigation } from "../../utils/ydsStageNavigation.js"

/**
 * 현재 위치 → 다음 단계 → 행동 (3초 이해용)
 * @param {{ score: number | null | undefined; compact?: boolean }} props
 */
export default function YdsStagePositionNav({ score, compact = false }) {
  const nav = resolveYdsStageNavigation(score)
  if (!nav) return null

  const philosophy = getStagePhilosophy(nav.currentStage.id)

  return (
    <div
      className={["yds-stage-nav", compact ? "yds-stage-nav--compact" : ""].filter(Boolean).join(" ")}
      aria-label="현재 위치 및 다음 단계"
    >
      <div className="yds-stage-nav__row">
        <p className="yds-stage-nav__label">현재 위치</p>
        <p className="yds-stage-nav__value" style={{ "--stage-color": nav.currentStage.color }}>
          <span aria-hidden>{nav.currentStage.emoji}</span> {nav.currentStage.label}
        </p>
      </div>
      {nav.nextStage ? (
        <div className="yds-stage-nav__row">
          <p className="yds-stage-nav__label">다음 단계</p>
          <p className="yds-stage-nav__value yds-stage-nav__value--next">
            {nav.nextLine}
          </p>
        </div>
      ) : null}
      <div className="yds-stage-nav__row yds-stage-nav__row--action">
        <p className="yds-stage-nav__label">행동</p>
        <p className="yds-stage-nav__action">{philosophy.actionGuide}</p>
      </div>
    </div>
  )
}
