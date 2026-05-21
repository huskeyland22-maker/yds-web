import { useState } from "react"
import { buildScoreExplainLayer } from "../utils/buildScoreExplainLayer.js"
import { SCORE_BLEND } from "../utils/ydsScoreExplainConfig.js"

const TONE_BAR = {
  positive: "score-explain__bar-fill--positive",
  neutral: "score-explain__bar-fill--neutral",
  warning: "score-explain__bar-fill--warning",
  shock: "score-explain__bar-fill--shock",
}

const TONE_PTS = {
  positive: "score-explain__pts--positive",
  neutral: "score-explain__pts--neutral",
  warning: "score-explain__pts--warning",
  shock: "score-explain__pts--shock",
}

/**
 * @param {{ driver: import('../utils/buildScoreExplainLayer.js').ExplainDriver }} props
 */
function DriverRow({ driver }) {
  const width = Math.min(100, Math.abs(driver.points) * 6)
  const sign = driver.points > 0 ? "+" : ""

  return (
    <div className={["score-explain__driver", driver.auxiliary ? "score-explain__driver--aux" : ""].join(" ")}>
      <div className="score-explain__driver-head">
        <span className="score-explain__driver-title">{driver.title}</span>
        {!driver.auxiliary ? (
          <span className={["score-explain__pts font-mono tabular-nums", TONE_PTS[driver.tone]].join(" ")}>
            {sign}
            {driver.points}
          </span>
        ) : null}
      </div>
      {!driver.auxiliary ? (
        <div className="score-explain__bar-track" aria-hidden>
          <div
            className={["score-explain__bar-fill", TONE_BAR[driver.tone]].join(" ")}
            style={{ width: `${width}%` }}
          />
        </div>
      ) : null}
      <p className="m-0 score-explain__slope">
        <span className="score-explain__slope-tag">기울기</span>
        {driver.slopeLines.join(" · ")}
        {driver.warn ? <span className="score-explain__warn"> · 경고</span> : null}
      </p>
      {driver.deltaLines.length > 0 ? (
        <p className="m-0 score-explain__delta font-mono tabular-nums">{driver.deltaLines.join(" · ")}</p>
      ) : null}
    </div>
  )
}

/**
 * @param {{ block: import('../utils/buildScoreExplainLayer.js').HorizonExplain }} props
 */
function HorizonBlock({ block }) {
  return (
    <div className="score-explain__horizon">
      <div className="score-explain__horizon-head">
        <span className="score-explain__horizon-label">{block.label}</span>
        <span className="score-explain__horizon-score font-mono tabular-nums">{block.score}</span>
        <span className="score-explain__horizon-action">{block.action}</span>
      </div>
      <div className="score-explain__drivers">
        {block.drivers.map((d) => (
          <DriverRow key={d.key} driver={d} />
        ))}
      </div>
    </div>
  )
}

/**
 * @param {{
 *   panicData?: object | null
 *   snapshot?: import('../macro-risk/engine.js').MacroRiskSnapshot | null
 *   historyRows?: object[]
 * }} props
 */
export default function ScoreExplainLayer({
  panicData = null,
  snapshot = null,
  historyRows = [],
}) {
  const [open, setOpen] = useState(false)

  const layer = buildScoreExplainLayer({ panicData, snapshot, historyRows })

  if (!layer.ready) return null

  return (
    <div className="score-explain">
      <div className="score-explain__toggle-wrap">
        <button
          type="button"
          className={["score-explain__toggle", open ? "score-explain__toggle--open" : ""].join(" ")}
          aria-expanded={open}
          aria-controls="score-explain-panel"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="score-explain__toggle-inner">
            <span className="score-explain__icon" aria-hidden>
              📊
            </span>
            <span className="score-explain__label">근거 보기</span>
            <span className="score-explain__expand font-mono" aria-hidden>
              {open ? "−" : "+"}
            </span>
          </span>
        </button>
      </div>

      <div
        id="score-explain-panel"
        className={["score-explain__collapse", open ? "score-explain__collapse--open" : ""].join(" ")}
      >
        <div className="score-explain__collapse-inner">
          <div className="score-explain__body">
            <p className="m-0 score-explain__blend-meta">
              절대 {Math.round(SCORE_BLEND.absolute * 100)}% · 기울기 {Math.round(SCORE_BLEND.slope * 100)}%
            </p>
            {layer.horizons.map((h) => (
              <HorizonBlock key={h.horizon} block={h} />
            ))}
            {layer.bondAuxiliary.length > 0 ? (
              <div className="score-explain__bond">
                <p className="m-0 score-explain__bond-title">채권·유동성 (보조 · 판정 제외)</p>
                {layer.bondAuxiliary.map((d) => (
                  <DriverRow key={d.key} driver={d} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
