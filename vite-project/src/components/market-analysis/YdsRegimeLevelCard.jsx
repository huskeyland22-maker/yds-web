import { useMemo } from "react"
import { resolveMarketLevelRegime } from "../../content/ydsRegimeLayer.js"
import { resolveMarketState } from "../../content/ydsStateEngine.js"

/**
 * V2.0 State + Regime — Hero 시장 상태 (동적) · 국면 (90일)
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
  const view = useMemo(() => {
    const state = resolveMarketState(panicData, historyRows, momentumData)
    const levelRegime = resolveMarketLevelRegime(panicData, historyRows, momentumData)
    return { state, regime: levelRegime?.regime ?? null }
  }, [panicData, historyRows, momentumData])

  if (!view.state) return null

  const { state, regime } = view

  return (
    <article className="yds-regime-level" aria-label="시장 상태 · 국면">
      <p className="yds-regime-level__tag">Market State · Regime</p>

      <div className="yds-regime-level__grid">
        <section className="yds-regime-level__block yds-regime-level__block--state" aria-label="시장 상태">
          <p className="yds-regime-level__label">시장 상태</p>
          <p
            className="yds-regime-level__value"
            style={{ "--regime-color": state.color }}
          >
            {state.emoji} {state.label}
          </p>
          {state.subtitles.length ? (
            <ul className="yds-regime-level__subtitles">
              {state.subtitles.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          <p className="yds-regime-level__metric font-mono tabular-nums">
            CNN {Math.round(state.cnn ?? 0)} · BofA {(state.bofa ?? 0).toFixed(1)}
          </p>
        </section>

        {regime ? (
          <section className="yds-regime-level__block yds-regime-level__block--regime" aria-label="시장 국면">
            <p className="yds-regime-level__label">시장 국면 · 최근 {regime.windowDays}일</p>
            <p
              className="yds-regime-level__value yds-regime-level__value--secondary"
              style={{ "--regime-color": regime.color }}
            >
              {regime.emoji} {regime.label}
            </p>
            <p className="yds-regime-level__summary">{regime.summary}</p>
          </section>
        ) : null}
      </div>
    </article>
  )
}
