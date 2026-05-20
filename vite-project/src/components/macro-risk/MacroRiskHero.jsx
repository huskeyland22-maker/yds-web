import { useState } from "react"

const METRIC_NAME = {
  US10Y: "10Y",
  REAL_YIELD: "REAL",
  DXY: "DXY",
  MOVE: "MOVE",
  US30Y: "30Y",
  BEI: "BEI",
  VXN: "VXN",
  US2Y: "2Y",
}

/**
 * @param {{ snapshot: import("../../macro-risk/engine.js").MacroRiskSnapshot }} props
 */
export default function MacroRiskHero({ snapshot }) {
  const [showBreakdown, setShowBreakdown] = useState(false)
  const breakdown = snapshot.scoreBreakdown

  return (
    <section className="macro-risk-hero trading-card-shell overflow-hidden px-3 py-3 sm:px-4 sm:py-4">
      <p className="m-0 text-[9px] font-semibold tracking-[0.18em] text-slate-500">MACRO RISK SCORE</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="m-0 text-[11px] font-medium text-slate-400">Macro Risk</p>
          <p className="m-0 font-mono text-[2rem] font-bold leading-none tabular-nums text-slate-50 sm:text-[2.25rem]">
            {snapshot.score}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-slate-300">
          {snapshot.pillarChips.map((p) => (
            <span key={p.key} className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1">
              {p.label} {p.emoji}
            </span>
          ))}
        </div>
      </div>
      <p className="m-0 mt-2 text-[13px] font-semibold text-slate-100">{snapshot.headline}</p>
      <p className="m-0 mt-0.5 text-[12px] text-slate-400">{snapshot.subheadline}</p>
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setShowBreakdown((v) => !v)}
          className="rounded-md border border-white/[0.1] bg-white/[0.03] px-2 py-1 text-[10px] font-semibold text-slate-200"
        >
          왜 {snapshot.score}? {showBreakdown ? "닫기" : "점수 계산 공개"}
        </button>
      </div>
      {showBreakdown && breakdown ? (
        <div className="mt-3 space-y-2 border-t border-white/[0.06] pt-3 text-[10px]">
          <p className="m-0 font-semibold tracking-[0.08em] text-slate-300">SCORE BREAKDOWN</p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {breakdown.sections.map((sec) => (
              <div key={sec.id} className="rounded-md border border-white/[0.06] bg-black/20 px-2 py-2">
                <p className="m-0 font-semibold text-slate-200">{sec.title}</p>
                {sec.items.map((it) => (
                  <p key={`${sec.id}-${it.label}`} className="m-0 mt-0.5 text-slate-400">
                    {it.label} {Number(it.points) >= 0 ? `+${it.points}` : it.points}
                  </p>
                ))}
                <p className="m-0 mt-1 font-semibold text-slate-200">총: {sec.total}</p>
              </div>
            ))}
          </div>
          <div className="rounded-md border border-white/[0.06] bg-black/20 px-2 py-2">
            <p className="m-0 font-semibold text-slate-200">
              Macro = {breakdown.formula.base} + 이벤트 {breakdown.formula.events} = {breakdown.formula.macro}
            </p>
            <p className="m-0 text-slate-400">Tier1 = {breakdown.formula.tier1} / Tier2 = {breakdown.formula.tier2}</p>
          </div>
          <div className="rounded-md border border-white/[0.06] bg-black/20 px-2 py-2">
            <p className="m-0 font-semibold text-slate-200">metric audit</p>
            {breakdown.metrics.map((m) => (
              <p key={m.key} className="m-0 mt-0.5 text-slate-400">
                {METRIC_NAME[m.key] ?? m.key} current:{fmt(m.current)} 1D:{fmt(m.delta1D)} 5D:{fmt(m.delta5D)} 20D:{fmt(m.delta20D)} raw:{fmt(m.raw)} normalized:{fmt(m.normalized)} score:{m.score}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function fmt(v) {
  return Number.isFinite(Number(v)) ? Number(v).toFixed(2) : "—"
}
