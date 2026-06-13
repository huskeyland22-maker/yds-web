import {
  PHASE3_SCORE_COMPONENTS,
  isPhase3ScoreDebugEnabled,
} from "../../content/ydsStockPickPhase3Breakdown.js"

/**
 * @param {{
 *   sample?: import("../../content/ydsStockPickModel.js").StockPickView | null
 * }} props
 */
export default function YdsStockPickScoreDebugPanel({ sample = null }) {
  if (!isPhase3ScoreDebugEnabled()) return null

  const breakdown = sample?.scoreBreakdown

  return (
    <details className="yds-spick-score-debug">
      <summary className="yds-spick-score-debug__summary">Phase 3 점수 Debug</summary>
      <div className="yds-spick-score-debug__body">
        <p className="yds-spick-score-debug__formula">
          종합 = 실적(30) + 산업(25) + 섹터(20) + 시장환경(15) + 기술적분석(5) + 거래량(5)
        </p>
        <dl className="yds-spick-score-debug__grid">
          {PHASE3_SCORE_COMPONENTS.map((c) => (
            <div key={c.id}>
              <dt>{c.label}</dt>
              <dd>최대 {c.max}점</dd>
            </div>
          ))}
        </dl>
        {breakdown ? (
          <>
            <p className="yds-spick-score-debug__sample-title">
              샘플: {sample?.name} ({sample?.ticker})
            </p>
            <pre className="yds-spick-score-debug__pre">
              {JSON.stringify(
                {
                  phase3: breakdown.debug,
                  technical: sample?.technicalScore,
                  legacy: sample?.scores,
                },
                null,
                2,
              )}
            </pre>
          </>
        ) : (
          <p className="yds-spick-score-debug__note">live 종목 로드 후 샘플 표시</p>
        )}
      </div>
    </details>
  )
}
