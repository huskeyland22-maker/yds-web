import { useMemo } from "react"
import { getFinalScore } from "../../utils/tradingScores.js"
import { scoreEmoji } from "../../macro-risk/seriesMath.js"

/**
 * @param {{
 *   snapshot: import("../../macro-risk/engine.js").MacroRiskSnapshot
 *   panicData?: object | null
 * }} props
 */
export default function MacroRiskConnectCard({ snapshot, panicData = null }) {
  const cycleScore = useMemo(() => (panicData ? getFinalScore(panicData) : null), [panicData])

  return (
    <section className="trading-card-shell overflow-hidden px-3 py-2.5 sm:px-3.5 sm:py-3">
      <p className="m-0 text-[9px] font-semibold tracking-[0.16em] text-slate-500">YDS MARKET OS</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-md border border-white/[0.06] bg-black/20 px-2 py-1.5">
          <p className="m-0 text-[10px] text-slate-500">Cycle</p>
          <p className="m-0 font-mono text-[20px] font-bold tabular-nums text-slate-100">
            {cycleScore ?? "—"}
            {cycleScore != null ? (
              <span className="ml-1 text-[12px]" aria-hidden>
                {scoreEmoji(100 - cycleScore)}
              </span>
            ) : null}
          </p>
        </div>
        <div className="rounded-md border border-white/[0.06] bg-black/20 px-2 py-1.5">
          <p className="m-0 text-[10px] text-slate-500">Macro</p>
          <p className="m-0 font-mono text-[20px] font-bold tabular-nums text-slate-100">
            {snapshot.score}
            <span className="ml-1 text-[12px]" aria-hidden>
              {scoreEmoji(snapshot.score)}
            </span>
          </p>
        </div>
      </div>
      <ul className="m-0 mt-2 list-none space-y-0.5 border-t border-white/[0.06] pt-2 p-0 text-[11px] text-slate-300">
        <li>
          <span className="text-slate-500">장기:</span> {snapshot.connectLongTerm}
        </li>
        <li>
          <span className="text-slate-500">단기:</span> {snapshot.shortTerm}
        </li>
        <li>
          <span className="text-slate-500">실전:</span> {snapshot.tactical}
        </li>
      </ul>
    </section>
  )
}
