import { useMemo } from "react"
import { getFinalScore } from "../../utils/tradingScores.js"

/**
 * @param {{ snapshot: import("../../macro-risk/engine.js").MacroRiskSnapshot; panicData?: object | null }} props
 */
export default function MacroRiskTodayMarketCard({ snapshot, panicData = null }) {
  const cycleScore = useMemo(() => (panicData ? getFinalScore(panicData) : null), [panicData])
  const cycleView = cycleScore == null ? "—" : cycleScore <= 30 ? "우호" : cycleScore <= 60 ? "중립" : "경계"

  return (
    <section className="trading-card-shell px-3 py-2.5 sm:px-3.5 sm:py-3">
      <p className="m-0 text-[10px] font-semibold tracking-[0.12em] text-slate-500">TODAY MARKET</p>
      <ul className="m-0 mt-2 list-none space-y-1 p-0 text-[11px] text-slate-200">
        <li>
          <span className="text-slate-500">장기:</span> Cycle {cycleScore ?? "—"} · {cycleView}
        </li>
        <li>
          <span className="text-slate-500">단기:</span> Macro {snapshot.score} · {snapshot.shortTerm}
        </li>
        <li>
          <span className="text-slate-500">실전:</span> {snapshot.tactical}
        </li>
      </ul>
    </section>
  )
}
