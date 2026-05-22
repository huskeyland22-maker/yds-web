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
      <section className="today-action-panel" aria-label="Today Action Panel">
        <p className="m-0 today-action-panel__placeholder">Cycle·패닉 입력 후 작전 패널 생성</p>
      </section>
    )
  }

  const selected =
    model.tacticalCards.find((c) => c.id === selectedId) ?? model.tacticalCards[0]

  return (
    <section className="today-action-panel" aria-label="Today Action Panel">
      <header className="today-action-panel__banner">
        <span className="today-action-panel__banner-line" aria-hidden />
        <p className="m-0 today-action-panel__banner-title">TODAY ACTION PANEL</p>
        <span className="today-action-panel__banner-line" aria-hidden />
      </header>

      <div className={`today-action-panel__hud today-action-panel__hud--${model.zoneTone}`}>
        <div className="today-action-panel__zone">
          <p className="m-0 today-action-panel__eyebrow">시장위치</p>
          <p className={`m-0 today-action-panel__zone-chip today-action-panel__zone-chip--${model.zoneTone}`}>
            {model.zoneLabel}
          </p>
          <div className="today-action-panel__risk">
            <p className="m-0 today-action-panel__eyebrow">위험도</p>
            <div
              className="today-action-panel__risk-bar"
              role="meter"
              aria-valuenow={model.riskGauge ?? 0}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`시장 위험도 ${model.riskGauge ?? "—"}`}
            >
              {Array.from({ length: 6 }, (_, i) => (
                <span
                  key={i}
                  className={[
                    "today-action-panel__risk-seg",
                    i < model.riskBlocks ? `today-action-panel__risk-seg--on today-action-panel__risk-seg--${model.zoneTone}` : "",
                  ].join(" ")}
                  aria-hidden
                />
              ))}
            </div>
            <p className="m-0 today-action-panel__risk-value font-mono tabular-nums">
              {model.riskGauge ?? "—"}
            </p>
          </div>
        </div>

        <div className="today-action-panel__today">
          <p className="m-0 today-action-panel__eyebrow">오늘 행동</p>
          <ul className="m-0 today-action-panel__today-lines">
            {model.todayLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {model.badges.length > 0 ? (
            <div className="today-action-panel__badges">
              {model.badges.map((badge) => (
                <span key={badge} className="today-action-panel__badge">
                  {badge}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="today-action-panel__tactical">
          <p className="m-0 today-action-panel__eyebrow today-action-panel__eyebrow--tactical">전술</p>
          <div className="today-action-panel__cards">
            {model.tacticalCards.map((card) => {
              const isSelected = selected?.id === card.id
              return (
                <button
                  key={card.id}
                  type="button"
                  className={[
                    "today-action-panel__card",
                    isSelected ? "today-action-panel__card--active" : "",
                  ].join(" ")}
                  onClick={() => setSelectedId(card.id)}
                  aria-pressed={isSelected}
                >
                  <span className="today-action-panel__card-period">{card.period}</span>
                  <span className="today-action-panel__card-action">{card.action}</span>
                  <span className="today-action-panel__card-score font-mono tabular-nums">
                    {card.score != null ? card.score : "—"}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <footer className="today-action-panel__footer">
        <button
          type="button"
          className="today-action-panel__evidence-toggle"
          onClick={() => setEvidenceOpen((v) => !v)}
          aria-expanded={evidenceOpen}
        >
          <span>근거 보기</span>
          <span className="today-action-panel__evidence-icon" aria-hidden>
            {evidenceOpen ? "−" : "+"}
          </span>
        </button>
        {evidenceOpen ? <ActionEvidenceSection layer={model.explainLayer} /> : null}
      </footer>
    </section>
  )
}
