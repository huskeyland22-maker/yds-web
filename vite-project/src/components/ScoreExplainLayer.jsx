import { buildScoreExplainLayer } from "../utils/buildScoreExplainLayer.js"

/** @param {number} n */
function formatPts(n) {
  if (n > 0) return `+${n}`
  return String(n)
}

/**
 * @param {{ points: number; final?: boolean }} props
 */
function RecoPts({ points, final = false }) {
  if (final) {
    return <span className="reco-xai__pts reco-xai__pts--final font-mono tabular-nums">{points}</span>
  }
  const tone = points > 0 ? "reco-xai__pts--up" : points < 0 ? "reco-xai__pts--down" : ""
  return <span className={["reco-xai__pts font-mono tabular-nums", tone].join(" ")}>{formatPts(points)}</span>
}

/**
 * @param {{ label: string; points: number; sum?: boolean }} props
 */
function RecoXaiRow({ label, points, sum = false }) {
  return (
    <div className={["reco-xai__row font-mono tabular-nums", sum ? "reco-xai__row--sum" : ""].join(" ")}>
      <span>{label}</span>
      <RecoPts points={points} />
    </div>
  )
}

/**
 * @param {{ block: import("../utils/buildScoreExplainLayer.js").HorizonExplain }} props
 */
function HorizonRecoCard({ block }) {
  const xai = block.actionScoreXai
  const { display } = xai

  return (
    <article className="reco-xai-card" aria-label={`${block.label} ${block.action}`}>
      <h3 className="m-0 reco-xai-card__action">{block.action}</h3>

      <div className="reco-xai-card__top">
        <div className="reco-xai__pane reco-xai__pane--panic">
          <p className="m-0 reco-xai__pane-title">패닉</p>
          <p className="m-0 reco-xai__pane-value">{display.panicStatus}</p>
        </div>

        <div className="reco-xai__pane reco-xai__pane--basis">
          <p className="m-0 reco-xai__pane-title">근거</p>
          <div className="reco-xai__pane-body">
            {xai.basis.lines.map((line) => (
              <RecoXaiRow key={line.label} label={line.label} points={line.points} />
            ))}
            <RecoXaiRow label="합계" points={xai.basis.total} sum />
          </div>
        </div>

        <div className="reco-xai__pane reco-xai__pane--final">
          <p className="m-0 reco-xai__pane-title">최종</p>
          <div className="reco-xai__row reco-xai__row--final font-mono tabular-nums">
            <span>행동점수</span>
            <RecoPts points={xai.final} final />
          </div>
        </div>
      </div>

      <hr className="reco-xai-card__split" aria-hidden />

      <section className="reco-xai-card__adj">
        <p className="m-0 reco-xai__pane-title">보정</p>
        <div className="reco-xai__adj-body">
          {xai.adjustments.items.map((item) => (
            <RecoXaiRow key={item.label} label={item.label} points={item.points} />
          ))}
        </div>
      </section>
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
    <div className="reco-xai-stack">
      {layer.horizons.map((h) => (
        <HorizonRecoCard key={h.horizon} block={h} />
      ))}
    </div>
  )
}
