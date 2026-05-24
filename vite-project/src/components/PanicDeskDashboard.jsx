import { useMemo } from "react"
import { getFinalScore } from "../utils/tradingScores.js"
import { EXPERT_METRICS } from "../utils/panicDeskMetrics.js"
import { formatMetricValue } from "./macroCycleChartUtils.js"
import CycleBondLiquiditySection from "./cycle/CycleBondLiquiditySection.jsx"
import CycleDataBasisBar from "./cycle/CycleDataBasisBar.jsx"
import DailyMarketReportPanel from "./DailyMarketReportPanel.jsx"
import RecommendationEnginePanel from "./RecommendationEnginePanel.jsx"
import { isMacroRiskEnabled } from "../macro-risk/featureFlag.js"
import { useMacroRiskSnapshot } from "../macro-risk/useMacroRiskSnapshot.js"
import PanicCoreMetricsBlock from "./panic-metrics/PanicCoreMetricsBlock.jsx"
import PanicMetricRow from "./panic-metrics/PanicMetricRow.jsx"
import PanicExpertMetricsAccordion from "./PanicExpertMetricsAccordion.jsx"
import PanicIndexHistorySection from "./PanicIndexHistorySection.jsx"
import SectionErrorBoundary from "./SectionErrorBoundary.jsx"

function fmt(key, v) {
  if (v == null || !Number.isFinite(Number(v))) return "—"
  return formatMetricValue(key, Number(v))
}

/** @param {{ title: string; variant?: "core" | "expert" }} props */
function SectionLabel({ title, variant = "core" }) {
  const isExpert = variant === "expert"
  return (
    <div
      className={[
        "panic-metric-section-label",
        isExpert ? "panic-metric-section-label--expert" : "",
      ].join(" ")}
    >
      <p
        className={[
          "m-0 border-l-2 pl-2 text-left text-[11px] font-bold tracking-[0.02em]",
          isExpert ? "border-slate-500/50 text-slate-300" : "border-cyan-400/50 text-slate-200",
        ].join(" ")}
      >
        {title}
      </p>
      <span
        className={["mt-1.5 block h-px w-full", isExpert ? "bg-white/[0.03]" : "bg-white/[0.08]"].join(" ")}
      />
    </div>
  )
}

/**
 * @param {{
 *   panicData: object | null
 *   cycleMetricHistory: object[]
 *   isStale?: boolean
 *   asOfDateLabel?: string
 * }} props
 */
export default function PanicDeskDashboard({
  panicData,
  cycleMetricHistory,
  isStale: _isStale = false,
  asOfDateLabel = "—",
}) {
  const safeHistory = Array.isArray(cycleMetricHistory) ? cycleMetricHistory : []

  const finalScore = useMemo(() => (panicData ? getFinalScore(panicData) : null), [panicData])

  const cycleDataSource = useMemo(() => {
    if (panicData?.__fromHub) return "Panic Hub"
    if (panicData?.__fromHistory) return "히스토리"
    if (panicData?.__fromReport) return "리포트"
    return "수동 입력"
  }, [panicData])

  const macroRiskEnabled = isMacroRiskEnabled()
  const bondSnapshot = useMacroRiskSnapshot(macroRiskEnabled ? panicData : null)

  if (!panicData && safeHistory.length === 0) {
    return (
      <div className="panic-v2-desk relative px-3 py-8 text-center" role="status">
        <p className="m-0 text-sm font-medium text-slate-300">시장 데이터 없음</p>
        <p className="m-0 mt-1.5 text-xs leading-relaxed text-slate-500">
          서버 연결을 복구 중입니다. 새로고침하거나 상단 입력으로 지표를 저장해 주세요.
        </p>
        <p className="m-0 mt-2 text-[10px] text-amber-400/90">연결 복구 후 자동 갱신됩니다</p>
      </div>
    )
  }

  return (
    <div className="panic-v2-desk panic-v2-desk--terminal relative">
      <div className="sticky top-0 z-20 -mx-0.5 border-b border-white/[0.04] bg-[#0B0E14]/90 px-1 py-1 backdrop-blur-sm">
        <CycleDataBasisBar updatedAt={panicData?.updatedAt} cycleSource={cycleDataSource} bondSource="FRED" />
      </div>

      <div className="panic-v2-desk__metrics-slot">
        <SectionLabel title="핵심지수" variant="core" />
        <PanicCoreMetricsBlock panicData={panicData} historyRows={safeHistory} />

        <PanicExpertMetricsAccordion>
          <div className="panic-metric-rows-grid panic-metric-rows-grid--expert panic-metric-rows-grid--expert-5">
            {EXPERT_METRICS.map((metric) => (
              <PanicMetricRow
                key={metric.key}
                label={metric.label}
                value={fmt(metric.key, panicData?.[metric.key])}
                accent={metric.accent}
                variant="expert"
              />
            ))}
          </div>
        </PanicExpertMetricsAccordion>
      </div>

      <div className="panic-v2-desk__status-slot">
        <DailyMarketReportPanel
          panicData={panicData}
          cycleScore={finalScore}
          snapshot={bondSnapshot.snapshot}
          loading={macroRiskEnabled && bondSnapshot.loading}
        />
      </div>

      <div className="panic-v2-desk__recommend-slot">
        <RecommendationEnginePanel
          panicData={panicData}
          cycleScore={finalScore}
          snapshot={bondSnapshot.snapshot}
          historyRows={safeHistory}
        />
      </div>

      <div className="panic-v2-desk__history-slot">
        <SectionErrorBoundary
          label="패닉 히스토리"
          fallback={
            <div className="trading-card-shell mt-6 px-3 py-4 text-center text-sm text-slate-400">
              패닉 데이터 로딩 실패
            </div>
          }
        >
          <PanicIndexHistorySection rows={safeHistory} />
        </SectionErrorBoundary>
      </div>

      <hr className="cycle-desk-divider cycle-desk-divider--reference" aria-hidden />

      <div className="panic-v2-desk__bond-slot">
        <CycleBondLiquiditySection
          panicData={panicData}
          snapshot={bondSnapshot.snapshot}
          loading={bondSnapshot.loading}
        />
      </div>
    </div>
  )
}
