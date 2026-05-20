import MacroRiskHero from "../components/macro-risk/MacroRiskHero.jsx"
import MacroRiskPillarSection from "../components/macro-risk/MacroRiskPillarSection.jsx"
import MacroRiskTriggers from "../components/macro-risk/MacroRiskTriggers.jsx"
import SectionErrorBoundary from "../components/SectionErrorBoundary.jsx"
import { isMacroRiskEnabled } from "../macro-risk/featureFlag.js"
import { useMacroRiskSnapshot } from "../macro-risk/useMacroRiskSnapshot.js"
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
        <div className="macro-risk-stack flex flex-col gap-2 sm:gap-2.5">
          <SectionErrorBoundary label="Macro Risk Hero">
            <MacroRiskHero snapshot={snapshot} />
          </SectionErrorBoundary>

          {snapshot.pillars.map((pillar) => (
            <SectionErrorBoundary key={pillar.id} label={pillar.title}>
              <MacroRiskPillarSection pillar={pillar} />
            </SectionErrorBoundary>
          ))}

          <SectionErrorBoundary label="복합 트리거">
            <MacroRiskTriggers triggers={snapshot.triggers} />
          </SectionErrorBoundary>
        </div>
      ) : null}
    </div>
  )
}
