import { buildScoreExplainLayer } from "../utils/buildScoreExplainLayer.js"
import { getActionScoreBreakdown } from "../utils/buildActionScoreXai.js"

/** @param {number} n */
function formatPts(n) {
  if (n > 0) return `+${n}`
  return String(n)
}

/**
 * @param {{ label: string; value: number; plain?: boolean }} props
 */
function BreakdownRow({ label, value, plain = false }) {
  const tone = value > 0 ? "reco-step-card__pts--up" : value < 0 ? "reco-step-card__pts--down" : ""
  return (
    <div className="reco-step-card__breakdown-row font-mono tabular-nums">
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
  const panicLabel = (xai.display.panicStatus || "—").replace(/\s+/g, "")

  return (
    <article className="reco-step-card" aria-label={`${block.label} ${block.action}`}>
      <h3 className="m-0 reco-step-card__action">{block.action}</h3>

      <div className="reco-step-card__top-grid">
        <section className="reco-step-card__pane reco-step-card__pane--panic">
          <p className="m-0 reco-step-card__pane-title">패닉</p>
          <p className="m-0 reco-step-card__pane-value">{panicLabel}</p>
        </section>

        <section className="reco-step-card__pane reco-step-card__pane--breakdown">
          <p className="m-0 reco-step-card__pane-title">점수분해</p>
          <div className="reco-step-card__pane-body">
            <BreakdownRow label="기본" value={breakdown.base} plain />
            <BreakdownRow label="근거" value={breakdown.basis} />
            <BreakdownRow label="보정" value={breakdown.adjustment} />
          </div>
        </section>

        <section className="reco-step-card__pane reco-step-card__pane--final">
          <p className="m-0 reco-step-card__pane-title">최종</p>
          <p className="m-0 reco-step-card__final-score font-mono tabular-nums">
            <span className="reco-step-card__final-label">행동점수</span>
            <span className="reco-step-card__final-value">{breakdown.final}</span>
          </p>
        </section>
      </div>

      <div className="reco-step-card__detail">
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
      </div>
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
