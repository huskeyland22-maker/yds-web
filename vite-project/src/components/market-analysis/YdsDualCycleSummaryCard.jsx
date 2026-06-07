import { useMemo } from "react"
import { resolveTodayActions } from "../../content/ydsActionGuide.js"
import { resolveMomentumLayer } from "../../content/ydsMomentumLayer.js"
import { getFinalScore } from "../../utils/tradingScores.js"

/**
 * 오늘의 행동 — 상태 패널과 분리된 Action 영역
 * @param {{ panicData?: object | null; historyRows?: object[] }} props
 */
export default function YdsDualCycleSummaryCard({ panicData = null, historyRows = [] }) {
  const view = useMemo(() => {
    if (!panicData) return null
    const score = getFinalScore(panicData)
    if (!Number.isFinite(score)) return null

    const momentum = resolveMomentumLayer(panicData, historyRows)
    const actions = resolveTodayActions(Math.round(score), momentum, panicData)
    if (!actions) return null

    return { actions }
  }, [panicData, historyRows])

  if (!view) return null

  const { band, actions: actionItems, momentumHint } = view.actions

  return (
    <section className="yds-action-card" aria-label="오늘의 행동">
      <h2 className="yds-action-card__title">오늘의 행동</h2>

      <p className="yds-action-card__band" style={{ "--action-color": band.color }}>
        {band.emoji} {band.label}
      </p>

      <ul className="yds-action-card__list">
        {actionItems.map((item) => (
          <li key={item} className="yds-action-card__item">
            ✓ {item}
          </li>
        ))}
        {momentumHint ? (
          <li className="yds-action-card__item yds-action-card__item--warn">✓ {momentumHint}</li>
        ) : null}
      </ul>
    </section>
  )
}
