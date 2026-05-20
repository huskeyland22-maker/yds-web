import MacroRiskChangeRates from "./MacroRiskChangeRates.jsx"

/**
 * @param {{
 *   tieredMetrics: { tier1: import("../../macro-risk/displayMetrics.js").MetricDisplayRow[]; tier2: import("../../macro-risk/displayMetrics.js").MetricDisplayRow[] }
 * }} props
 */
export default function MacroRiskTierPanel({ tieredMetrics }) {
  const { tier1, tier2 } = tieredMetrics ?? { tier1: [], tier2: [] }

  return (
    <section className="trading-card-shell px-3 py-3 sm:px-4 sm:py-3.5">
      <p className="m-0 text-[9px] font-semibold tracking-[0.18em] text-slate-500">핵심 지표</p>
      <p className="m-0 mt-0.5 text-[10px] text-slate-500">Tier 1 핵심 · 2열 컴팩트</p>

      <MacroRiskChangeRates metrics={tier1} title="Tier 1" />
      <div className="mt-4 border-t border-white/[0.06] pt-1">
        <MacroRiskChangeRates metrics={tier2} title="Tier 2" />
      </div>
    </section>
  )
}
