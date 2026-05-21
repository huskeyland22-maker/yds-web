import { useState } from "react"
import MacroRiskChangeRates from "./MacroRiskChangeRates.jsx"

/**
 * @param {{
 *   tieredMetrics: { tier1: import("../../macro-risk/displayMetrics.js").MetricDisplayRow[]; tier2: import("../../macro-risk/displayMetrics.js").MetricDisplayRow[] }
 * }} props
 */
export default function MacroRiskTierPanel({ tieredMetrics }) {
  const { tier1, tier2 } = tieredMetrics ?? { tier1: [], tier2: [] }
  const [expertOpen, setExpertOpen] = useState(false)

  return (
    <>
      <section className="trading-card-shell px-4 py-3">
        <p className="m-0 text-[9px] font-semibold tracking-[0.18em] text-slate-500">핵심 지표</p>
        <p className="m-0 mt-0.5 text-[10px] text-slate-500">10년물 · 30년물 · 달러지수</p>
        <MacroRiskChangeRates metrics={tier1} variant="tier1" hideBlockTitle title="" />
      </section>

      <section className="trading-card-shell px-4 py-3">
        <button
          type="button"
          onClick={() => setExpertOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-left"
        >
          <span className="text-[10px] font-semibold text-slate-300">전문가 보기 {expertOpen ? "▲" : "▼"}</span>
        </button>
        <p className="m-0 mt-1 text-[10px] text-slate-600">실질금리 · 기대인플레 · 2년물</p>
        {expertOpen ? (
          <div className="mt-2">
            <MacroRiskChangeRates metrics={tier2} variant="tier2" hideBlockTitle title="" />
          </div>
        ) : null}
      </section>
    </>
  )
}
