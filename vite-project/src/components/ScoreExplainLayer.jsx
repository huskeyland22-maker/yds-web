import { useState } from "react"
import { buildScoreExplainLayer } from "../utils/buildScoreExplainLayer.js"
import { SCORE_BLEND } from "../utils/ydsScoreExplainConfig.js"

/** positive=green · neutral=gray · risk/warning=orange · shock=red */
const TONE_PTS = {
  positive: "score-explain__pts--positive",
  neutral: "score-explain__pts--neutral",
  warning: "score-explain__pts--risk",
  risk: "score-explain__pts--risk",
  shock: "score-explain__pts--shock",
}

/** 상승=green · 안정=gray · 하락=orange */
const TONE_SLOPE_DIR = {
  positive: "score-explain__slope-line--positive",
  neutral: "score-explain__slope-line--neutral",
  risk: "score-explain__slope-line--risk",
}

/**
 * @param {{ driver: import('../utils/buildScoreExplainLayer.js').ExplainDriver }} props
 */
function DriverRow({ driver }) {
  const sign = driver.points > 0 ? "+" : ""
  const slopeItems = Array.isArray(driver.slopeItems) ? driver.slopeItems : driver.slopeLines ?? []

  return (
    <article
      className={["score-explain__driver", driver.auxiliary ? "score-explain__driver--aux" : ""].join(" ")}
    >
      <div className="score-explain__driver-head">
        <span className="score-explain__driver-title">{driver.title}</span>
        {!driver.auxiliary ? (
          <span className={["score-explain__pts font-mono tabular-nums", TONE_PTS[driver.tone] ?? TONE_PTS.neutral].join(" ")}>
            {sign}
            {driver.points}
          </span>
        ) : null}
      </div>

      {slopeItems.length > 0 ? (
        <div className="score-explain__slope-block">
          <p className="m-0 score-explain__slope-heading">기울기</p>
          <ul className="m-0 score-explain__slope-list">
            {slopeItems.map((item) => {
              const label = typeof item === "string" ? item : item.label
              const tone =
                typeof item === "object" && item?.tone
                  ? TONE_SLOPE_DIR[item.tone] ?? TONE_SLOPE_DIR.neutral
                  : TONE_SLOPE_DIR.neutral
              const key =
                typeof item === "object" && item?.horizon
                  ? `${driver.key}-${item.horizon}`
                  : `${driver.key}-${label}`
              return (
                <li key={key} className={["score-explain__slope-line", tone].join(" ")}>
                  {label}
                </li>
              )
            })}
          </ul>
          {driver.warn ? <p className="m-0 score-explain__warn">경고</p> : null}
        </div>
      ) : null}
    </article>
  )
}

/**
 * @param {{ block: import('../utils/buildScoreExplainLayer.js').HorizonExplain }} props
 */
function HorizonAccordion({ block, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = `score-explain-${block.horizon}`

  return (
    <section className="score-explain__horizon" aria-label={`${block.label} 점수 근거`}>
      <header className="score-explain__horizon-head">
        <div className="score-explain__horizon-meta">
          <span className="score-explain__horizon-label">{block.label}</span>
          <span className="score-explain__horizon-action">{block.action}</span>
          <span className="score-explain__horizon-score font-mono tabular-nums">{block.score}</span>
        </div>
        <button
          type="button"
          className={["score-explain__horizon-toggle", open ? "score-explain__horizon-toggle--open" : ""].join(" ")}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          <span>근거 보기</span>
          <span className="score-explain__expand font-mono" aria-hidden>
            {open ? "−" : "+"}
          </span>
        </button>
      </header>

      <div
        id={panelId}
        className={["score-explain__collapse score-explain__horizon-collapse", open ? "score-explain__collapse--open" : ""].join(" ")}
      >
        <div className="score-explain__collapse-inner">
          <div className="score-explain__drivers">
            {block.drivers.map((d) => (
              <DriverRow key={d.key} driver={d} />
            ))}
          </div>
        </div>
      </div>
    </section>
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
  const [bondOpen, setBondOpen] = useState(false)

  const layer = buildScoreExplainLayer({ panicData, snapshot, historyRows })

  if (!layer.ready) return null

  return (
    <div className="score-explain">
      <p className="m-0 score-explain__blend-meta">
        절대 {Math.round(SCORE_BLEND.absolute * 100)}% · 기울기 {Math.round(SCORE_BLEND.slope * 100)}%
      </p>

      {layer.horizons.map((h) => (
        <HorizonAccordion key={h.horizon} block={h} defaultOpen={h.horizon === "short"} />
      ))}

      {layer.bondAuxiliary.length > 0 ? (
        <section className="score-explain__bond" aria-label="채권·유동성 보조">
          <header className="score-explain__horizon-head score-explain__horizon-head--bond">
            <p className="m-0 score-explain__bond-title">채권·유동성 (보조 · 판정 제외)</p>
            <button
              type="button"
              className={["score-explain__horizon-toggle", bondOpen ? "score-explain__horizon-toggle--open" : ""].join(" ")}
              aria-expanded={bondOpen}
              aria-controls="score-explain-bond"
              onClick={() => setBondOpen((v) => !v)}
            >
              <span>근거 보기</span>
              <span className="score-explain__expand font-mono" aria-hidden>
                {bondOpen ? "−" : "+"}
              </span>
            </button>
          </header>
          <div
            id="score-explain-bond"
            className={["score-explain__collapse score-explain__horizon-collapse", bondOpen ? "score-explain__collapse--open" : ""].join(" ")}
          >
            <div className="score-explain__collapse-inner">
              <div className="score-explain__drivers">
                {layer.bondAuxiliary.map((d) => (
                  <DriverRow key={d.key} driver={d} />
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}
