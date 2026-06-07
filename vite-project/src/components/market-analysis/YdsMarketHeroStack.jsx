import { useMemo } from "react"
import { resolveTodayActions } from "../../content/ydsActionGuide.js"
import { resolveCurrentMarketView } from "../../content/ydsCurrentMarketView.js"
import { resolveMomentumLayer } from "../../content/ydsMomentumLayer.js"
import { resolveYdsStatusSnapshot } from "../../content/ydsStatusLabels.js"
import { getFinalScore } from "../../utils/tradingScores.js"
import YdsDataSourceBadge from "./YdsDataSourceBadge.jsx"

/**
 * V1.9 Hero — 사이클·패닉 → 현재 시장 → 오늘 행동 (5초 판단)
 * @param {{ panicData?: object | null; historyRows?: object[] }} props
 */
export default function YdsMarketHeroStack({ panicData = null, historyRows = [] }) {
  const view = useMemo(() => {
    if (!panicData) return null
    const score = getFinalScore(panicData)
    if (!Number.isFinite(score)) return null

    const momentumData = resolveMomentumLayer(panicData, historyRows)
    const currentMarket = resolveCurrentMarketView(panicData, historyRows)
    const snapshot = resolveYdsStatusSnapshot(Math.round(score), momentumData)
    const actions = resolveTodayActions(Math.round(score), momentumData, panicData)
    if (!snapshot.cycle || !snapshot.panic || !actions || !currentMarket) return null

    return { ...snapshot, currentMarket, actions }
  }, [panicData, historyRows])

  if (!view) return null

  const { cycle, panic, ydsScore, currentMarket, actions } = view

  return (
    <section className="yds-market-hero" aria-label="YDS 시장 Hero">
      <div className="yds-market-hero__header">
        <span className="yds-market-hero__header-spacer" aria-hidden />
        <YdsDataSourceBadge />
      </div>

      <div className="yds-market-hero__long-term">
        <article
          className="yds-market-hero__score-card"
          aria-label={`사이클 위치 ${cycle.score}`}
        >
          <p className="yds-market-hero__card-label">사이클 위치</p>
          <p className="yds-market-hero__score font-mono tabular-nums">{cycle.score}</p>
          <p
            className="yds-market-hero__status"
            style={{ "--hero-color": cycle.color }}
          >
            {cycle.emoji} {cycle.label}
          </p>
        </article>

        <article
          className="yds-market-hero__score-card"
          aria-label={`패닉 강도 ${ydsScore}`}
        >
          <p className="yds-market-hero__card-label">패닉 강도</p>
          <p className="yds-market-hero__score font-mono tabular-nums">{ydsScore}</p>
          <p
            className="yds-market-hero__status"
            style={{ "--hero-color": panic.color }}
          >
            {panic.emoji} {panic.label}
          </p>
        </article>
      </div>

      <div className="yds-market-hero__dual-row">
        <article className="yds-market-hero__current-market" aria-label="현재 시장">
          <p className="yds-market-hero__layer-tag">현재 시장</p>
          <p
            className="yds-market-hero__current-market-label"
            style={{ "--hero-color": currentMarket.color }}
          >
            {currentMarket.emoji} {currentMarket.label}
          </p>
          <p className="yds-market-hero__current-market-metrics font-mono tabular-nums">
            CNN {Math.round(currentMarket.cnn ?? 0)}
            <span className="yds-market-hero__current-market-metric-sep"> · </span>
            BofA {(currentMarket.bofa ?? 0).toFixed(1)}
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
