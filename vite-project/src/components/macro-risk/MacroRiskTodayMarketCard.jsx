import { useMemo } from "react"
import { getFinalScore } from "../../utils/tradingScores.js"

/**
 * @param {{ snapshot: import("../../macro-risk/engine.js").MacroRiskSnapshot; panicData?: object | null }} props
 */
export default function MacroRiskTodayMarketCard({ snapshot, panicData = null }) {
  const cycleScore = useMemo(() => (panicData ? getFinalScore(panicData) : null), [panicData])
  const cycleView = useMemo(() => {
    if (cycleScore == null) return "—"
    if (cycleScore <= 15) return "극단 공포"
    if (cycleScore <= 30) return cycleScore >= 22 ? "공포 후반" : "공포"
    if (cycleScore <= 45) return "중립"
    if (cycleScore <= 60) return "과열"
    return "극단 과열"
  }, [cycleScore])
  const cycleAction = useMemo(() => {
    if (cycleScore == null) return "관망"
    if (cycleScore <= 30) return "분할매수 구간"
    if (cycleScore <= 45) return "관망"
    if (cycleScore <= 60) return "비중축소"
    return "방어"
  }, [cycleScore])
  const macroView = useMemo(() => {
    if (snapshot.score >= 80) return "금리 재평가"
    if (snapshot.score >= 60) return "금리 압박"
    if (snapshot.score >= 40) return "압박 시작"
    return "중립"
  }, [snapshot.score])

  return (
    <section className="trading-card-shell px-3 py-2.5 sm:px-3.5 sm:py-3">
      <p className="m-0 text-[10px] font-semibold tracking-[0.12em] text-slate-500">TODAY MARKET</p>
      <ul className="m-0 mt-2 list-none space-y-1 p-0 text-[11px] text-slate-200">
        <li>
          <span className="text-slate-500">장기:</span> {cycleView} · {cycleAction}
        </li>
        <li>
          <span className="text-slate-500">단기:</span> {macroView} · {snapshot.shortTerm}
        </li>
        <li>
          <span className="text-slate-500">실전:</span> {snapshot.tactical}
        </li>
      </ul>
    </section>
  )
}
