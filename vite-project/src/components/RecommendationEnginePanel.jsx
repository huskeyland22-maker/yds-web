import ScoreExplainLayer from "./ScoreExplainLayer.jsx"

/**
 * 추천 단계 — ScoreExplainLayer(단기·중기·장기 + XAI 토글)가 메인 전략 UI.
 * @param {{
 *   panicData?: object | null
 *   cycleScore?: number | null
 *   snapshot?: import("../macro-risk/engine.js").MacroRiskSnapshot | null
 *   historyRows?: object[]
 * }} props
 */
export default function RecommendationEnginePanel({
  panicData = null,
  cycleScore = null,
  snapshot = null,
  historyRows = [],
}) {
  const hasInputs = Number.isFinite(Number(cycleScore)) || panicData != null

  if (!hasInputs) {
    return (
      <section className="recommend-engine recommend-engine--primary" aria-label="추천 단계">
        <p className="m-0 recommend-engine__placeholder">Cycle·패닉 입력 후 추천 생성</p>
      </section>
    )
  }

  return (
    <section className="recommend-engine recommend-engine--primary" aria-label="추천 단계">
      <header className="recommend-engine__head recommend-engine__head--solo">
        <p className="m-0 daily-report-v2__block-title text-amber-200/90">추천 단계</p>
      </header>

      <ScoreExplainLayer
        panicData={panicData}
        snapshot={snapshot}
        historyRows={historyRows}
        cycleScore={cycleScore}
      />
    </section>
  )
}
