import { useMemo } from "react"
import { resolveMarketLevelRegime } from "../../content/ydsRegimeLayer.js"

/**
 * V2.0 Level + Regime — Hero 시장 사이클 (절대값 vs 국면)
 * @param {{
 *   panicData?: object | null
 *   historyRows?: object[]
 *   momentumData?: import("../../content/ydsMomentumLayer.js").MomentumLayerView | null
 * }} props
 */
export default function YdsRegimeLevelCard({
  panicData = null,
  historyRows = [],
  momentumData = null,
}) {
  const view = useMemo(
    () => resolveMarketLevelRegime(panicData, historyRows, momentumData),
    [panicData, historyRows, momentumData],
  )

  if (!view?.level || !view.regime) return null

  const { level, regime } = view

  return (
    <article className="yds-regime-level" aria-label="시장 사이클 Level · Regime">
      <p className="yds-regime-level__tag">Market Cycle · Level + Regime</p>

      <div className="yds-regime-level__grid">
        <section className="yds-regime-level__block" aria-label="현재 레벨">
          <p className="yds-regime-level__label">시장 사이클 · 현재 레벨</p>
          <p
            className="yds-regime-level__value"
            style={{ "--regime-color": level.color }}
          >
            {level.emoji} {level.label}
          </p>
          <p className="yds-regime-level__metric font-mono tabular-nums">
            CNN {Math.round(level.cnn ?? 0)} · BofA {(level.bofa ?? 0).toFixed(1)}
          </p>
        </section>

        <section className="yds-regime-level__block yds-regime-level__block--regime" aria-label="시장 국면">
          <p className="yds-regime-level__label">시장 국면 · 최근 {regime.windowDays}일</p>
          <p
            className="yds-regime-level__value"
            style={{ "--regime-color": regime.color }}
          >
            {regime.emoji} {regime.label}
          </p>
          <p className="yds-regime-level__summary">{regime.summary}</p>
        </section>
      </div>
    </article>
  )
}
