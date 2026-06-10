import { useMemo } from "react"
import { resolveTodayActionsFromSnapshot } from "../../content/ydsActionGuide.js"
import { currentMarketViewFromSnapshot } from "../../content/ydsCurrentMarketView.js"
import { resolveMarketStageSnapshot } from "../../content/ydsMarketStageLabels.js"
import { getFinalScore } from "../../utils/tradingScores.js"

/**
 * Hero — 현재 시장 상태 · 오늘의 행동 (YDS 단일 판정)
 * @param {{ panicData?: object | null; historyRows?: object[]; className?: string }} props
 */
export default function YdsMarketHeroStack({ panicData = null, historyRows: _historyRows = [], className = "" }) {
  const view = useMemo(() => {
    if (!panicData) return null
    const score = getFinalScore(panicData)
    if (!Number.isFinite(score)) return null

    const snapshot = resolveMarketStageSnapshot(Math.round(score))
    const currentMarket = currentMarketViewFromSnapshot(snapshot)
    const actions = resolveTodayActionsFromSnapshot(snapshot, panicData)
    if (!actions || !currentMarket) return null

    return { currentMarket, actions }
  }, [panicData])

  if (!view) return null

  const { currentMarket, actions } = view

  return (
    <section
      className={["yds-market-hero", "yds-market-hero--desk", className].filter(Boolean).join(" ")}
      aria-label="YDS 시장 Hero"
    >
      <div className="yds-market-hero__dual-row yds-market-hero__slot yds-market-hero__slot--judgment">
        <article className="yds-market-hero__current-market" aria-label="현재 시장 상태">
          <p className="yds-market-hero__layer-tag">현재 시장 상태</p>
          <p
            className="yds-market-hero__current-market-label"
            style={{ "--hero-color": currentMarket.color }}
          >
            {currentMarket.emoji} {currentMarket.label}
          </p>
          {currentMarket.hint ? (
            <p className="yds-market-hero__current-market-cause">{currentMarket.hint}</p>
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
        </article>
      </div>
    </section>
  )
}
