import { useMemo } from "react"
import { Link } from "react-router-dom"
import { useYdsMarketContext } from "../../hooks/useYdsMarketContext.js"
import { buildStockPickDetailPanelReport } from "../../content/ydsStockPickDetailPanelEngine.js"
import { buildStockPickRecommendHistoryReport } from "../../content/ydsStockPickRecommendHistory.js"
import { buildStockPickTradeScenarioReport } from "../../content/ydsStockPickTradeScenario.js"
import YdsStockPickRecommendHistory from "./YdsStockPickRecommendHistory.jsx"
import YdsStockPickTradeScenario from "./YdsStockPickTradeScenario.jsx"
import YdsStockPickTrustExtras from "./YdsStockPickTrustExtras.jsx"
import YdsStockPickAiAnalysisPanel from "./YdsStockPickAiAnalysisPanel.jsx"

/**
 * @param {{
 *   stock: import("../../content/ydsStockPickModel.js").StockPickView
 *   dualLiquidity?: import("../../market-os/liquidityDualEngine.js").DualLiquidityReport | null
 *   className?: string
 * }} props
 */
export default function YdsStockPickDetailPanel({ stock, dualLiquidity = null, className = "" }) {
  const marketContext = useYdsMarketContext()
  const report = useMemo(
    () => buildStockPickDetailPanelReport(stock, marketContext?.ready ? marketContext : null),
    [stock, marketContext],
  )
  const history = useMemo(() => buildStockPickRecommendHistoryReport(stock), [stock])
  const scenario = useMemo(() => {
    if (stock.aiAnalysisReport?.investmentScenarios?.visible) {
      return stock.aiAnalysisReport.investmentScenarios
    }
    return buildStockPickTradeScenarioReport(
      stock,
      marketContext?.ready ? marketContext : null,
      dualLiquidity,
    )
  }, [stock, marketContext, dualLiquidity])

  if (!report.visible) return null

  const trust = stock.trustReport
  const scoreBars = trust?.scoreBars?.length ? trust.scoreBars : report.scoreBars
  const topReasons = trust?.topReasons?.map((r) => r.text) ?? report.reasons

  const to = `/stock-picks/${encodeURIComponent(stock.ticker)}`

  return (
    <div
      className={["yds-spick-detail-panel", className].filter(Boolean).join(" ")}
      aria-label={`${stock.name} AI 상세 분석`}
    >
      <YdsStockPickAiAnalysisPanel
        report={stock.aiAnalysisReport}
        embedded
        compact
        showScenarios={false}
        showValidation={false}
        className="yds-spick-detail-panel__ai"
      />

      <YdsStockPickTrustExtras trustReport={trust} embedded className="yds-spick-detail-panel__trust" />

      <div className="yds-spick-detail-panel__scores">
        {scoreBars.map((bar) => (
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

      <div className="yds-spick-detail-panel__section">
        <p className="yds-spick-detail-panel__section-title">AI 한줄 의견</p>
        <p className="yds-spick-detail-panel__opinion">{report.aiOpinion}</p>
      </div>

      {topReasons.length ? (
        <div className="yds-spick-detail-panel__section">
          <p className="yds-spick-detail-panel__section-title">추천 이유</p>
          <ul className="yds-spick-detail-panel__reasons">
            {topReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          {trust?.detailReasons?.length ? (
            <details className="yds-spick-detail-panel__reason-details">
              <summary>상세 데이터</summary>
              <ul className="yds-spick-detail-panel__reasons">
                {trust.detailReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}

      <dl className="yds-spick-detail-panel__levels">
        <div>
          <dt>매수 적정구간</dt>
          <dd className="font-mono tabular-nums">{report.priceLevels.buyZone}</dd>
        </div>
        <div>
          <dt>손절 기준</dt>
          <dd className="font-mono tabular-nums">{report.priceLevels.stopLoss}</dd>
        </div>
        <div>
          <dt>1차 목표가</dt>
          <dd className="font-mono tabular-nums">{report.priceLevels.target1}</dd>
        </div>
        <div>
          <dt>2차 목표가</dt>
          <dd className="font-mono tabular-nums">{report.priceLevels.target2}</dd>
        </div>
      </dl>

      <dl className="yds-spick-detail-panel__meta">
        <div>
          <dt>추천 시작일</dt>
          <dd className="font-mono tabular-nums">{report.meta.recommendedAt}</dd>
        </div>
        <div>
          <dt>추천 유지일수</dt>
          <dd>{report.meta.daysHeld}</dd>
        </div>
        <div>
          <dt>현재 추천상태</dt>
          <dd>{report.meta.statusLabel}</dd>
        </div>
        <div>
          <dt>최근 점수 변화</dt>
          <dd className="font-mono tabular-nums">{report.meta.scoreChange}</dd>
        </div>
      </dl>

      <YdsStockPickRecommendHistory report={history} embedded />
      <YdsStockPickTradeScenario report={scenario} embedded enhanced={Boolean(stock.aiAnalysisReport?.visible)} />

      <Link to={to} className="yds-spick-detail-panel__more">
        종목 상세 페이지 →
      </Link>
    </div>
  )
}
