import { useState } from "react"
import { buildScoreExplainLayer } from "../utils/buildScoreExplainLayer.js"
import { getActionScoreBreakdown } from "../utils/buildActionScoreXai.js"

/** @param {number} n */
function formatPts(n) {
  if (n > 0) return `+${n}`
  return String(n)
}

/**
 * @param {{ label: string; value: number; plain?: boolean; final?: boolean }} props
 */
function BreakdownRow({ label, value, plain = false, final = false }) {
  const tone = value > 0 ? "reco-step-card__pts--up" : value < 0 ? "reco-step-card__pts--down" : ""
  return (
    <div
      className={[
        "reco-step-card__breakdown-row font-mono tabular-nums",
        final ? "reco-step-card__breakdown-row--final" : "",
      ].join(" ")}
    >
      <span>{label}</span>
      <span
        className={
          final
            ? "reco-step-card__final-num"
            : plain
              ? ""
              : ["reco-step-card__pts", tone].join(" ")
        }
      >
        {plain || final ? value : formatPts(value)}
      </span>
    </div>
  )
}

/**
 * @param {{ block: import("../utils/buildScoreExplainLayer.js").HorizonExplain }} props
 */
function HorizonStepCard({ block }) {
  const [xaiOpen, setXaiOpen] = useState(false)
  const drivers = block.drivers.filter((d) => !d.auxiliary)
  const xai = block.actionScoreXai
  const breakdown = getActionScoreBreakdown(xai)
  const panicLabel = (xai.display.panicStatus || "—").replace(/\s+/g, "")
  const driverSummary = drivers.map((d) => `${d.metricLabel} ${d.statusShort}`).join(" / ")

  return (
    <article className="reco-step-card" aria-label={`${block.label} ${block.action}`}>
      <header className="reco-step-card__head">
        <h3 className="m-0 reco-step-card__action">{block.action}</h3>
        <p className="m-0 reco-step-card__head-score font-mono tabular-nums">
          <span className="reco-step-card__head-score-label">행동점수</span>
          <span className="reco-step-card__head-score-value">{breakdown.final}</span>
        </p>
      </header>

      <p className="m-0 reco-step-card__panic">
        <span className="reco-step-card__panic-label">패닉 :</span> {panicLabel}
      </p>

      {driverSummary ? <p className="m-0 reco-step-card__summary">{driverSummary}</p> : null}

      <button
        type="button"
        className="reco-step-card__why-toggle"
        onClick={() => setXaiOpen((v) => !v)}
        aria-expanded={xaiOpen}
        aria-controls={`reco-step-xai-${block.horizon}`}
      >
        <span>왜 {breakdown.final}점인가?</span>
        <span className="reco-step-card__why-icon" aria-hidden>
          {xaiOpen ? "−" : "+"}
        </span>
      </button>

      {xaiOpen ? (
        <div
          id={`reco-step-xai-${block.horizon}`}
          className="reco-step-card__xai-panel"
        >
          <BreakdownRow label="기본" value={breakdown.base} plain />
          <BreakdownRow label="근거" value={breakdown.basis} />
          <BreakdownRow label="보정" value={breakdown.adjustment} />
          <hr className="reco-step-card__xai-rule" aria-hidden />
          <BreakdownRow label="최종" value={breakdown.final} final />
        </div>
      ) : null}
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
