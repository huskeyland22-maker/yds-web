import { useMemo, useState } from "react"
import { buildTodayActionPanel } from "../utils/buildTodayActionPanel.js"
import { TACTICAL_SCORE_LEGEND } from "../utils/tacticalScoreInterpretation.js"
import ActionEvidenceSection from "./ActionEvidenceSection.jsx"

function TacticalHudSectionHead() {
  return (
    <header className="tactical-hud__head border-l-2 border-cyan-400/45 pl-2 text-left">
      <p className="m-0 text-[11px] font-bold text-slate-100">투자 전략 엔진</p>
      <p className="m-0 mt-0.5 text-[9px] text-slate-500">단기 · 중기 · 장기 · 실전 판단</p>
    </header>
  )
}

/**
 * @param {{
 *   panicData?: object | null
 *   cycleScore?: number | null
 *   snapshot?: import("../macro-risk/engine.js").MacroRiskSnapshot | null
 *   historyRows?: object[]
 * }} props
 */
export default function TodayActionPanel({
  panicData = null,
  cycleScore = null,
  snapshot = null,
  historyRows = [],
}) {
  const model = useMemo(
    () => buildTodayActionPanel({ panicData, cycleScore, snapshot, historyRows }),
    [panicData, cycleScore, snapshot, historyRows],
  )

  const [selectedId, setSelectedId] = useState("short")
  const [evidenceOpen, setEvidenceOpen] = useState(false)

  if (!model.ready) {
    return (
      <section className="tactical-hud" aria-label="투자 전략 엔진">
        <TacticalHudSectionHead />
        <p className="m-0 tactical-hud__placeholder">Cycle·패닉 입력 후 전술 HUD 생성</p>
      </section>
    )
  }

  return (
    <section className="tactical-hud" aria-label="투자 전략 엔진">
      <TacticalHudSectionHead />
      <div className="tactical-hud__row">
        {model.tacticalCards.map((card) => {
          const isSelected = selectedId === card.id
          return (
            <button
              key={card.id}
              type="button"
              className={["tactical-hud__cell", isSelected ? "tactical-hud__cell--active" : ""].join(" ")}
              onClick={() => setSelectedId(card.id)}
              aria-pressed={isSelected}
              aria-label={
                card.scoreLine
                  ? `${card.period} ${card.action} ${card.scoreLine}`
                  : `${card.period} ${card.action} ${card.score ?? ""}`
              }
            >
              <span className="tactical-hud__period">{card.period}</span>
              <span className="tactical-hud__action">{card.action}</span>
              {card.scoreLine ? (
                <span
                  className="tactical-hud__score font-mono tabular-nums"
                  data-band={card.scoreBand ?? undefined}
                >
                  <span className="tactical-hud__score-num">{card.score}</span>
                  <span className="tactical-hud__score-sep" aria-hidden>
                    |
                  </span>
                  <span className="tactical-hud__score-hint">{card.scoreHint}</span>
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <p className="tactical-hud__legend m-0" aria-label="점수 구간 범례">
        {TACTICAL_SCORE_LEGEND.join(" · ")}
      </p>

      <div className="tactical-hud__footer">
        <button
          type="button"
          className="tactical-hud__evidence-toggle"
          onClick={() => setEvidenceOpen((v) => !v)}
          aria-expanded={evidenceOpen}
        >
          <span>근거 보기</span>
          <span aria-hidden>{evidenceOpen ? "−" : "+"}</span>
        </button>
        {evidenceOpen ? <ActionEvidenceSection layer={model.explainLayer} /> : null}
      </div>
    </section>
  )
}
