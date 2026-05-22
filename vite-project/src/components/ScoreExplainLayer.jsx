import { buildScoreExplainLayer } from "../utils/buildScoreExplainLayer.js"
import { formatActionScoreXaiLine } from "../utils/buildActionScoreXai.js"

/** @param {number} n */
function formatPts(n) {
  if (n > 0) return `+${n}`
  return String(n)
}

/**
 * @param {{ block: import("../utils/buildScoreExplainLayer.js").HorizonExplain }} props
 */
function HorizonStepCard({ block }) {
  const drivers = block.drivers.filter((d) => !d.auxiliary)
  const xaiLine = formatActionScoreXaiLine(block.actionScoreXai, "formula")

  return (
    <article className="reco-step-card" aria-label={`${block.label} ${block.action}`}>
      <h3 className="m-0 reco-step-card__action">{block.action}</h3>

      <p className="m-0 reco-step-card__score font-mono tabular-nums">
        <span className="reco-step-card__score-label">행동점수</span>
        <span className="reco-step-card__score-value">{block.score}</span>
      </p>

      <ul className="m-0 reco-step-card__drivers">
        {drivers.map((d) => {
          const tone =
            d.points > 0 ? "reco-step-card__pts--up" : d.points < 0 ? "reco-step-card__pts--down" : ""
          return (
            <li key={d.key} className="reco-step-card__driver font-mono tabular-nums">
              <span className="reco-step-card__driver-left">
                {d.metricLabel} {d.statusShort}
              </span>
              <span className={["reco-step-card__pts", tone].join(" ")}>{formatPts(d.points)}</span>
            </li>
          )
        })}
      </ul>

      <p className="m-0 reco-step-card__xai font-mono tabular-nums">{xaiLine}</p>
    </article>
  )
}

/**
 * @param {{
 *   panicData?: object | null
 *   snapshot?: import("../macro-risk/engine.js").MacroRiskSnapshot | null
 *   historyRows?: object[]
 *   cycleScore?: number | null
 * }} props
 */
export default function ScoreExplainLayer({
  panicData = null,
  snapshot = null,
  historyRows = [],
  cycleScore = null,
}) {
  const layer = buildScoreExplainLayer({ panicData, snapshot, historyRows, cycleScore })

  if (!layer.ready) return null

  return (
    <div className="reco-step-stack">
      {layer.horizons.map((h) => (
        <HorizonStepCard key={h.horizon} block={h} />
      ))}
    </div>
  )
}
