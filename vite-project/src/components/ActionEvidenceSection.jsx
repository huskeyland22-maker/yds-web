import { getActionScoreBreakdown } from "../utils/buildActionScoreXai.js"

/** @param {number} n */
function formatPts(n) {
  if (n > 0) return `+${n}`
  return String(n)
}

/**
 * @param {{ horizon: import("../utils/buildScoreExplainLayer.js").HorizonExplain }} props
 */
function HorizonEvidence({ horizon: block }) {
  const breakdown = getActionScoreBreakdown(block.actionScoreXai)
  const drivers = block.drivers.filter((d) => !d.auxiliary)

  return (
    <div className="today-evidence__block">
      <p className="m-0 today-evidence__block-title font-mono tabular-nums">
        <span>{block.label}</span>
        <span className="today-evidence__block-score">{breakdown.final}</span>
      </p>
      <div className="today-evidence__formula font-mono tabular-nums">
        <span>기본 {breakdown.base}</span>
        <span>근거 {formatPts(breakdown.basis)}</span>
        <span>보정 {formatPts(breakdown.adjustment)}</span>
        <span className="today-evidence__final">최종 {breakdown.final}</span>
      </div>
      {drivers.length > 0 ? (
        <ul className="m-0 today-evidence__drivers">
          {drivers.map((d) => {
            const tone =
              d.points > 0 ? "today-evidence__pts--up" : d.points < 0 ? "today-evidence__pts--down" : ""
            return (
              <li key={d.key} className={["today-evidence__driver", tone].join(" ")}>
                <span>
                  {d.metricLabel} {d.statusShort}
                </span>
                <span>{formatPts(d.points)}</span>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

/**
 * @param {{ layer: import("../utils/buildScoreExplainLayer.js").ScoreExplainLayer }} props
 */
export default function ActionEvidenceSection({ layer }) {
  if (!layer.ready || layer.horizons.length === 0) return null

  return (
    <div className="today-evidence__body">
      {layer.horizons.map((h) => (
        <HorizonEvidence key={h.horizon} horizon={h} />
      ))}
    </div>
  )
}
