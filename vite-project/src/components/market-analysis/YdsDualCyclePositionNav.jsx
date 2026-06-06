import { getStagePhilosophy } from "../../content/ydsCyclePhilosophy.js"
import {
  buildDualCycleInterpretation,
  fearCycleMood,
} from "../../content/ydsMarketCycleDisplay.js"

/**
 * @param {{
 *   fearNav: ReturnType<typeof import("../../utils/ydsStageNavigation.js").resolveYdsStageNavigation>
 *   marketNav: ReturnType<typeof import("../../content/ydsMarketCycleDisplay.js").resolveMarketCycleNavigation>
 * }} props
 */
export default function YdsDualCyclePositionNav({ fearNav, marketNav }) {
  if (!fearNav || !marketNav) return null

  const philosophy = getStagePhilosophy(fearNav.currentStage.id)

  return (
    <div className="yds-dual-position" aria-label="현재 위치 · 다음 단계">
      <div className="yds-dual-position__col">
        <p className="yds-dual-position__head">현재 위치</p>
        <div className="yds-dual-position__row">
          <span className="yds-dual-position__axis">공포 사이클</span>
          <span
            className="yds-dual-position__value"
            style={{ "--stage-color": fearNav.currentStage.color }}
          >
            {fearNav.currentStage.emoji} {fearNav.currentStage.label}
          </span>
        </div>
        {fearNav.nextStage ? (
          <div className="yds-dual-position__row yds-dual-position__row--next">
            <span className="yds-dual-position__axis">다음 단계</span>
            <span className="yds-dual-position__next">{fearNav.nextLine}</span>
          </div>
        ) : null}
      </div>

      <div className="yds-dual-position__col">
        <p className="yds-dual-position__head yds-dual-position__head--sr">시장 사이클</p>
        <div className="yds-dual-position__row">
          <span className="yds-dual-position__axis">시장 사이클</span>
          <span
            className="yds-dual-position__value"
            style={{ "--stage-color": marketNav.currentStage.color }}
          >
            {marketNav.currentStage.emoji} {marketNav.currentStage.label}
          </span>
        </div>
        {marketNav.nextStage ? (
          <div className="yds-dual-position__row yds-dual-position__row--next">
            <span className="yds-dual-position__axis">다음 단계</span>
            <span className="yds-dual-position__next">{marketNav.nextLine}</span>
          </div>
        ) : null}
      </div>

      <div className="yds-dual-position__action">
        <p className="yds-dual-position__action-label">행동</p>
        <p className="yds-dual-position__action-text">{philosophy.actionGuide}</p>
        {marketNav.currentStage.id !== "normal" ? (
          <p className="yds-dual-position__action-text yds-dual-position__action-text--harvest">
            수확 · {marketNav.currentStage.harvestGuide}
          </p>
        ) : null}
      </div>
    </div>
  )
}
