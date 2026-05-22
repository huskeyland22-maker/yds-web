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
 *   emphasized?: boolean
 *   plain?: boolean
 * }} props
 */
function BreakdownRow({ label, value, emphasized = false, plain = false }) {
  const tone = value > 0 ? "reco-step-card__pts--up" : value < 0 ? "reco-step-card__pts--down" : ""
  return (
    <div
      className={[
        "reco-step-card__breakdown-row font-mono tabular-nums",
        emphasized ? "reco-step-card__breakdown-row--final" : "",
      ].join(" ")}
    >
      <span>{label}</span>
      <span className={plain ? "" : ["reco-step-card__pts", tone].join(" ")}>
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

  return (
    <article className="reco-step-card" aria-label={`${block.label} ${block.action}`}>
      <h3 className="m-0 reco-step-card__action">{block.action}</h3>

      <p className="m-0 reco-step-card__score font-mono tabular-nums">
        <span className="reco-step-card__score-label">행동점수</span>
        <span className="reco-step-card__score-value">{block.score}</span>
      </p>

      <div className="reco-step-card__breakdown">
        <BreakdownRow label="기본점수" value={breakdown.base} plain />
        <BreakdownRow label="근거합계" value={breakdown.basis} />
        <BreakdownRow label="보정" value={breakdown.adjustment} />
        <hr className="reco-step-card__breakdown-divider" aria-hidden />
        <BreakdownRow label="최종점수" value={breakdown.final} emphasized plain />
      </div>

      <p className="m-0 reco-step-card__detail-heading">세부 근거:</p>
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
 *   snapshot?: import("../macro-risk/engine.js').MacroRiskSnapshot | null
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
