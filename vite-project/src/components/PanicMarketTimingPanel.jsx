import { useMemo } from "react"
import {
  allocationBarClass,
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
    <div className="border-t border-amber-500/15 bg-amber-500/[0.02] px-2 py-2 sm:px-2.5 sm:py-2.5">
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
  const actionLabel = signal.actionShort || signal.action
  const sectorLine = signal.sectors?.length ? signal.sectors.join("\u00b7") : "\u2014"
  const stateLine = [signal.marketState, signal.marketContext].filter(Boolean).join(" \u00b7 ") || "\u2014"

  return (
    <article
      className={[
        "flex flex-col rounded-md border bg-[#060910]/95 px-2.5 py-2",
        timingScoreBorderClass(score),
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400">{signal.label}</p>
        <p
          className={`m-0 font-mono text-[22px] font-bold tabular-nums leading-none ${timingScoreTextClass(score)}`}
        >
          {score}
        </p>
      </div>

      <div className="mt-1.5 h-0.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={["h-full rounded-full transition-all", timingScoreBarClass(score)].join(" ")}
          style={{ width: `${Math.max(4, Math.min(100, score))}%` }}
        />
      </div>

      <p className="m-0 mt-1.5 text-[11px] font-bold leading-tight text-slate-50">{actionLabel}</p>

      {signal.allocations?.length > 0 ? (
        <div className="mt-1.5 border-t border-white/[0.05] pt-1.5">
          <p className="m-0 text-[7px] font-semibold uppercase tracking-[0.08em] text-slate-500">추천 비중</p>
          <ul className="m-0 mt-1 grid list-none grid-cols-2 gap-x-2 gap-y-1 p-0">
            {signal.allocations.map((row) => (
              <li key={row.label} className="min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-[8px] font-medium text-slate-500">{row.label}</span>
                  <span className="shrink-0 font-mono text-[9px] font-bold tabular-nums text-slate-300">
                    {row.pct}
                  </span>
                </div>
                <div className="mt-px h-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={[
                      "h-full rounded-full transition-all duration-300",
                      allocationBarClass(row.label),
                    ].join(" ")}
                    style={{ width: `${row.pct}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-1.5 flex flex-wrap gap-1 border-t border-white/[0.05] pt-1.5">
        <MetaBadge variant="state">{stateLine}</MetaBadge>
        <MetaBadge variant="sector">{sectorLine}</MetaBadge>
        <MetaBadge variant="risk">{signal.risk || "\u2014"}</MetaBadge>
      </div>
    </article>
  )
}

/** @param {{ variant: "state" | "sector" | "risk"; children: import("react").ReactNode }} props */
function MetaBadge({ variant, children }) {
  const styles = {
    state: "border-slate-500/25 bg-slate-500/10 text-slate-300",
    sector: "border-cyan-500/25 bg-cyan-500/10 text-cyan-200/90",
    risk: "border-orange-500/25 bg-orange-500/10 text-orange-200/85",
  }
  return (
    <span
      className={[
        "inline-flex max-w-full items-center rounded border px-1.5 py-px text-[9px] font-medium leading-snug",
        styles[variant],
      ].join(" ")}
    >
      <span className="truncate">{children}</span>
    </span>
  )
}
