import { useMemo } from "react"
import {
  buildDualCycleInterpretation,
  fearCycleMood,
  resolveMarketCycleStage,
} from "../../content/ydsMarketCycleDisplay.js"
import { resolveMomentumLayer } from "../../content/ydsMomentumLayer.js"
import { resolveMacroV1Status } from "../../panic-v2/panicMacroV1Status.js"
import { getFinalScore } from "../../utils/tradingScores.js"
import YdsMomentumLayerCard from "./YdsMomentumLayerCard.jsx"

/**
 * Hero 하단 — 장기(절대값) + 단기(Momentum) 요약
 * @param {{ panicData?: object | null; historyRows?: object[] }} props
 */
export default function YdsDualCycleSummaryCard({ panicData = null, historyRows = [] }) {
  const view = useMemo(() => {
    if (!panicData) return null
    const score = getFinalScore(panicData)
    if (!Number.isFinite(score)) return null
    const fearStage = resolveMacroV1Status(Math.round(score))
    const marketStage = resolveMarketCycleStage(panicData.fearGreed, panicData.bofa)
    if (!fearStage || !marketStage) return null

    const momentum = resolveMomentumLayer(panicData, historyRows, {
      fearStageLabel: fearStage.label,
    })

    return {
      fearStage,
      marketStage,
      fearMood: fearCycleMood(fearStage.id),
      marketMood: marketStage.mood,
      momentum,
      interpretation: buildDualCycleInterpretation(fearStage.id, marketStage.id),
    }
  }, [panicData, historyRows])

  if (!view) return null

  const longTermLine = `${view.fearStage.emoji} ${view.fearStage.label}`

  return (
    <section className="yds-dual-summary" aria-label="현재 시장 요약">
      <h2 className="yds-dual-summary__title">현재 시장 요약</h2>

      <div className="yds-dual-summary__long-short">
        <div className="yds-dual-summary__long-short-row">
          <span className="yds-dual-summary__long-short-label">장기 상태</span>
          <span
            className="yds-dual-summary__long-short-value"
            style={{ "--summary-color": view.fearStage.color }}
          >
            {longTermLine}
          </span>
        </div>
        <div className="yds-dual-summary__long-short-row">
          <span className="yds-dual-summary__long-short-label">단기 상태</span>
          <span
            className={[
              "yds-dual-summary__long-short-value",
              view.momentum.level !== "none" ? "yds-dual-summary__long-short-value--warn" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {view.momentum.level === "none" ? "🟢 단기 안정" : `${view.momentum.emoji} ${view.momentum.shortLabel}`}
          </span>
        </div>
      </div>

      <div className="yds-dual-summary__grid">
        <div className="yds-dual-summary__cell">
          <p className="yds-dual-summary__axis">공포 사이클 · 장기</p>
          <p
            className="yds-dual-summary__stage"
            style={{ "--summary-color": view.fearStage.color }}
          >
            {view.fearStage.emoji} {view.fearStage.label.replace("구간", "")}
          </p>
          <p className="yds-dual-summary__mood">{view.fearMood}</p>
        </div>
        <div className="yds-dual-summary__cell">
          <p className="yds-dual-summary__axis">시장 사이클 · 장기</p>
          <p
            className="yds-dual-summary__stage"
            style={{ "--summary-color": view.marketStage.color }}
          >
            {view.marketStage.emoji} {view.marketStage.label}
          </p>
          <p className="yds-dual-summary__mood">{view.marketMood}</p>
        </div>
      </div>

      {view.momentum.level !== "none" ? (
        <YdsMomentumLayerCard
          panicData={panicData}
          historyRows={historyRows}
          fearStageLabel={view.fearStage.label}
          compact
        />
      ) : null}

      {view.momentum.level === "none" ? (
        <p className="yds-dual-summary__interpretation">{view.interpretation}</p>
      ) : null}
    </section>
  )
}
