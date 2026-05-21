import { useMemo, useState } from "react"
import { computeMarketAction, pickMetricValue } from "../utils/panicMarketActionEngine.js"
import PanicMarketReportPanel from "./PanicMarketReportPanel.jsx"
import PanicMetricInsightPanel from "./PanicMetricInsightPanel.jsx"
import SectionErrorBoundary from "./SectionErrorBoundary.jsx"

/**
 * @param {object | null} panicData
 * @param {import("../utils/panicMarketActionEngine.js").MarketActionGuide} guide
 */
function buildRiskLine(panicData, guide) {
  const pc = pickMetricValue(panicData, "putCall")
  const vix = pickMetricValue(panicData, "vix")
  if (pc != null && pc <= 0.55) return "옵션 과열"
  if (pc != null && pc >= 0.85) return "헤지 수요"
  if (vix != null && vix >= 25) return "변동성 확대"
  if (guide.regime === "extreme_greed" || guide.regime === "greed") return "과열 · 익절 검토"
  if (guide.regime === "extreme_fear" || guide.regime === "fear") return "낮음 · 방어"
  return guide.strategyThesis || "중립"
}

/**
 * @param {import("../utils/panicMarketActionEngine.js").MarketActionGuide} guide
 */
function formatRiskMode(guide) {
  if (guide.actionMode === "Risk-on") return "Risk ON"
  if (guide.actionMode === "Risk-off") return "Risk OFF"
  return "Neutral"
}

/**
 * @param {{
 *   panicData?: object | null;
 *   metricKey?: string;
 *   currentValue?: unknown;
 *   historyRows?: object[];
 *   deskMarketReport?: object | null;
 *   deskMarketReportLoading?: boolean;
 *   strategyBrief?: string;
 * }} props
 */
export default function PanicTodayInterpretation({
  panicData = null,
  metricKey = "vix",
  currentValue,
  historyRows = [],
  deskMarketReport = null,
  deskMarketReportLoading = false,
  strategyBrief = "",
}) {
  const [detailOpen, setDetailOpen] = useState(false)

  const guide = useMemo(() => computeMarketAction(panicData), [panicData])

  if (!guide) {
    return (
      <div className="panic-today-brief">
        <p className="m-0 text-[10px] text-slate-500">패닉 지표 입력 후 오늘 해석이 표시됩니다.</p>
      </div>
    )
  }

  const riskVal = buildRiskLine(panicData, guide)
  const sectorVal = guide.sectors.length ? guide.sectors.join(" / ") : "분산"

  const summaryRows = [
    { label: "리스크", value: riskVal },
    { label: "섹터", value: sectorVal },
  ]

  return (
    <div className="panic-today-wrap">
      <div className="panic-today-brief" role="region" aria-label="오늘 해석 요약">
        <div className="panic-today-brief__head">
          <p className="m-0 text-[10px] font-bold tracking-wide text-slate-400">오늘 해석</p>
          <p className="m-0 font-mono text-[13px] font-bold text-cyan-300/95">{formatRiskMode(guide)}</p>
        </div>
        <div className="panic-today-brief__grid">
          {summaryRows.map((row) => (
            <div key={row.label} className="panic-today-brief__row">
              <span className="panic-today-brief__label">{row.label}</span>
              <span className="panic-today-brief__value">{row.value}</span>
            </div>
          ))}
        </div>
        <p className="m-0 mt-2 text-[9px] leading-snug text-slate-600">
          Daily Report·포트 비중 카드 우선 · 하단은 보조
        </p>
      </div>

      <button
        type="button"
        onClick={() => setDetailOpen((v) => !v)}
        className="panic-today-detail-toggle"
        aria-expanded={detailOpen}
      >
        <span>상세 해석</span>
        <span className="text-slate-500">{detailOpen ? "▲" : "▼"}</span>
      </button>

      {detailOpen ? (
        <div className="panic-today-detail space-y-0">
          <PanicMetricInsightPanel
            metricKey={metricKey}
            currentValue={currentValue}
            historyRows={historyRows}
            panicData={panicData}
            mode="metric"
          />
          {strategyBrief ? (
            <div className="ai-brief ai-brief--compact" role="note">
              <p className="ai-brief__title">전략 브리핑</p>
              <p className="ai-brief__body">
                {strategyBrief.split(" · ").filter(Boolean).map((part, i) => (
                  <span key={`brief-${i}`} className="ai-brief__item">
                    {part}
                  </span>
                ))}
              </p>
            </div>
          ) : null}
          <SectionErrorBoundary label="시장 리포트">
            <PanicMarketReportPanel
              report={deskMarketReport}
              loading={deskMarketReportLoading}
              panicData={panicData}
            />
          </SectionErrorBoundary>
        </div>
      ) : null}
    </div>
  )
}
