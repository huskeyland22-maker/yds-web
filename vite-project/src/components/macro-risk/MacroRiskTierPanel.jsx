import MacroRiskChangeRates from "./MacroRiskChangeRates.jsx"

/**
 * @param {{
 *   tieredMetrics: { tier1: import("../../macro-risk/displayMetrics.js").MetricDisplayRow[]; tier2: import("../../macro-risk/displayMetrics.js").MetricDisplayRow[] }
 * }} props
 */
export default function MacroRiskTierPanel({ tieredMetrics }) {
  const { tier1, tier2 } = tieredMetrics ?? { tier1: [], tier2: [] }

  return (
    <section className="trading-card-shell px-3 py-2.5 sm:px-3.5 sm:py-3">
      <p className="m-0 text-[10px] font-semibold tracking-[0.12em] text-slate-500">핵심 · 보조 지표</p>

      <MacroRiskChangeRates metrics={tier1} title="Tier 1 — 핵심" />
      <div className="mt-3 border-t border-white/[0.04] pt-0">
        <MacroRiskChangeRates metrics={tier2} title="Tier 2 — 보조" />
      </div>
    </section>
  )
}
