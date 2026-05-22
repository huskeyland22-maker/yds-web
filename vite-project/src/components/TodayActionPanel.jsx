import { useMemo, useState } from "react"
import { buildTodayActionPanel } from "../utils/buildTodayActionPanel.js"
import ActionEvidenceSection from "./ActionEvidenceSection.jsx"

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
      <section className="tactical-hud" aria-label="전술 HUD">
        <p className="m-0 tactical-hud__placeholder">Cycle·패닉 입력 후 전술 HUD 생성</p>
      </section>
    )
  }

  return (
    <section className="tactical-hud" aria-label="전술 HUD">
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
              aria-label={`${card.period} ${card.action} ${card.score ?? ""}`}
            >
              <span className="tactical-hud__period">{card.period}</span>
              <span className="tactical-hud__action">{card.action}</span>
              {card.score != null ? (
                <span className="tactical-hud__score font-mono tabular-nums">{card.score}</span>
              ) : null}
            </button>
          )
        })}
      </div>

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
