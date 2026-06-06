import { useMemo } from "react"
import { getFinalScore } from "../../utils/tradingScores.js"
import { resolveMomentumLayer } from "../../content/ydsMomentumLayer.js"
import { resolveYdsStatusSnapshot } from "../../content/ydsStatusLabels.js"

/**
 * 3초 이해용 Status Label 패널 — 상태 문구 우선 · 점수 보조
 * @param {{ panicData?: object | null; historyRows?: object[] }} props
 */
export default function YdsStatusLabelPanel({ panicData = null, historyRows = [] }) {
  const view = useMemo(() => {
    if (!panicData) return null
    const score = getFinalScore(panicData)
    if (!Number.isFinite(score)) return null
    const momentum = resolveMomentumLayer(panicData, historyRows)
    const snapshot = resolveYdsStatusSnapshot(Math.round(score), momentum)
    return { ...snapshot, momentumData: momentum }
  }, [panicData, historyRows])

  if (!view?.cycle || !view.panic) return null

  const { cycle, panic, momentum, ydsScore, momentumData, headline } = view

  return (
    <section className="yds-status-panel" aria-label="시장 상태 한눈에">
      {headline ? (
        <p className="yds-status-panel__headline">
          {headline.emoji} {headline.text}
        </p>
      ) : null}

      <h2 className="yds-status-panel__title">지금 시장 상태</h2>

      <div className="yds-status-panel__rows">
        <div className="yds-status-panel__row">
          <p className="yds-status-panel__key">사이클</p>
          <p
            className="yds-status-panel__status"
            style={{ "--status-color": cycle.color }}
          >
            <span className="yds-status-panel__status-main">
              {cycle.emoji} {cycle.label}
            </span>
          </p>
          <p className="yds-status-panel__score font-mono tabular-nums">
            {cycle.score}
            <span className="yds-status-panel__score-denom"> / 100</span>
          </p>
        </div>

        <div className="yds-status-panel__row">
          <p className="yds-status-panel__key">패닉</p>
          <p
            className="yds-status-panel__status"
            style={{ "--status-color": panic.color }}
          >
            <span className="yds-status-panel__status-main">
              {panic.emoji} {panic.label}
            </span>
          </p>
          <p className="yds-status-panel__score font-mono tabular-nums">
            {ydsScore}
            <span className="yds-status-panel__score-denom"> / 100</span>
          </p>
        </div>

        <div className="yds-status-panel__row">
          <p className="yds-status-panel__key">Momentum</p>
          <p
            className="yds-status-panel__status"
            style={{ "--status-color": momentum.color }}
          >
            <span className="yds-status-panel__status-main">
              {momentum.emoji} {momentum.label}
            </span>
          </p>
          <p className="yds-status-panel__meta font-mono tabular-nums">
            {momentumData.cnnDelta3d != null ? (
              <span>CNN {momentumData.cnnDelta3d > 0 ? "+" : ""}{Math.round(momentumData.cnnDelta3d)}p</span>
            ) : (
              <span className="yds-status-panel__meta-muted">—</span>
            )}
          </p>
        </div>
      </div>
    </section>
  )
}
