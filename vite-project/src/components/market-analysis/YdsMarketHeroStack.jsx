import { useMemo } from "react"
import { resolveTodayActions } from "../../content/ydsActionGuide.js"
import { resolveCurrentMarketView } from "../../content/ydsCurrentMarketView.js"
import { resolveMomentumLayer } from "../../content/ydsMomentumLayer.js"
import { getFinalScore } from "../../utils/tradingScores.js"
/**
 * Hero — 현재 시장 · 오늘의 행동 (3초 판단)
 * @param {{ panicData?: object | null; historyRows?: object[]; className?: string }} props
 */
export default function YdsMarketHeroStack({ panicData = null, historyRows = [], className = "" }) {
  const view = useMemo(() => {
    if (!panicData) return null
    const score = getFinalScore(panicData)
    if (!Number.isFinite(score)) return null

    const momentumData = resolveMomentumLayer(panicData, historyRows)
    const currentMarket = resolveCurrentMarketView(panicData, historyRows)
    const actions = resolveTodayActions(Math.round(score), momentumData, panicData)
    if (!actions || !currentMarket) return null

    return { currentMarket, actions }
  }, [panicData, historyRows])

  if (!view) return null

  const { currentMarket, actions } = view

  return (
    <section
      className={["yds-market-hero", "yds-market-hero--desk", className].filter(Boolean).join(" ")}
      aria-label="YDS 시장 Hero"
    >
      <div className="yds-market-hero__dual-row yds-market-hero__slot yds-market-hero__slot--judgment">
        <article className="yds-market-hero__current-market" aria-label="현재 시장">
          <p className="yds-market-hero__layer-tag">현재 시장</p>
          <p
            className="yds-market-hero__current-market-label"
            style={{ "--hero-color": currentMarket.color }}
          >
            {currentMarket.emoji} {currentMarket.label}
          </p>
          {currentMarket.cause ? (
            <p className="yds-market-hero__current-market-cause">{currentMarket.cause}</p>
          ) : null}
        </article>

        <article className="yds-market-hero__action" aria-label="오늘의 행동">
          <p className="yds-market-hero__layer-tag">오늘의 행동</p>
          <p
            className="yds-market-hero__action-band"
            style={{ "--hero-color": actions.band.color }}
          >
            {actions.band.emoji} {actions.band.label}
          </p>
          <ul className="yds-market-hero__action-list">
            {actions.actions.map((item) => (
              <li key={item} className="yds-market-hero__action-item">
                ✓ {item}
              </li>
            ))}
          </ul>
          {actions.momentumHint ? (
            <p className="yds-market-hero__action-priority">{actions.momentumHint}</p>
          ) : null}
        </article>
      </div>
    </section>
  )
}
