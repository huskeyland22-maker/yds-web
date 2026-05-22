import { useMemo, useState } from "react"
import { getFinalScore } from "../utils/tradingScores.js"
import { CORE_METRICS, EXPERT_METRICS, findChartMetric } from "../utils/panicDeskMetrics.js"
import { formatMetricValue, metricValueDisplayStyle } from "./macroCycleChartUtils.js"
import CycleBondLiquiditySection from "./cycle/CycleBondLiquiditySection.jsx"
import CycleDataBasisBar from "./cycle/CycleDataBasisBar.jsx"
import DailyMarketReportPanel from "./DailyMarketReportPanel.jsx"
import RecommendationEnginePanel from "./RecommendationEnginePanel.jsx"
import { isMacroRiskEnabled } from "../macro-risk/featureFlag.js"
import { useMacroRiskSnapshot } from "../macro-risk/useMacroRiskSnapshot.js"
import PanicIndexHistorySection from "./PanicIndexHistorySection.jsx"
import SectionErrorBoundary from "./SectionErrorBoundary.jsx"

const CORE_CELL =
  "flex min-h-[4rem] flex-col items-center justify-center bg-[#070a10] px-1 py-2.5 transition-colors sm:min-h-[4.25rem] sm:py-3"

const CORE_LABEL =
  "max-w-full px-0.5 text-center text-[14px] font-semibold leading-snug tracking-[0.04em] text-slate-100 [text-wrap:balance]"

const CORE_VALUE =
  "mt-1 font-mono text-[1rem] font-bold leading-none tabular-nums sm:text-[1.1rem]"

const EXPERT_CELL =
  "flex min-h-[2.65rem] flex-col items-center justify-center bg-[#070a10]/70 px-0.5 py-1 transition-colors sm:min-h-[2.85rem] sm:py-1.5"

const EXPERT_LABEL =
  "max-w-full px-0.5 text-center text-[12px] font-semibold leading-tight tracking-[0.02em] text-slate-300 [text-wrap:balance]"

const EXPERT_VALUE =
  "mt-0.5 font-mono text-[0.78rem] font-medium leading-none tabular-nums text-slate-400/85 sm:text-[0.85rem]"

function fmt(key, v) {
  if (v == null || !Number.isFinite(Number(v))) return "—"
  return formatMetricValue(key, Number(v))
}

/** @param {{ title: string; variant?: "core" | "expert" }} props */
function SectionLabel({ title, variant = "core" }) {
  const isExpert = variant === "expert"
  return (
    <div className={isExpert ? "mb-1 mt-2" : "mb-1 mt-0.5"}>
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
 *   metric: import("../utils/panicDeskMetrics.js").PanicDeskMetric
 *   value: string
 *   selected: boolean
 *   onSelect: () => void
 *   variant?: "core" | "expert"
 * }} props
 */
function MetricTile({ metric, value, selected, onSelect, variant = "core" }) {
  const isExpert = variant === "expert"
  const selectedRing = isExpert ? "ring-1 ring-inset ring-white/[0.06]" : "ring-1 ring-inset ring-white/20"
  const valueStyle = isExpert
    ? { color: metric.accent, opacity: 0.82 }
    : metricValueDisplayStyle(metric.accent)
  return (
    <button
      type="button"
      title={metric.tooltip}
      aria-label={metric.tooltip ? `${metric.label}: ${metric.tooltip}` : metric.label}
      data-metric-tooltip={metric.tooltip ?? ""}
      onClick={onSelect}
      className={[
        isExpert ? EXPERT_CELL : CORE_CELL,
        selected
          ? selectedRing
          : isExpert
            ? "hover:bg-white/[0.008]"
            : "hover:bg-white/[0.05]",
      ].join(" ")}
    >
      <span className={isExpert ? EXPERT_LABEL : CORE_LABEL}>{metric.label}</span>
      <span className={isExpert ? EXPERT_VALUE : CORE_VALUE} style={valueStyle}>
        {value}
      </span>
    </button>
  )
}

/**
 * @param {{
 *   panicData: object | null
 *   cycleMetricHistory: object[]
 *   isStale?: boolean
 *   asOfDateLabel?: string
 *   marketState?: { headline?: string; stateKey?: string }
 * }} props
 */
export default function PanicDeskDashboard({
  panicData,
  cycleMetricHistory,
  isStale: _isStale = false,
  asOfDateLabel = "—",
}) {
  const safeHistory = Array.isArray(cycleMetricHistory) ? cycleMetricHistory : []

  const [chartMetric, setChartMetric] = useState("vix")

  const finalScore = useMemo(() => (panicData ? getFinalScore(panicData) : null), [panicData])

  const cycleDataSource = useMemo(() => {
    if (panicData?.__fromHub) return "Panic Hub"
    if (panicData?.__fromHistory) return "히스토리"
    if (panicData?.__fromReport) return "리포트"
    return "수동 입력"
  }, [panicData])

  const macroRiskEnabled = isMacroRiskEnabled()
  const bondSnapshot = useMacroRiskSnapshot(macroRiskEnabled ? panicData : null)

  const chartSeries = useMemo(() => {
    const m = findChartMetric(chartMetric)
    return {
      key: chartMetric,
      name: m?.chartLabel ?? m?.label ?? chartMetric,
      color: m?.accent ?? "#94a3b8",
    }
  }, [chartMetric])

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
    <div className="panic-v2-desk relative">
      <div className="sticky top-0 z-20 -mx-0.5 border-b border-white/[0.04] bg-[#0B0E14]/90 px-1 py-1 backdrop-blur-sm">
        <CycleDataBasisBar updatedAt={panicData?.updatedAt} cycleSource={cycleDataSource} bondSource="FRED" />
      </div>

      <div>
        <SectionLabel title="핵심지수" variant="core" />
        <section className="trading-card-shell overflow-hidden border border-white/[0.1] p-px shadow-[0_0_28px_rgba(0,0,0,0.45)]">
          <div className="grid grid-cols-2 gap-px bg-white/[0.07] sm:grid-cols-3 lg:grid-cols-5">
            {CORE_METRICS.map((metric) => (
              <MetricTile
                key={metric.key}
                metric={metric}
                value={fmt(metric.key, panicData?.[metric.key])}
                selected={chartMetric === metric.key}
                onSelect={() => setChartMetric(metric.key)}
                variant="core"
              />
            ))}
            <div
              className={[
                CORE_CELL,
                "col-span-2 border-t border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent sm:col-span-1 sm:border-t-0 sm:border-l sm:border-white/[0.08]",
              ].join(" ")}
              aria-label="패닉 종합 점수"
            >
              <span className={CORE_LABEL}>패닉지수</span>
              <span className={CORE_VALUE} style={metricValueDisplayStyle("#e2e8f0")}>
                {finalScore != null ? finalScore : "—"}
              </span>
            </div>
          </div>
        </section>

        <SectionLabel title="전문가 리스크 지표" variant="expert" />
        <section className="mb-1 overflow-hidden rounded-md border border-white/[0.03] bg-[rgba(255,255,255,0.015)] p-px opacity-[0.78]">
          <div className="grid grid-cols-2 gap-px bg-white/[0.025] sm:grid-cols-3 lg:grid-cols-5">
            {EXPERT_METRICS.map((metric) => (
              <MetricTile
                key={metric.key}
                metric={metric}
                value={fmt(metric.key, panicData?.[metric.key])}
                selected={chartMetric === metric.key}
                onSelect={() => setChartMetric(metric.key)}
                variant="expert"
              />
            ))}
          </div>
        </section>
      </div>

      <div>
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

      <div>
        <CycleBondLiquiditySection
          basisDateTime={null}
          panicData={panicData}
          snapshot={bondSnapshot.snapshot}
          loading={bondSnapshot.loading}
          syncingBond={bondSnapshot.syncingBond}
          refetchBond={bondSnapshot.refetchBond}
          lastBondSyncAt={bondSnapshot.lastBondSyncAt}
        />
      </div>

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
  )
}
