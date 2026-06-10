import { useMemo } from "react"
import { resolveTodayActions } from "../../content/ydsActionGuide.js"
import { resolveCurrentMarketView } from "../../content/ydsCurrentMarketView.js"
import { resolveMomentumLayer } from "../../content/ydsMomentumLayer.js"
import {
  MARKET_LABEL_CURRENT_STAGE,
  MARKET_LABEL_PANIC_INTENSITY,
  resolveMarketStageSnapshot,
} from "../../content/ydsMarketStageLabels.js"
import { getFinalScore } from "../../utils/tradingScores.js"
import YdsDataSourceBadge from "./YdsDataSourceBadge.jsx"

/**
 * V1.9 Hero — 사이클·패닉 → 현재 시장 → 오늘 행동 (5초 판단)
 * @param {{ panicData?: object | null; historyRows?: object[]; className?: string }} props
 */
export default function YdsMarketHeroStack({ panicData = null, historyRows = [], className = "" }) {
  const view = useMemo(() => {
    if (!panicData) return null
    const score = getFinalScore(panicData)
    if (!Number.isFinite(score)) return null

    const momentumData = resolveMomentumLayer(panicData, historyRows)
    const currentMarket = resolveCurrentMarketView(panicData, historyRows)
    const snapshot = resolveMarketStageSnapshot(Math.round(score), momentumData)
    const actions = resolveTodayActions(Math.round(score), momentumData, panicData)
    if (!snapshot.cycle || !snapshot.panic || !actions || !currentMarket) return null

    return { ...snapshot, currentMarket, actions }
  }, [panicData, historyRows])

  if (!view) return null

  const { cycle, panic, ydsScore, currentMarket, actions } = view

  return (
    <section
      className={["yds-market-hero", "yds-market-hero--desk", className].filter(Boolean).join(" ")}
      aria-label="YDS 시장 Hero"
    >
      <div className="yds-market-hero__header yds-market-hero__slot yds-market-hero__slot--meta">
        <span className="yds-market-hero__header-spacer" aria-hidden />
        <YdsDataSourceBadge />
      </div>

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

      <div className="yds-market-hero__long-term yds-market-hero__slot yds-market-hero__slot--scores">
        <article
          className="yds-market-hero__score-card"
          aria-label={`${MARKET_LABEL_CURRENT_STAGE} ${cycle.score}`}
        >
          <p className="yds-market-hero__card-label">{MARKET_LABEL_CURRENT_STAGE}</p>
          <p className="yds-market-hero__score font-mono tabular-nums">{cycle.score}</p>
          <p
            className="yds-market-hero__status"
            style={{ "--hero-color": cycle.color }}
          >
            {cycle.emoji} {cycle.label}
          </p>
          {cycle.hint ? (
            <p className="yds-market-hero__status-hint">{cycle.hint}</p>
          ) : null}
        </article>

        <article
          className="yds-market-hero__score-card"
          aria-label={`${MARKET_LABEL_PANIC_INTENSITY} ${ydsScore}`}
        >
          <p className="yds-market-hero__card-label">{MARKET_LABEL_PANIC_INTENSITY}</p>
          <p className="yds-market-hero__score font-mono tabular-nums">{ydsScore}</p>
          <p
            className="yds-market-hero__status"
            style={{ "--hero-color": panic.color }}
          >
            {panic.emoji} {panic.label}
          </p>
          {panic.hint ? (
            <p className="yds-market-hero__status-hint">{panic.hint}</p>
          ) : null}
        </article>
      </div>
    </section>
  )
}
