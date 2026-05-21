import BondLiquidityStatusBar from "../components/bond-monitor/BondLiquidityStatusBar.jsx"
import MarketOsPhase2Shell from "../components/market-os/MarketOsPhase2Shell.jsx"
import { BOND_MONITOR_SUBTITLE, BOND_MONITOR_TITLE } from "../market-os/bondMonitorLabels.js"
import MacroRiskActionNow from "../components/macro-risk/MacroRiskActionNow.jsx"
import MacroRiskDevValidationPanel from "../components/macro-risk/MacroRiskDevValidationPanel.jsx"
import MacroRiskHero from "../components/macro-risk/MacroRiskHero.jsx"
import MacroRiskLiveDataStatus from "../components/macro-risk/MacroRiskLiveDataStatus.jsx"
import MacroRiskPillarSection from "../components/macro-risk/MacroRiskPillarSection.jsx"
import MacroRiskPlaybook from "../components/macro-risk/MacroRiskPlaybook.jsx"
import MacroRiskPositionCard from "../components/macro-risk/MacroRiskPositionCard.jsx"
import MacroRiskTierPanel from "../components/macro-risk/MacroRiskTierPanel.jsx"
import MacroRiskTriggers from "../components/macro-risk/MacroRiskTriggers.jsx"
import MacroRiskWaitSignal from "../components/macro-risk/MacroRiskWaitSignal.jsx"
import SectionErrorBoundary from "../components/SectionErrorBoundary.jsx"
import { cycleScorePrevDayDelta, macroScorePrevDayDelta } from "../macro-risk/macroRiskDayOverDay.js"
import { isMacroRiskEnabled } from "../macro-risk/featureFlag.js"
import { formatMacroRiskPipelineSubtitle } from "../macro-risk/liveDataStatus.js"
import { useMacroRiskSnapshot } from "../macro-risk/useMacroRiskSnapshot.js"
import { getFinalScore } from "../utils/tradingScores.js"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Navigate } from "react-router-dom"

const MACRO_DEV_UI_KEY = "yds-macro-dev-ui"

/**
 * YDS Market OS — Bond / Liquidity Monitor (보조, Cycle·패닉 비침투)
 * @param {{ panicData?: object | null }} props
 */
export default function MacroRiskPage({ panicData = null }) {
  if (!isMacroRiskEnabled()) {
    return <Navigate to="/cycle" replace />
  }

  const { snapshot, loading, syncingBond, error, refetch, refetchBond, lastBondSyncAt } =
    useMacroRiskSnapshot(panicData)
  const cycleScore = useMemo(() => (panicData ? getFinalScore(panicData) : null), [panicData])

  const [macroDevUi, setMacroDevUi] = useState(() => {
    if (typeof window === "undefined") return false
    try {
      return window.localStorage?.getItem(MACRO_DEV_UI_KEY) === "1"
    } catch {
      return false
    }
  })

  const [macroDay, setMacroDay] = useState({
    yesterdayScore: null,
    todayScore: 0,
    delta: null,
    hasYesterday: false,
  })
  const [cycleDay, setCycleDay] = useState({
    yesterdayScore: null,
    todayScore: null,
    delta: null,
    hasYesterday: false,
  })

  useEffect(() => {
    if (!snapshot) return
    setMacroDay(macroScorePrevDayDelta(snapshot.score))
  }, [snapshot?.score, snapshot?.updatedAt])

  useEffect(() => {
    if (cycleScore == null || !Number.isFinite(Number(cycleScore))) {
      setCycleDay({ yesterdayScore: null, todayScore: null, delta: null, hasYesterday: false })
      return
    }
    setCycleDay(cycleScorePrevDayDelta(cycleScore))
  }, [cycleScore])

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
          <h1 className="m-0 mt-0.5 text-lg font-semibold tracking-tight text-slate-100">{BOND_MONITOR_TITLE}</h1>
          <p className="m-0 mt-0.5 text-[10px] text-slate-500">{BOND_MONITOR_SUBTITLE}</p>
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
        <div className="macro-risk-stack flex flex-col">
          <MarketOsPhase2Shell panicData={panicData} sticky />

          <BondLiquidityStatusBar
            snapshot={snapshot}
            syncing={syncingBond}
            lastSyncAt={lastBondSyncAt}
            onBondSync={refetchBond}
          />

          <SectionErrorBoundary label="Summary">
            <MacroRiskHero snapshot={snapshot} macroDevUi={macroDevUi} macroDay={macroDay} cycleDay={cycleDay} />
          </SectionErrorBoundary>

          <MacroRiskActionNow snapshot={snapshot} cycleScore={cycleScore} />

          <SectionErrorBoundary label="Market Position">
            <MacroRiskPositionCard snapshot={snapshot} panicData={panicData} />
          </SectionErrorBoundary>

          <SectionErrorBoundary label="Tier metrics">
            <MacroRiskTierPanel tieredMetrics={snapshot.tieredMetrics} />
          </SectionErrorBoundary>

          <SectionErrorBoundary label="Pressure Engine">
            <div>
              <p className="macro-risk-pressure-heading m-0 px-0.5">PRESSURE ENGINE</p>
              <div className="macro-risk-pressure-grid grid grid-cols-1 md:grid-cols-3">
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

          <SectionErrorBoundary label="Wait Signal">
            <MacroRiskWaitSignal triggers={snapshot.triggers} />
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
