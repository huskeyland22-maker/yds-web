import { useMemo } from "react"
import {
  allocationBarClass,
  computeMarketTiming,
  timingScoreTextClass,
} from "../utils/panicMarketTimingEngine.js"

/**
 * @param {{ panicData?: object | null }} props
 */
export default function PanicMarketTimingPanel({ panicData = null }) {
  const timing = useMemo(() => computeMarketTiming(panicData), [panicData])

  const cards = [timing?.short, timing?.mid, timing?.long].filter(
    (c) => c && c.metricsUsed?.length > 0,
  )

  if (!cards.length) {
    return (
      <div className="border-t border-white/[0.06] px-2 py-1.5">
        <p className="m-0 text-[9px] text-slate-500">8대 지표 입력 시 타점 자동 계산</p>
      </div>
    )
  }

  return (
    <div className="border-t border-amber-500/12 bg-amber-500/[0.015] px-2 py-1.5">
      <p className="m-0 mb-1.5 border-l-2 border-amber-400/40 pl-1.5 text-[10px] font-bold text-slate-200">
        시장 타점
      </p>
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
        {cards.map((signal) => (
          <CompactTimingCard key={signal.horizon} signal={signal} />
        ))}
      </div>
    </div>
  )
}

/** @param {{ signal: import("../utils/panicMarketTimingEngine.js").TimingSignal }} props */
function CompactTimingCard({ signal }) {
  const score = signal.score ?? 0
  const action = signal.actionShort || signal.action

  return (
    <article className="rounded border border-white/[0.07] bg-[#060910]/90 px-2 py-1.5">
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{signal.label}</span>
        <span className={`font-mono text-[17px] font-bold tabular-nums leading-none ${timingScoreTextClass(score)}`}>
          {score}
        </span>
      </div>
      <p className="m-0 mt-0.5 text-[10px] font-bold leading-tight text-slate-100">{action}</p>
      {signal.allocations?.length > 0 ? (
        <ul className="m-0 mt-1 grid list-none grid-cols-2 gap-x-1.5 gap-y-0.5 p-0">
          {signal.allocations.slice(0, 4).map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-0.5">
              <span className="truncate text-[7px] text-slate-500">{row.label}</span>
              <span className="font-mono text-[8px] font-bold tabular-nums text-slate-400">{row.pct}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  )
}
