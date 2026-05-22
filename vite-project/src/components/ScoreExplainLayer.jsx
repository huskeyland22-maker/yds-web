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
 * @param {{ contribution: import('../utils/buildScoreExplainLayer.js').HorizonContribution; variant?: 'header' | 'detail' }} props
 */
function ContributionSummary({ contribution, variant = "detail" }) {
  const { total, positive, risk, lines } = contribution
  const rootClass =
    variant === "header"
      ? "score-explain__contrib-header"
      : "score-explain__contrib-detail"

  if (variant === "header") {
    return (
      <div className={rootClass}>
        <p className="m-0 score-explain__contrib-total-line font-mono tabular-nums">
          총점 {formatContributionPts(total)}
        </p>
        <p className="m-0 score-explain__contrib-split font-mono tabular-nums">
          (긍정 {formatContributionPts(positive)} / 위험 {formatContributionPts(risk)})
        </p>
      </div>
    )
  }

  return (
    <div className={rootClass}>
      <ul className="m-0 score-explain__contrib-lines">
        {lines.map((line) => (
          <li
            key={line.label}
            className={[
              "score-explain__contrib-line font-mono tabular-nums",
              line.points > 0
                ? "score-explain__contrib-line--positive"
                : line.points < 0
                  ? "score-explain__contrib-line--risk"
                  : "",
            ].join(" ")}
          >
            <span>{line.label}</span>
            <span>{formatContributionPts(line.points)}</span>
          </li>
        ))}
      </ul>
      <hr className="score-explain__contrib-divider" />
      <p className="m-0 score-explain__contrib-total-row font-mono tabular-nums">
        <span>총점</span>
        <span>{formatContributionPts(total)}</span>
      </p>
    </div>
  )
}

/**
 * @param {{ driver: import('../utils/buildScoreExplainLayer.js').ExplainDriver }} props
 */
function DriverRow({ driver }) {
  const slopeItems = Array.isArray(driver.slopeItems) ? driver.slopeItems : driver.slopeLines ?? []

  return (
    <article
      className={["score-explain__driver", driver.auxiliary ? "score-explain__driver--aux" : ""].join(" ")}
    >
      <div className="score-explain__driver-head">
        <span className="score-explain__driver-title">{driver.title}</span>
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
          <div className="score-explain__horizon-action-block">
            <span className="score-explain__horizon-action">{block.action}</span>
            <ContributionSummary contribution={block.contribution} variant="header" />
          </div>
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
          <ContributionSummary contribution={block.contribution} variant="detail" />
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
