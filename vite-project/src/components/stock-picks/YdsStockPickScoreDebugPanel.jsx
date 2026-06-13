import {
  DECOMPOSED_SCORE_LABELS,
  DECOMPOSED_SCORE_WEIGHTS,
  isStockPickScoreDebugEnabled,
} from "../../content/ydsStockPickDecomposedScores.js"

/**
 * @param {{
 *   sample?: import("../../content/ydsStockPickModel.js").StockPickView | null
 * }} props
 */
export default function YdsStockPickScoreDebugPanel({ sample = null }) {
  if (!isStockPickScoreDebugEnabled()) return null

  const decomposed = sample?.decomposedScores

  return (
    <details className="yds-spick-score-debug">
      <summary className="yds-spick-score-debug__summary">점수 분해 Debug</summary>
      <div className="yds-spick-score-debug__body">
        <p className="yds-spick-score-debug__formula">
          종합점수 = 실적×20% + 기술×20% + 모멘텀×20% + 섹터×20% + 시장환경×20%
        </p>
        <dl className="yds-spick-score-debug__grid">
          {Object.entries(DECOMPOSED_SCORE_LABELS).map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>
                가중 {Math.round(DECOMPOSED_SCORE_WEIGHTS[key] * 100)}% ·{" "}
                {key === "performance" && "rating·수동 marketFit"}
                {key === "technology" && "position·trend"}
                {key === "momentum" && "trend·volume"}
                {key === "sector" && "marketFit·rating"}
                {key === "marketEnv" && "marketFit·volume·trend"}
              </dd>
            </div>
          ))}
        </dl>
        {decomposed ? (
          <>
            <p className="yds-spick-score-debug__sample-title">
              샘플: {sample?.name} ({sample?.ticker})
            </p>
            <pre className="yds-spick-score-debug__pre">
              {JSON.stringify(decomposed.debug, null, 2)}
            </pre>
          </>
        ) : (
          <p className="yds-spick-score-debug__note">live 종목 로드 후 샘플 표시</p>
        )}
      </div>
    </details>
  )
}
