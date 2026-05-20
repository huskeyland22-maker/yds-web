import MacroRiskActionNow from "../components/macro-risk/MacroRiskActionNow.jsx"
import MacroRiskDevValidationPanel from "../components/macro-risk/MacroRiskDevValidationPanel.jsx"
import MacroRiskHero from "../components/macro-risk/MacroRiskHero.jsx"
import MacroRiskLiveDataStatus from "../components/macro-risk/MacroRiskLiveDataStatus.jsx"
import MacroRiskPillarSection from "../components/macro-risk/MacroRiskPillarSection.jsx"
import MacroRiskPlaybook from "../components/macro-risk/MacroRiskPlaybook.jsx"
import MacroRiskPositionCard from "../components/macro-risk/MacroRiskPositionCard.jsx"
import MacroRiskTierPanel from "../components/macro-risk/MacroRiskTierPanel.jsx"
import MacroRiskTriggers from "../components/macro-risk/MacroRiskTriggers.jsx"
import SectionErrorBoundary from "../components/SectionErrorBoundary.jsx"
import { macroScorePrevDayDelta } from "../macro-risk/macroRiskDayOverDay.js"
import { isMacroRiskEnabled } from "../macro-risk/featureFlag.js"
import { formatMacroRiskPipelineSubtitle } from "../macro-risk/liveDataStatus.js"
import { useMacroRiskSnapshot } from "../macro-risk/useMacroRiskSnapshot.js"
import { useCallback, useEffect, useState } from "react"
import { Navigate } from "react-router-dom"

const MACRO_DEV_UI_KEY = "yds-macro-dev-ui"

/**
 * YDS Market OS — Macro Risk 레이어 (패닉/Cycle 비침투)
 * @param {{ panicData?: object | null }} props
 */
export default function MacroRiskPage({ panicData = null }) {
  if (!isMacroRiskEnabled()) {
    return <Navigate to="/cycle" replace />
  }

  const { snapshot, loading, error, refetch } = useMacroRiskSnapshot(panicData)

  const [macroDevUi, setMacroDevUi] = useState(() => {
    if (typeof window === "undefined") return false
    try {
      return window.localStorage?.getItem(MACRO_DEV_UI_KEY) === "1"
    } catch {
      return false
    }
  })

  const [prevDayDelta, setPrevDayDelta] = useState(null)
  const [prevDayKnown, setPrevDayKnown] = useState(false)

  useEffect(() => {
    if (!snapshot) return
    const { delta, hasYesterday } = macroScorePrevDayDelta(snapshot.score)
    setPrevDayDelta(delta)
    setPrevDayKnown(hasYesterday)
  }, [snapshot?.score, snapshot?.updatedAt])

  const toggleMacroDevUi = useCallback(() => {
    setMacroDevUi((prev) => {
      const next = !prev
      try {
        window.localStorage?.setItem(MACRO_DEV_UI_KEY, next ? "1" : "0")
      } catch {
        // ignore
      }
      queueMicrotask(() => refetch())
      return next
    })
  }, [refetch])

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === MACRO_DEV_UI_KEY && e.newValue != null) {
        setMacroDevUi(e.newValue === "1")
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  return (
    <div className="macro-risk-page min-w-0 overflow-x-hidden px-0.5">
      <header className="mb-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="m-0 text-[9px] font-semibold tracking-[0.2em] text-slate-600">YDS MARKET OS</p>
          <h1 className="m-0 mt-0.5 text-lg font-semibold tracking-tight text-slate-100">Macro Risk</h1>
        </div>
        <button
          type="button"
          onClick={toggleMacroDevUi}
          className={[
            "shrink-0 rounded-md border px-2.5 py-1 text-[10px] font-bold tracking-wide",
            macroDevUi
              ? "border-amber-400/40 bg-amber-500/15 text-amber-100"
              : "border-white/[0.08] bg-white/[0.03] text-slate-400",
          ].join(" ")}
        >
          DEV MODE {macroDevUi ? "ON" : "OFF"}
        </button>
      </header>

      {macroDevUi && snapshot?.liveDataStatus ? (
        <p className="m-0 mb-2 text-[10px] leading-relaxed text-slate-500">
          {formatMacroRiskPipelineSubtitle(snapshot.liveDataStatus)}
        </p>
      ) : null}

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
        <div className="macro-risk-stack flex flex-col gap-[18px]">
          <SectionErrorBoundary label="Summary">
            <MacroRiskHero
              snapshot={snapshot}
              macroDevUi={macroDevUi}
              prevDayDelta={prevDayDelta}
              prevDayKnown={prevDayKnown}
            />
          </SectionErrorBoundary>

          <SectionErrorBoundary label="Market Position">
            <MacroRiskPositionCard snapshot={snapshot} panicData={panicData} />
          </SectionErrorBoundary>

          <div className="sticky top-1 z-30 -mx-0.5 rounded-lg border border-white/[0.04] bg-slate-950/75 px-0.5 py-1 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-md">
            <MacroRiskActionNow snapshot={snapshot} />
          </div>

          <SectionErrorBoundary label="Tier metrics">
            <MacroRiskTierPanel tieredMetrics={snapshot.tieredMetrics} />
          </SectionErrorBoundary>

          <SectionErrorBoundary label="Pressure Engine">
            <div>
              <p className="mb-2 px-0.5 text-[9px] font-semibold tracking-[0.18em] text-slate-500">PRESSURE ENGINE</p>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                {snapshot.pillars.map((pillar) => (
                  <SectionErrorBoundary key={pillar.id} label={pillar.title}>
                    <MacroRiskPillarSection pillar={pillar} />
                  </SectionErrorBoundary>
                ))}
              </div>
            </div>
          </SectionErrorBoundary>

          <SectionErrorBoundary label="Active Triggers">
            <MacroRiskTriggers triggers={snapshot.triggers} />
          </SectionErrorBoundary>

          <SectionErrorBoundary label="Market Playbook">
            <MacroRiskPlaybook snapshot={snapshot} />
          </SectionErrorBoundary>

          {macroDevUi && snapshot.liveDataStatus ? (
            <SectionErrorBoundary label="LIVE DATA STATUS">
              <MacroRiskLiveDataStatus status={snapshot.liveDataStatus} />
            </SectionErrorBoundary>
          ) : null}

          {macroDevUi && snapshot.devValidation?.rows?.length ? (
            <MacroRiskDevValidationPanel data={snapshot.devValidation} />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
