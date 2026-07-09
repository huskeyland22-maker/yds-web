import { useMemo } from "react"
import { useYdsMarketContext } from "../../hooks/useYdsMarketContext.js"
import { buildStockPickListRow } from "../../content/ydsStockPickListView.js"
import { buildStockPickAiAnalysisReport } from "../../content/ydsStockPickAiAnalysisEngine.js"
import { buildStockPickDetailPanelReport } from "../../content/ydsStockPickDetailPanelEngine.js"
import { buildStockPickRecommendHistoryReport } from "../../content/ydsStockPickRecommendHistory.js"
import YdsStockPickAiDetailCard, { AiDetailMetricGrid } from "./YdsStockPickAiDetailCard.jsx"
import YdsStockPickRecommendRationale from "./YdsStockPickRecommendRationale.jsx"
import YdsStockPickActionGuide from "./YdsStockPickActionGuide.jsx"
import YdsStockPickTradeScenario from "./YdsStockPickTradeScenario.jsx"
import YdsStockPickScoreDetailPanel from "./YdsStockPickScoreDetailPanel.jsx"

/** @param {string | null | undefined} grade */
function gradeBadge(grade) {
  if (!grade || grade === "—") return "—"
  return String(grade).split(/[·\s]/)[0]?.trim() || grade
}

/** @param {string | null | undefined} tone */
function returnToneClass(tone) {
  if (tone === "up") return "pos"
  if (tone === "down") return "risk"
  if (tone === "pending") return "muted"
  return "muted"
}

/**
 * @param {{ stock: import("../../content/ydsStockPickModel.js").StockPickView }} props
 */
export default function YdsStockPickAiDetailLayout({ stock }) {
  const marketContext = useYdsMarketContext()
  const row = useMemo(() => buildStockPickListRow(stock), [stock])
  const aiReport = useMemo(
    () => buildStockPickAiAnalysisReport(stock, marketContext?.ready ? marketContext : null),
    [stock, marketContext],
  )
  const panelReport = useMemo(
    () => buildStockPickDetailPanelReport(stock, marketContext?.ready ? marketContext : null),
    [stock, marketContext],
  )
  const historyReport = useMemo(() => buildStockPickRecommendHistoryReport(stock), [stock])

  const trust = stock.trustReport
  const scenarioReport = aiReport.investmentScenarios
  const scoreChange = aiReport.scoreChange

  const oneLineConclusion =
    stock.opinion?.summary ??
    stock.opinion?.headline ??
    aiReport.comprehensiveOpinion?.paragraphs?.[0] ??
    panelReport.aiOpinion ??
    "—"

  const targetPrice =
    trust?.tradeStrategy?.targetPrice ??
    panelReport.priceLevels?.target1 ??
    "—"
  const stopLoss =
    trust?.tradeStrategy?.stopLoss ?? panelReport.priceLevels?.stopLoss ?? "—"
  const holdPeriod = row.holdPeriodLabel ?? "—"

  const summaryMetrics = [
    { label: "현재가", value: row.currentPriceLabel, emphasize: true },
    { label: "추천가", value: row.recommendedPriceLabel, emphasize: true },
    {
      label: "추천후 수익",
      value: row.returnLabel,
      emphasize: true,
      tone: returnToneClass(row.returnTone),
    },
    { label: "AI점수", value: String(row.aiScore), emphasize: true, tone: "info" },
    { label: "추천등급", value: gradeBadge(row.recommendGrade), tone: "rec" },
    {
      label: "신뢰도",
      value: row.confidenceTier?.label ?? "—",
      tone: "info",
    },
    {
      label: "D+기간",
      value: row.daysSinceRecommend != null ? `D+${row.daysSinceRecommend}` : "—",
      emphasize: true,
    },
  ]

  const historyDisplay = historyReport.display

  const validationMetrics = [
    { label: "추천일", value: historyDisplay?.recommendedAt ?? "—" },
    { label: "추천가", value: historyDisplay?.recommendedPrice ?? "—", emphasize: true },
    { label: "현재가", value: historyDisplay?.currentPrice ?? "—", emphasize: true },
    { label: "최고수익", value: historyDisplay?.highestProfit ?? "—", tone: "pos" },
    { label: "최대손실", value: historyDisplay?.lowestProfit ?? "—", tone: "risk" },
    {
      label: "현재수익",
      value: historyDisplay?.currentProfit ?? "—",
      emphasize: true,
      tone: returnToneClass(row.returnTone),
    },
  ]

  const priceTargets = [
    { label: "목표가", value: targetPrice, emphasize: true, tone: "pos" },
    { label: "손절가", value: stopLoss, emphasize: true, tone: "risk" },
    { label: "예상보유기간", value: holdPeriod, tone: "rec" },
  ]

  return (
    <div className="yds-ai-detail-page" aria-label={`${stock.name} AI 상세 분석`}>
      <YdsStockPickAiDetailCard title="① 종목 요약" tone="info">
        <AiDetailMetricGrid items={summaryMetrics} />
      </YdsStockPickAiDetailCard>

      <YdsStockPickAiDetailCard title="② AI 최종 판단" tone="rec">
        <p className="yds-ai-detail-card__conclusion">{oneLineConclusion}</p>
        <YdsStockPickRecommendRationale
          topReasons={trust?.topReasons}
          items={stock.recommendRationales}
          title="추천 이유"
          maxItems={3}
          className="yds-ai-detail-card__rationale"
        />
        <YdsStockPickActionGuide
          guide={stock.actionGuide}
          className="yds-ai-detail-card__action-guide"
        />
      </YdsStockPickAiDetailCard>

      <YdsStockPickAiDetailCard title="③ 목표가 / 손절가 / 예상보유기간">
        <AiDetailMetricGrid items={priceTargets} />
      </YdsStockPickAiDetailCard>

      <YdsStockPickAiDetailCard title="④ 추천 성과 검증">
        <AiDetailMetricGrid items={validationMetrics} />
      </YdsStockPickAiDetailCard>

      {scenarioReport?.visible ? (
        <YdsStockPickAiDetailCard title="⑤ AI 시나리오" className="yds-ai-detail-card--scenario-wrap">
          <YdsStockPickTradeScenario
            report={{ ...scenarioReport, title: "AI 시나리오" }}
            embedded
            enhanced
            className="yds-ai-detail-card__scenario"
          />
        </YdsStockPickAiDetailCard>
      ) : null}

      {trust?.aiRisk?.items?.length ? (
        <YdsStockPickAiDetailCard title="⑥ AI Risk" tone="risk">
          <ul className="yds-ai-detail-card__risk-list">
            {trust.aiRisk.items.map((item) => (
              <li key={item.id} className="yds-ai-detail-card__risk-item">
                <span>{item.text}</span>
                <span
                  className={[
                    "yds-ai-detail-card__risk-level",
                    `yds-ai-detail-card__risk-level--${item.level}`,
                  ].join(" ")}
                >
                  {item.level}
                </span>
              </li>
            ))}
          </ul>
        </YdsStockPickAiDetailCard>
      ) : null}

      {trust?.aiTracking?.phaseLabel ? (
        <YdsStockPickAiDetailCard title="⑦ AI 추적" tone="info">
          <p className="yds-ai-detail-card__tracking-phase">{trust.aiTracking.phaseLabel}</p>
          {scoreChange?.visible ? (
            <p className="yds-ai-detail-card__score-delta font-mono tabular-nums">
              {scoreChange.previousScore != null && scoreChange.currentScore != null ? (
                <>
                  AI 점수 {scoreChange.previousScore} → {scoreChange.currentScore}
                  {scoreChange.deltaLabel ? (
                    <span
                      className={`yds-ai-detail-card__tone--${
                        scoreChange.direction === "up"
                          ? "pos"
                          : scoreChange.direction === "down"
                            ? "risk"
                            : "muted"
                      }`}
                    >
                      {" "}
                      ({scoreChange.deltaLabel})
                    </span>
                  ) : null}
                </>
              ) : scoreChange.currentScore != null ? (
                <>현재 AI 점수 {scoreChange.currentScore}</>
              ) : null}
            </p>
          ) : null}
          {trust.aiTracking.milestones?.length ? (
            <ul className="yds-ai-detail-card__milestones">
              {trust.aiTracking.milestones.map((m) => (
                <li
                  key={m.pct}
                  className={[
                    "yds-ai-detail-card__milestone",
                    m.reached ? "yds-ai-detail-card__milestone--done" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {m.label}
                </li>
              ))}
            </ul>
          ) : null}
        </YdsStockPickAiDetailCard>
      ) : null}

      {trust?.tradeStrategy?.visible ? (
        <YdsStockPickAiDetailCard title="⑧ AI 매매 전략" tone="rec">
          <AiDetailMetricGrid
            items={[
              { label: "1차 진입", value: trust.tradeStrategy.entry1 },
              { label: "2차 진입", value: trust.tradeStrategy.entry2 },
              { label: "추가매수", value: trust.tradeStrategy.addBuy },
              { label: "익절", value: trust.tradeStrategy.takeProfit, tone: "pos" },
              { label: "손절", value: trust.tradeStrategy.stopLoss, tone: "risk" },
              {
                label: "비중",
                value: `${trust.tradeStrategy.weightPct}%`,
                emphasize: true,
              },
            ]}
          />
        </YdsStockPickAiDetailCard>
      ) : null}

      <details className="yds-ai-detail-card yds-ai-detail-card--expand">
        <summary className="yds-ai-detail-card__expand-summary">점수 상세 · 알고리즘 근거</summary>
        <div className="yds-ai-detail-card__body yds-ai-detail-card__body--expand">
          {aiReport.rationaleBars?.length ? (
            <div className="yds-ai-detail-card__bars">
              <p className="yds-ai-detail-card__subhead">추천 근거 (알고리즘 점수)</p>
              {aiReport.rationaleBars.map((bar) => (
                <div key={bar.id} className="yds-ai-detail-card__bar-row">
                  <div className="yds-ai-detail-card__bar-head">
                    <span>{bar.label}</span>
                    <span className="font-mono tabular-nums yds-ai-detail-card__value--bold">
                      {bar.score}
                    </span>
                  </div>
                  <div className="yds-ai-detail-card__bar-track">
                    <span
                      className={[
                        "yds-ai-detail-card__bar-fill",
                        bar.invertTone ? "yds-ai-detail-card__bar-fill--risk" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={{ width: `${bar.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <YdsStockPickScoreDetailPanel stock={stock} />
        </div>
      </details>
    </div>
  )
}
