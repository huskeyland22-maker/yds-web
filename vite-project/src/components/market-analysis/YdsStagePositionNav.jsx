import { getStagePhilosophy } from "../../content/ydsCyclePhilosophy.js"
import { MARKET_LABEL_PANIC_INTENSITY, marketPanicLabelForMacroStage } from "../../content/ydsMarketStageLabels.js"
import { resolveYdsStageNavigation } from "../../utils/ydsStageNavigation.js"

/**
 * 현재 위치 → 다음 단계 → 행동 (3초 이해용)
 * @param {{ score: number | null | undefined; compact?: boolean; marketActionLabels?: boolean }} props
 */
export default function YdsStagePositionNav({ score, compact = false, marketActionLabels = false }) {
  const nav = resolveYdsStageNavigation(score)
  if (!nav) return null

  const philosophy = getStagePhilosophy(nav.currentStage.id)
  const currentLabel = marketActionLabels
    ? marketPanicLabelForMacroStage(nav.currentStage.id) ?? nav.currentStage.label
    : nav.currentStage.label
  const nextLabel =
    marketActionLabels && nav.nextStage
      ? marketPanicLabelForMacroStage(nav.nextStage.id) ?? nav.nextStage.label
      : nav.nextStage?.label
  const nextLine = nav.nextStage
    ? nav.pointsToNext === 0
      ? `${nextLabel} 진입 임박`
      : `${nextLabel}까지 +${nav.pointsToNext}점`
    : nav.nextLine

  return (
    <div
      className={["yds-stage-nav", compact ? "yds-stage-nav--compact" : ""].filter(Boolean).join(" ")}
      aria-label="현재 위치 및 다음 단계"
    >
      <div className="yds-stage-nav__row">
        <p className="yds-stage-nav__label">{marketActionLabels ? MARKET_LABEL_PANIC_INTENSITY : "현재 위치"}</p>
        <p className="yds-stage-nav__value" style={{ "--stage-color": nav.currentStage.color }}>
          <span aria-hidden>{nav.currentStage.emoji}</span> {currentLabel}
        </p>
      </div>
      {nav.nextStage ? (
        <div className="yds-stage-nav__row">
          <p className="yds-stage-nav__label">다음 단계</p>
          <p className="yds-stage-nav__value yds-stage-nav__value--next">
            {nextLine}
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
