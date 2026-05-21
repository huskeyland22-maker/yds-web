import { Link } from "react-router-dom"
import { useMacroRiskSnapshot } from "../../macro-risk/useMacroRiskSnapshot.js"
import { scoreEmoji } from "../../macro-risk/seriesMath.js"

/**
 * Cycle 홈 위젯 — 기존 레이아웃 유지, 신규 카드만 추가.
 * @param {{ cycleScore: number | null; panicData?: object | null }} props
 */
export default function YdsMarketOsScoreCard({ cycleScore, panicData = null }) {
  const { enabled, snapshot, loading } = useMacroRiskSnapshot(panicData)

  if (!enabled) return null

  const macroScore = snapshot?.score
  const macroEmoji = macroScore != null ? scoreEmoji(macroScore) : "—"
  const cycleEmoji = cycleScore != null ? scoreEmoji(100 - cycleScore) : "—"

  return (
    <section className="yds-market-os-card trading-card-shell overflow-hidden px-3 py-2.5 sm:px-3.5 sm:py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 text-[9px] font-semibold tracking-[0.16em] text-slate-500">YDS SCORE</p>
        <Link to="/cycle#bond-liquidity" className="text-[10px] font-medium text-cyan-400/90 hover:text-cyan-300">
          Macro Risk →
        </Link>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-md border border-white/[0.06] bg-black/20 px-2 py-1.5">
          <p className="m-0 text-[10px] text-slate-500">Cycle</p>
          <p className="m-0 font-mono text-[18px] font-bold tabular-nums text-slate-100">
            {cycleScore ?? "—"} <span className="text-[12px]">{cycleEmoji}</span>
          </p>
        </div>
        <div className="rounded-md border border-white/[0.06] bg-black/20 px-2 py-1.5">
          <p className="m-0 text-[10px] text-slate-500">Macro</p>
          <p className="m-0 font-mono text-[18px] font-bold tabular-nums text-slate-100">
            {loading ? "…" : (macroScore ?? "—")} <span className="text-[12px]">{macroEmoji}</span>
          </p>
        </div>
      </div>

      {snapshot ? (
        <ul className="m-0 mt-2 list-none space-y-0.5 p-0 text-[10px] leading-snug text-slate-400">
          <li>
            <span className="text-slate-500">장기:</span> {snapshot.longTerm}
          </li>
          <li>
            <span className="text-slate-500">단기:</span> {snapshot.shortTerm}
          </li>
          <li>
            <span className="text-slate-500">실전:</span> {snapshot.tactical}
          </li>
        </ul>
      ) : null}
    </section>
  )
}
