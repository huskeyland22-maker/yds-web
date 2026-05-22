import { buildScoreExplainLayer } from "../utils/buildScoreExplainLayer.js"
import { getActionScoreBreakdown } from "../utils/buildActionScoreXai.js"

/** @param {number} n */
function formatPts(n) {
  if (n > 0) return `+${n}`
  return String(n)
}

/**
 * @param {{
 *   label: string
 *   value: number
 *   plain?: boolean
 *   className?: string
 * }} props
 */
function MetricRow({ label, value, plain = false, className = "" }) {
  const tone = value > 0 ? "reco-step-card__pts--up" : value < 0 ? "reco-step-card__pts--down" : ""
  return (
    <div className={["reco-step-card__metric-row font-mono tabular-nums", className].join(" ")}>
      <span className="reco-step-card__metric-label">{label}</span>
      <span className={plain ? "reco-step-card__metric-num" : ["reco-step-card__metric-num", "reco-step-card__pts", tone].join(" ")}>
        {plain ? value : formatPts(value)}
      </span>
    </div>
  )
}

/**
 * @param {{ block: import("../utils/buildScoreExplainLayer.js").HorizonExplain }} props
 */
function HorizonStepCard({ block }) {
  const drivers = block.drivers.filter((d) => !d.auxiliary)
  const xai = block.actionScoreXai
  const breakdown = getActionScoreBreakdown(xai)
  const panicLabel = (xai.display.panicStatus || "—").replace(/\s+/g, "")

  return (
    <article className="reco-step-card" aria-label={`${block.label} ${block.action}`}>
      <header className="reco-step-card__head">
        <h3 className="m-0 reco-step-card__action">{block.action}</h3>
        <p className="m-0 reco-step-card__head-score font-mono tabular-nums">
          <span className="reco-step-card__head-score-label">행동점수</span>
          <span className="reco-step-card__head-score-value">{breakdown.final}</span>
        </p>
      </header>

      <div className="reco-step-card__inline">
        <p className="m-0 reco-step-card__panic reco-step-card__inline-panic">
          <span className="reco-step-card__metric-label">패닉:</span>
          <span>{panicLabel}</span>
        </p>
        <MetricRow className="reco-step-card__inline-calc-1" label="기본" value={breakdown.base} plain />
        <MetricRow className="reco-step-card__inline-calc-2" label="근거" value={breakdown.basis} />
        <MetricRow className="reco-step-card__inline-calc-3" label="보정" value={breakdown.adjustment} />
        <div className="reco-step-card__metric-row reco-step-card__inline-final font-mono tabular-nums">
          <span className="reco-step-card__metric-label">최종</span>
          <span className="reco-step-card__final-num">{breakdown.final}</span>
        </div>
      </div>

      <hr className="reco-step-card__rule" aria-hidden />

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
