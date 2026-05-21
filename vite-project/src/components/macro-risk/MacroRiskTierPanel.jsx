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
      <section className="macro-risk-tier-shell trading-card-shell">
        <p className="m-0 macro-risk-tier-shell__eyebrow">핵심 지표</p>
        <p className="m-0 macro-risk-tier-shell__sub">10년물 · 30년물 · 달러지수</p>
        <MacroRiskChangeRates metrics={tier1} variant="tier1" hideBlockTitle title="" />
      </section>

      <section className="macro-risk-tier-shell trading-card-shell">
        <button
          type="button"
          onClick={() => setExpertOpen((v) => !v)}
          className="macro-risk-tier-expert-btn flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="text-[10px] font-semibold text-slate-300">전문가 보기 {expertOpen ? "▲" : "▼"}</span>
        </button>
        <p className="m-0 macro-risk-tier-shell__sub">실질금리 · 기대인플레 · 2년물</p>
        {expertOpen ? (
          <div className="mt-1.5">
            <MacroRiskChangeRates metrics={tier2} variant="tier2" hideBlockTitle title="" />
          </div>
        ) : null}
      </section>
    </>
  )
}
