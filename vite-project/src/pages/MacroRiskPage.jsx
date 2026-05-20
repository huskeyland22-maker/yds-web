import MacroRiskConnectCard from "../components/macro-risk/MacroRiskConnectCard.jsx"
import MacroRiskDevValidationPanel from "../components/macro-risk/MacroRiskDevValidationPanel.jsx"
import MacroRiskTierPanel from "../components/macro-risk/MacroRiskTierPanel.jsx"
import MacroRiskHero from "../components/macro-risk/MacroRiskHero.jsx"
import MacroRiskLiveDataStatus from "../components/macro-risk/MacroRiskLiveDataStatus.jsx"
import MacroRiskMarketImpact from "../components/macro-risk/MacroRiskMarketImpact.jsx"
import MacroRiskMarketRegime from "../components/macro-risk/MacroRiskMarketRegime.jsx"
import MacroRiskPillarSection from "../components/macro-risk/MacroRiskPillarSection.jsx"
import MacroRiskTodayMarketCard from "../components/macro-risk/MacroRiskTodayMarketCard.jsx"
import MacroRiskTriggers from "../components/macro-risk/MacroRiskTriggers.jsx"
import MacroRiskYieldCurveCard from "../components/macro-risk/MacroRiskYieldCurveCard.jsx"
import SectionErrorBoundary from "../components/SectionErrorBoundary.jsx"
import { isMacroRiskEnabled } from "../macro-risk/featureFlag.js"
import { useMacroRiskSnapshot } from "../macro-risk/useMacroRiskSnapshot.js"
import { isDevMode, isShowDebugPanel } from "../utils/devMode.js"
import { Navigate } from "react-router-dom"

/**
 * YDS Market OS — Macro Risk 레이어 (패닉/Cycle 비침투)
 * @param {{ panicData?: object | null }} props
 */
export default function MacroRiskPage({ panicData = null }) {
  if (!isMacroRiskEnabled()) {
    return <Navigate to="/cycle" replace />
  }

  const { snapshot, loading, error } = useMacroRiskSnapshot(panicData)

  return (
    <div className="macro-risk-page min-w-0 overflow-x-hidden">
      <header className="mb-2 px-0.5">
        <p className="m-0 text-[9px] font-semibold tracking-[0.2em] text-slate-600">YDS MARKET OS</p>
        <h1 className="m-0 mt-0.5 text-lg font-semibold tracking-tight text-slate-100">Macro Risk</h1>
        <p className="m-0 mt-1 text-[11px] text-slate-500">
          클라이언트 계산 · /api/market-data · 정적 시드 (신규 serverless 없음)
        </p>
      </header>

      {loading && !snapshot ? (
        <p className="text-[11px] text-slate-500" role="status">
          매크로 리스크 계산 중…
        </p>
      ) : null}
      {error ? (
        <p className="text-[11px] text-amber-400/90" role="alert">
          {error}
        </p>
      ) : null}

      {snapshot ? (
        <div className="macro-risk-stack flex flex-col gap-4 sm:gap-5">
          <SectionErrorBoundary label="Cycle + Macro">
            <MacroRiskConnectCard snapshot={snapshot} panicData={panicData} />
          </SectionErrorBoundary>

          <SectionErrorBoundary label="Macro Risk Hero">
            <MacroRiskHero snapshot={snapshot} />
          </SectionErrorBoundary>

          {snapshot.liveDataStatus ? (
            <SectionErrorBoundary label="LIVE DATA STATUS">
              <MacroRiskLiveDataStatus status={snapshot.liveDataStatus} />
            </SectionErrorBoundary>
          ) : null}

          <SectionErrorBoundary label="Today Market">
            <MacroRiskTodayMarketCard snapshot={snapshot} panicData={panicData} />
          </SectionErrorBoundary>

          {snapshot.marketRegime?.length ? (
            <SectionErrorBoundary label="Market Regime">
              <MacroRiskMarketRegime rows={snapshot.marketRegime} />
            </SectionErrorBoundary>
          ) : null}

          {snapshot.yieldCurve ? (
            <SectionErrorBoundary label="장단기 금리차">
              <MacroRiskYieldCurveCard curve={snapshot.yieldCurve} />
            </SectionErrorBoundary>
          ) : null}

          <SectionErrorBoundary label="Tier 지표">
            <MacroRiskTierPanel tieredMetrics={snapshot.tieredMetrics} />
          </SectionErrorBoundary>

          <SectionErrorBoundary label="압력 지표">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-4">
              {snapshot.pillars.map((pillar) => (
                <SectionErrorBoundary key={pillar.id} label={pillar.title}>
                  <MacroRiskPillarSection pillar={pillar} />
                </SectionErrorBoundary>
              ))}
            </div>
          </SectionErrorBoundary>

          <SectionErrorBoundary label="시장 영향">
            <MacroRiskMarketImpact rows={snapshot.marketImpact} />
          </SectionErrorBoundary>

          <SectionErrorBoundary label="복합 트리거">
            <MacroRiskTriggers triggers={snapshot.triggers} />
          </SectionErrorBoundary>

          {isDevMode() && isShowDebugPanel() && snapshot.devValidation?.rows?.length ? (
            <MacroRiskDevValidationPanel data={snapshot.devValidation} />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
