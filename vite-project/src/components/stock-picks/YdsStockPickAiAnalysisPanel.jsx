/**
 * AI 종합 분석 패널 — 종합 의견 · 근거 · 점수 변화 · 시나리오 · 성과 검증
 */

import YdsStockPickTradeScenario from "./YdsStockPickTradeScenario.jsx"

/**
 * @param {{
 *   report: import("../../content/ydsStockPickAiAnalysisEngine.js").ReturnType<typeof import("../../content/ydsStockPickAiAnalysisEngine.js").buildStockPickAiAnalysisReport> | null | undefined
 *   rationaleBars?: import("../../content/ydsStockPickAiAnalysisEngine.js").ReturnType<typeof import("../../content/ydsStockPickAiAnalysisEngine.js").buildAiRationaleProgressBars>
 *   embedded?: boolean
 *   compact?: boolean
 *   showScenarios?: boolean
 *   showValidation?: boolean
 *   className?: string
 * }} props
 */
export default function YdsStockPickAiAnalysisPanel({
  report,
  rationaleBars,
  embedded = false,
  compact = false,
  showScenarios = true,
  showValidation = true,
  className = "",
}) {
  if (!report?.visible) return null

  const bars = rationaleBars?.length ? rationaleBars : report.rationaleBars ?? []
  const opinion = report.comprehensiveOpinion
  const scoreChange = report.scoreChange
  const validation = report.validation
  const scenarioReport = report.investmentScenarios

  return (
    <section
      className={[
        "yds-spick-ai-analysis",
        embedded ? "yds-spick-ai-analysis--embedded" : "",
        compact ? "yds-spick-ai-analysis--compact" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="AI 종합 분석"
    >
      {opinion?.paragraphs?.length ? (
        <div className="yds-spick-ai-analysis__block">
          <h3 className="yds-spick-ai-analysis__title">{opinion.title}</h3>
          <div className="yds-spick-ai-analysis__opinion">
            {opinion.paragraphs.map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
          </div>
        </div>
      ) : null}

      {bars.length ? (
        <div className="yds-spick-ai-analysis__block">
          <h3 className="yds-spick-ai-analysis__title">추천 근거 (알고리즘 점수)</h3>
          <div className="yds-spick-detail-panel__scores yds-spick-ai-analysis__bars">
            {bars.map((bar) => (
              <div key={bar.id} className="yds-spick-detail-panel__score-row">
                <div className="yds-spick-detail-panel__score-head">
                  <span className="yds-spick-detail-panel__score-label">{bar.label}</span>
                  <span className="yds-spick-detail-panel__score-val font-mono tabular-nums">
                    {bar.score}
                  </span>
                </div>
                <div className="yds-spick-detail-panel__bar-track">
                  <span
                    className={[
                      "yds-spick-detail-panel__bar-fill",
                      bar.invertTone ? "yds-spick-detail-panel__bar-fill--risk" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{ width: `${bar.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {scoreChange?.visible ? (
        <div className="yds-spick-ai-analysis__block">
          <h3 className="yds-spick-ai-analysis__title">AI 점수 변화</h3>
          {scoreChange.previousScore != null && scoreChange.currentScore != null ? (
            <p className="yds-spick-ai-analysis__score-delta font-mono tabular-nums">
              <span className="yds-spick-ai-analysis__score-prev">{scoreChange.previousScore}점</span>
              <span
                className={[
                  "yds-spick-ai-analysis__score-arrow",
                  scoreChange.direction === "up"
                    ? "yds-spick-ai-analysis__score-arrow--up"
                    : scoreChange.direction === "down"
                      ? "yds-spick-ai-analysis__score-arrow--down"
                      : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-hidden
              >
                ↓
              </span>
              <span className="yds-spick-ai-analysis__score-curr">{scoreChange.currentScore}점</span>
              {scoreChange.deltaLabel ? (
                <span
                  className={[
                    "yds-spick-ai-analysis__score-chg",
                    scoreChange.direction === "up"
                      ? "yds-spick-ai-analysis__score-chg--up"
                      : scoreChange.direction === "down"
                        ? "yds-spick-ai-analysis__score-chg--down"
                        : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  ({scoreChange.deltaLabel})
                </span>
              ) : null}
            </p>
          ) : scoreChange.currentScore != null ? (
            <p className="yds-spick-ai-analysis__score-delta font-mono tabular-nums">
              현재 {scoreChange.currentScore}점
            </p>
          ) : null}
          {scoreChange.reasons?.length ? (
            <ul className="yds-spick-ai-analysis__reasons">
              {scoreChange.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {showScenarios && scenarioReport?.visible ? (
        <YdsStockPickTradeScenario report={scenarioReport} embedded enhanced />
      ) : null}

      {showValidation && validation?.visible ? (
        <div className="yds-spick-ai-analysis__block">
          <h3 className="yds-spick-ai-analysis__title">{validation.title}</h3>
          <dl className="yds-spick-ai-analysis__validation">
            <div>
              <dt>추천일</dt>
              <dd className="font-mono tabular-nums">{validation.recommendedAt}</dd>
            </div>
            <div>
              <dt>추천가</dt>
              <dd className="font-mono tabular-nums">{validation.recommendedPrice}</dd>
            </div>
            <div>
              <dt>현재가</dt>
              <dd className="font-mono tabular-nums">{validation.currentPrice}</dd>
            </div>
            <div>
              <dt>현재 수익률</dt>
              <dd className="font-mono tabular-nums">{validation.returnLabel}</dd>
            </div>
            <div>
              <dt>최고 수익률</dt>
              <dd className="font-mono tabular-nums">{validation.maxReturnLabel}</dd>
            </div>
            <div>
              <dt>최대 손실</dt>
              <dd className="font-mono tabular-nums">{validation.maxLossLabel}</dd>
            </div>
            <div>
              <dt>추천 유지일</dt>
              <dd>{validation.daysHeld}</dd>
            </div>
            <div>
              <dt>현재 추천상태</dt>
              <dd>{validation.currentStatus ?? "—"}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </section>
  )
}
