/** 모바일 /cycle 상단 — 시장 단계 + 핵심 시그널 (컴팩트) */
export default function MobileMarketOverview({ context, asOfDateLabel }) {
  if (!context) return null
  const stageLabel = context.stageLabel ?? "—"
  const keySignal = context.keySignal ?? {}

  return (
    <section className="trading-card-shell px-2.5 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="m-0 text-[9px] font-semibold tracking-[0.14em] text-slate-500">시장 단계</p>
          <p className="m-0 mt-0.5 truncate text-[15px] font-semibold leading-tight text-slate-100">{stageLabel}</p>
        </div>
        <p className="m-0 shrink-0 font-mono text-[9px] text-slate-600">{asOfDateLabel}</p>
      </div>
      <dl className="m-0 mt-2 grid grid-cols-2 gap-x-2 gap-y-1 border-t border-white/[0.06] pt-2 text-[10px]">
        <div className="flex justify-between gap-1">
          <dt className="text-slate-500">위험</dt>
          <dd className="m-0 font-medium text-slate-200">{keySignal.riskAppetite ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-1">
          <dt className="text-slate-500">분위기</dt>
          <dd className="m-0 truncate font-medium text-slate-200">{keySignal.marketMood ?? "—"}</dd>
        </div>
        <div className="col-span-2 flex justify-between gap-1 border-t border-white/[0.04] pt-1">
          <dt className="text-slate-500">주도</dt>
          <dd className="m-0 truncate text-right font-medium text-indigo-200/90">{keySignal.leadingSector ?? "—"}</dd>
        </div>
      </dl>
    </section>
  )
}
