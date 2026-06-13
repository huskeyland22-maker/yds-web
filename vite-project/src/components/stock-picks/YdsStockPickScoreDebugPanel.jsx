import { isPhase3ScoreDebugEnabled } from "../../content/ydsStockPickPhase3Breakdown.js"
import { PHASE3_SCORE_COMPONENTS } from "../../content/ydsStockPickPhase3Breakdown.js"

/**
 * @param {{
 *   sample?: import("../../content/ydsStockPickModel.js").StockPickView | null
 * }} props
 */
export default function YdsStockPickScoreDebugPanel({ sample = null }) {
  if (!isPhase3ScoreDebugEnabled()) return null

  const breakdown = sample?.scoreBreakdown
  const v4 = sample?.v4Score

  return (
    <details className="yds-spick-score-debug">
      <summary className="yds-spick-score-debug__summary">V4 점수 Debug</summary>
      <div className="yds-spick-score-debug__body">
        <p className="yds-spick-score-debug__formula">
          TOP5 = quality×70% + timing×30% (−10 if timing≤10) · timing≤5 제외
        </p>
        <dl className="yds-spick-score-debug__grid">
          {PHASE3_SCORE_COMPONENTS.slice(0, 3).map((c) => (
            <div key={c.id}>
              <dt>품질·{c.label}</dt>
              <dd>최대 {c.max}점</dd>
            </div>
          ))}
        </dl>
        {breakdown && v4 ? (
          <>
            <p className="yds-spick-score-debug__sample-title">
              샘플: {sample?.name} ({sample?.ticker})
            </p>
            <pre className="yds-spick-score-debug__pre">
              {JSON.stringify(
                {
                  v4,
                  phase3: breakdown.debug,
                  timing: sample?.timingScore?.debug,
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
