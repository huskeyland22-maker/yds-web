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
      <p className="m-0 mb-2.5 border-l-2 border-amber-400/45 pl-2 text-left text-[11px] font-bold tracking-[0.02em] text-slate-200">
        시장 타점
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-2.5">
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
  const actionLabel = signal.actionShort || signal.action
  const sectorLine = signal.sectors?.length ? signal.sectors.join(" · ") : "—"

  return (
    <article
      className={[
        "flex min-h-[168px] flex-col rounded-md border bg-[#060910]/95 px-3 py-3",
        timingScoreBorderClass(score),
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="m-0 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400">{signal.label}</p>
          <p className="m-0 mt-1 text-[9px] font-medium text-slate-500">{signal.status}</p>
        </div>
        <p
          className={`m-0 font-mono text-[26px] font-bold tabular-nums leading-none ${timingScoreTextClass(score)}`}
        >
          {score}
        </p>
      </div>

      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={["h-full rounded-full transition-all", timingScoreBarClass(score)].join(" ")}
          style={{ width: `${Math.max(4, Math.min(100, score))}%` }}
        />
      </div>

      <p className="m-0 mt-2.5 text-[12px] font-bold leading-snug tracking-tight text-slate-50">{actionLabel}</p>

      <div className="mt-3 flex flex-1 flex-col gap-2.5 border-t border-white/[0.07] pt-2.5">
        <InfoBlock label="시장 상태">
          <p className="m-0 text-[10px] leading-relaxed text-slate-300">{signal.marketState || "—"}</p>
          {signal.marketContext ? (
            <p className="m-0 mt-0.5 text-[10px] leading-relaxed text-slate-500">{signal.marketContext}</p>
          ) : null}
        </InfoBlock>

        <InfoBlock label="우위">
          <p className="m-0 text-[10px] leading-relaxed text-cyan-200/90">{sectorLine}</p>
        </InfoBlock>

        <InfoBlock label="리스크">
          <p className="m-0 text-[10px] leading-relaxed text-orange-200/85">{signal.risk || "—"}</p>
        </InfoBlock>
      </div>
    </article>
  )
}

/** @param {{ label: string; children: import("react").ReactNode }} props */
function InfoBlock({ label, children }) {
  return (
    <div className="rounded border border-white/[0.05] bg-white/[0.02] px-2 py-1.5">
      <p className="m-0 text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  )
}
