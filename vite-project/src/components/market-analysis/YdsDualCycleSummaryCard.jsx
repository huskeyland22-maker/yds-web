import { useMemo } from "react"
import {
  buildDualCycleInterpretation,
  fearCycleMood,
  resolveMarketCycleStage,
} from "../../content/ydsMarketCycleDisplay.js"
import { resolveMacroV1Status } from "../../panic-v2/panicMacroV1Status.js"
import { getFinalScore } from "../../utils/tradingScores.js"

/**
 * Hero 하단 — Dual Cycle 한 줄 요약
 * @param {{ panicData?: object | null }} props
 */
export default function YdsDualCycleSummaryCard({ panicData = null }) {
  const view = useMemo(() => {
    if (!panicData) return null
    const score = getFinalScore(panicData)
    if (!Number.isFinite(score)) return null
    const fearStage = resolveMacroV1Status(Math.round(score))
    const marketStage = resolveMarketCycleStage(panicData.fearGreed, panicData.bofa)
    if (!fearStage || !marketStage) return null

    return {
      fearStage,
      marketStage,
      fearMood: fearCycleMood(fearStage.id),
      marketMood: marketStage.mood,
      interpretation: buildDualCycleInterpretation(fearStage.id, marketStage.id),
    }
  }, [panicData])

  if (!view) return null

  return (
    <section className="yds-dual-summary" aria-label="현재 시장 요약">
      <h2 className="yds-dual-summary__title">현재 시장 요약</h2>
      <div className="yds-dual-summary__grid">
        <div className="yds-dual-summary__cell">
          <p className="yds-dual-summary__axis">공포 사이클</p>
          <p
            className="yds-dual-summary__stage"
            style={{ "--summary-color": view.fearStage.color }}
          >
            {view.fearStage.emoji} {view.fearStage.label.replace("구간", "")}
          </p>
          <p className="yds-dual-summary__mood">{view.fearMood}</p>
        </div>
        <div className="yds-dual-summary__cell">
          <p className="yds-dual-summary__axis">시장 사이클</p>
          <p
            className="yds-dual-summary__stage"
            style={{ "--summary-color": view.marketStage.color }}
          >
            {view.marketStage.emoji} {view.marketStage.label}
          </p>
          <p className="yds-dual-summary__mood">{view.marketMood}</p>
        </div>
      </div>
      <p className="yds-dual-summary__interpretation">{view.interpretation}</p>
    </section>
  )
}
