import MacroRiskChangeRates from "./MacroRiskChangeRates.jsx"

/**
 * @param {{
 *   tieredMetrics: { tier1: import("../../macro-risk/displayMetrics.js").MetricDisplayRow[]; tier2: import("../../macro-risk/displayMetrics.js").MetricDisplayRow[] }
 * }} props
 */
export default function MacroRiskTierPanel({ tieredMetrics }) {
  const { tier1, tier2 } = tieredMetrics ?? { tier1: [], tier2: [] }

  return (
    <>
      <section className="trading-card-shell px-4 py-3">
        <p className="m-0 text-[9px] font-semibold tracking-[0.18em] text-slate-500">TIER 1</p>
        <p className="m-0 mt-0.5 text-[10px] text-slate-500">US10Y · REAL · DXY · MOVE</p>
        <MacroRiskChangeRates metrics={tier1} variant="tier1" hideBlockTitle title="" />
      </section>

      <section className="trading-card-shell px-4 py-3">
        <p className="m-0 text-[9px] font-semibold tracking-[0.18em] text-slate-400">TIER 2</p>
        <p className="m-0 mt-0.5 text-[10px] text-slate-600">30Y · BEI · VXN · 2Y · 보조 신호</p>
        <MacroRiskChangeRates metrics={tier2} variant="tier2" hideBlockTitle title="" />
      </section>
    </>
  )
}
