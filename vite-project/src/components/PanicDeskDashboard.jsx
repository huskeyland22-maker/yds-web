import { useMemo } from "react"
import { getFinalScore } from "../utils/tradingScores.js"
import CycleBondLiquiditySection from "./cycle/CycleBondLiquiditySection.jsx"
import CycleDataBasisBar from "./cycle/CycleDataBasisBar.jsx"
import HomeV5DeskLead from "../home-v5/HomeV5DeskLead.jsx"
import HomeV5StrategyValidationPanel from "../home-v5/HomeV5StrategyValidationPanel.jsx"
import { mergeCycleRows } from "../utils/cycleHistoryUtils.js"
import { resolveCycleHistoryRows } from "../utils/panicHistoryRows.js"
import { isMacroRiskEnabled } from "../macro-risk/featureFlag.js"
import { useMacroRiskSnapshot } from "../macro-risk/useMacroRiskSnapshot.js"
import PanicIndexHistorySection from "./PanicIndexHistorySection.jsx"
import SectionErrorBoundary from "./SectionErrorBoundary.jsx"
import TacticalTradingZoneSection from "./trading-zone/TacticalTradingZoneSection.jsx"

/**
 * @param {{
 *   panicData: object | null
 *   cycleMetricHistory: object[]
 *   isStale?: boolean
 *   asOfDateLabel?: string
 *   aiReportDegraded?: boolean
 *   aiReportWarning?: string | null
 * }} props
 */
export default function PanicDeskDashboard({
  panicData,
  cycleMetricHistory,
  isStale: _isStale = false,
  asOfDateLabel: _asOfDateLabel = "—",
  aiReportDegraded = false,
  aiReportWarning = null,
}) {
  const safeHistory = Array.isArray(cycleMetricHistory) ? cycleMetricHistory : []

  const mergedHistory = useMemo(
    () => resolveCycleHistoryRows(mergeCycleRows(safeHistory, [])),
    [safeHistory],
  )

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
        <HomeV5DeskLead panicData={panicData} historyRows={safeHistory} />
      </div>

      <div className="panic-v2-desk__history-slot panic-desk-section panic-desk-section--amber panic-desk-section--main">
        <SectionErrorBoundary
          label="패닉지수 히스토리"
          fallback={
            <div className="trading-card-shell mt-6 px-3 py-4 text-center text-sm text-slate-400">
              패닉지수 히스토리 로딩 실패
            </div>
          }
        >
          <PanicIndexHistorySection rows={safeHistory} />
        </SectionErrorBoundary>
      </div>

      {/* 전략 연구실 LAB — /cycle(시장 사이클) 전용 · 히스토리 직하 · 실전 매매존과 분리 */}
      <div className="panic-v2-desk__lab-slot" data-page="cycle-strategy-lab">
        <HomeV5StrategyValidationPanel historyRows={mergedHistory} compact defaultOpen={false} />
      </div>

      <hr className="cycle-desk-divider cycle-desk-divider--reference" aria-hidden />

      <div className="panic-v2-desk__bond-slot">
        <CycleBondLiquiditySection
          panicData={panicData}
          snapshot={bondSnapshot.snapshot}
          loading={bondSnapshot.loading}
        />
      </div>

      <div className="panic-v2-desk__trading-zone-slot">
        <SectionErrorBoundary
          label="실전 매매 존"
          fallback={
            <div className="trading-card-shell px-3 py-4 text-center">
              <p className="m-0 text-sm font-semibold text-amber-300">⚠ 일부 데이터 연결 지연</p>
              <p className="m-0 mt-1 text-xs text-slate-300">실전 엔진은 유지되며 마지막 정상 정책으로 동작 중입니다.</p>
            </div>
          }
        >
          <TacticalTradingZoneSection
            panicData={panicData}
            cycleScore={finalScore}
            snapshot={bondSnapshot.snapshot}
            historyRows={safeHistory}
            aiReportDegraded={aiReportDegraded}
            aiReportWarning={aiReportWarning}
          />
        </SectionErrorBoundary>
      </div>
    </div>
  )
}
