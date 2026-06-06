import { useMemo } from "react"
import { getFinalScore } from "../../utils/tradingScores.js"
import { resolveMomentumLayer } from "../../content/ydsMomentumLayer.js"
import { resolveYdsStatusSnapshot } from "../../content/ydsStatusLabels.js"

/**
 * Hero 핵심 — 사이클·패닉 점수 중심 (1초·2초·3초 이해)
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
      <div className="yds-status-panel__hero-grid">
        <article
          className="yds-status-panel__score-card"
          aria-label={`사이클 위치 ${cycle.score}`}
        >
          <p className="yds-status-panel__card-label">사이클 위치</p>
          <p className="yds-status-panel__hero-score font-mono tabular-nums">{cycle.score}</p>
          <p
            className="yds-status-panel__hero-status"
            style={{ "--status-color": cycle.color }}
          >
            {cycle.emoji} {cycle.label}
          </p>
        </article>

        <article
          className="yds-status-panel__score-card"
          aria-label={`패닉 강도 ${ydsScore}`}
        >
          <p className="yds-status-panel__card-label">패닉 강도</p>
          <p className="yds-status-panel__hero-score font-mono tabular-nums">{ydsScore}</p>
          <p
            className="yds-status-panel__hero-status"
            style={{ "--status-color": panic.color }}
          >
            {panic.emoji} {panic.label}
          </p>
        </article>
      </div>

      <div className="yds-status-panel__momentum">
        <p className="yds-status-panel__momentum-key">Momentum</p>
        <p
          className="yds-status-panel__momentum-value"
          style={{ "--status-color": momentum.color }}
        >
          {momentum.emoji} {momentum.label}
        </p>
        <p className="yds-status-panel__momentum-meta font-mono tabular-nums">
          {momentumData.cnnDelta3d != null ? (
            <span>CNN {momentumData.cnnDelta3d > 0 ? "+" : ""}{Math.round(momentumData.cnnDelta3d)}p</span>
          ) : (
            <span className="yds-status-panel__meta-muted">—</span>
          )}
        </p>
      </div>

      {headline ? (
        <p className="yds-status-panel__headline">
          {headline.emoji} {headline.text}
        </p>
      ) : null}
    </section>
  )
}
