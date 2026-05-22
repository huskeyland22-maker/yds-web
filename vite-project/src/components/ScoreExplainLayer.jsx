import { useState } from "react"
import { buildScoreExplainLayer } from "../utils/buildScoreExplainLayer.js"
import { SCORE_BLEND } from "../utils/ydsScoreExplainConfig.js"

/** 상승=green · 안정=gray · 하락=orange */
const TONE_SLOPE_DIR = {
  positive: "score-explain__slope-line--positive",
  neutral: "score-explain__slope-line--neutral",
  risk: "score-explain__slope-line--risk",
}

/** @param {number} n */
function formatContributionPts(n) {
  if (n > 0) return `+${n}`
  return String(n)
}

/**
 * @param {{
 *   action: string
 *   actionScore: number
 *   contribution: import('../utils/buildScoreExplainLayer.js').HorizonContribution
 * }} props
 */
function HorizonActionPanel({ action, actionScore, contribution }) {
  const { total, positive, risk } = contribution

  return (
    <div className="score-explain__action-panel">
      <p className="m-0 score-explain__horizon-action">{action}</p>

      <div className="score-explain__score-row score-explain__score-row--action">
        <span className="score-explain__score-label">행동 점수</span>
        <span className="score-explain__score-value score-explain__score-value--action font-mono tabular-nums">
          {actionScore}
        </span>
      </div>

      <hr className="score-explain__score-divider" aria-hidden />

      <div className="score-explain__score-row score-explain__score-row--basis">
        <span className="score-explain__score-label">근거 점수</span>
        <span className="score-explain__score-value score-explain__score-value--basis font-mono tabular-nums">
          {formatContributionPts(total)}
        </span>
      </div>

      <div className="score-explain__polarity-rows">
        <p className="m-0 score-explain__polarity score-explain__polarity--positive font-mono tabular-nums">
          <span className="score-explain__polarity-icon" aria-hidden>
            ▲
          </span>
          <span>긍정 {formatContributionPts(positive)}</span>
        </p>
        <p className="m-0 score-explain__polarity score-explain__polarity--risk font-mono tabular-nums">
          <span className="score-explain__polarity-icon" aria-hidden>
            ▼
          </span>
          <span>위험 {formatContributionPts(risk)}</span>
        </p>
      </div>
    </div>
  )
}

/**
 * @param {{ driver: import('../utils/buildScoreExplainLayer.js').ExplainDriver }} props
 */
function DriverRow({ driver }) {
  const slopeItems = Array.isArray(driver.slopeItems) ? driver.slopeItems : driver.slopeLines ?? []
  const ptsTone =
    driver.points > 0 ? "score-explain__metric-pts--positive" : driver.points < 0 ? "score-explain__metric-pts--risk" : ""

  return (
    <article
      className={["score-explain__driver", driver.auxiliary ? "score-explain__driver--aux" : ""].join(" ")}
    >
      {!driver.auxiliary ? (
        <div className="score-explain__metric-row">
          <span className="score-explain__metric-left">
            <span className="score-explain__metric-label">{driver.metricLabel}</span>
            <span className="score-explain__metric-status">{driver.statusShort}</span>
          </span>
          <span className={["score-explain__metric-pts font-mono tabular-nums", ptsTone].join(" ")}>
            {formatContributionPts(driver.points)}
          </span>
        </div>
      ) : (
        <div className="score-explain__driver-head">
          <span className="score-explain__driver-title">{driver.title}</span>
        </div>
      )}

      {slopeItems.length > 0 ? (
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
      ) : null}

      {driver.warn ? <p className="m-0 score-explain__warn">경고</p> : null}
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
          <HorizonActionPanel
            action={block.action}
            actionScore={block.score}
            contribution={block.contribution}
          />
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
