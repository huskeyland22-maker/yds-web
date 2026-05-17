import { useMemo } from "react"
import {
  computeMarketTiming,
  timingScoreBarClass,
  timingScoreBorderClass,
  timingScoreTextClass,
} from "../utils/panicMarketTimingEngine.js"

/**
 * @param {{ panicData?: object | null }} props
 */
export default function PanicMarketTimingPanel({ panicData = null }) {
  const timing = useMemo(() => computeMarketTiming(panicData), [panicData])

  const hasAny =
    timing &&
    (timing.short?.metricsUsed?.length > 0 ||
      timing.mid?.metricsUsed?.length > 0 ||
      timing.long?.metricsUsed?.length > 0)

  if (!hasAny) {
    return (
      <div className="border-t border-white/[0.06] px-3 py-2.5">
        <p className="m-0 text-[10px] text-slate-500">
          9대 지표 입력 시 단기·중기·장기 타점이 자동 계산됩니다.
        </p>
      </div>
    )
  }

  const cards = [timing.short, timing.mid, timing.long].filter(
    (c) => c && c.metricsUsed?.length > 0,
  )

  return (
    <div className="border-t border-amber-500/15 bg-amber-500/[0.02] px-2 py-2.5 sm:px-2.5 sm:py-3">
      <p className="m-0 mb-2 border-l-2 border-amber-400/45 pl-2 text-left text-[11px] font-bold tracking-[0.02em] text-slate-200">
        시장 타점
      </p>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3 sm:gap-2">
        {cards.map((card) => (
          <TimingCard key={card.horizon} signal={card} />
        ))}
      </div>
    </div>
  )
}

/** @param {{ signal: import("../utils/panicMarketTimingEngine.js").TimingSignal }} props */
function TimingCard({ signal }) {
  const score = signal.score ?? 0
  const sectorLine = signal.sectors?.length ? signal.sectors.join(" · ") : "—"

  return (
    <article
      className={[
        "rounded-md border bg-[#070a10]/90 px-2.5 py-2.5",
        timingScoreBorderClass(score),
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="m-0 text-[10px] font-bold text-slate-200">{signal.label}</p>
          <p className="m-0 mt-0.5 text-[9px] text-slate-500">{signal.status}</p>
        </div>
        <p className={`m-0 font-mono text-[22px] font-bold tabular-nums leading-none ${timingScoreTextClass(score)}`}>
          {score}
        </p>
      </div>

      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={["h-full rounded-full transition-all", timingScoreBarClass(score)].join(" ")}
          style={{ width: `${Math.max(4, Math.min(100, score))}%` }}
        />
      </div>

      <p className="m-0 mt-2 text-[10px] leading-snug text-slate-400">{signal.interpretation}</p>
      <p className="m-0 mt-1.5 text-[11px] font-semibold leading-snug text-slate-100">{signal.action}</p>
      <p className="m-0 mt-1 text-[10px] leading-snug text-cyan-200/85">{sectorLine}</p>
    </article>
  )
}
