import { useState } from "react"
import { scoreBandLabel, scoreTextClass } from "../../macro-risk/macroRiskUiTone.js"

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
 * @param {{ snapshot: import("../../macro-risk/engine.js").MacroRiskSnapshot; macroDevUi?: boolean }} props
 */
export default function MacroRiskHero({ snapshot, macroDevUi = false }) {
  const [showBreakdown, setShowBreakdown] = useState(false)
  const breakdown = snapshot.scoreBreakdown
  const base = Number(breakdown?.formula?.base)
  const deltaVsBase = Number.isFinite(base) ? Math.round(Number(snapshot.score) - base) : null
  const trend =
    deltaVsBase == null
      ? { label: "추세", text: "—", arrow: "→" }
      : deltaVsBase > 2
        ? { label: "추세", text: "상승 압력", arrow: "↑" }
        : deltaVsBase < -2
          ? { label: "추세", text: "하락 완화", arrow: "↓" }
          : { label: "추세", text: "베이스 수렴", arrow: "→" }

  const ratePillar = snapshot.pillars.find((p) => p.id === "rate")
  const phaseHeadline = String(snapshot.headline ?? "").replace(/\s*이벤트\s*$/u, "").trim() || "—"
  const impactLine = ratePillar?.status ?? "매크로 혼합"

  return (
    <section className="macro-risk-hero trading-card-shell overflow-hidden px-3 py-3 sm:px-4 sm:py-3.5">
      <p className="m-0 text-[9px] font-semibold tracking-[0.18em] text-slate-500">TOP SUMMARY · MACRO RISK</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-[11px] font-medium text-slate-400">Macro Risk</p>
          <p
            className={`m-0 font-mono text-[2rem] font-bold leading-none tabular-nums sm:text-[2.1rem] ${scoreTextClass(snapshot.score)}`}
          >
            {snapshot.score}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <div className="flex flex-wrap justify-end gap-1.5 text-[10px] font-semibold text-slate-300">
            {snapshot.pillarChips.map((p) => (
              <span key={p.key} className="rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5">
                {p.label} {p.emoji}
              </span>
            ))}
          </div>
          <p className="m-0 text-[10px] text-slate-500">
            {trend.arrow} {trend.text}
            {deltaVsBase != null ? (
              <span className="ml-2 font-mono text-slate-400">
                베이스 대비 {deltaVsBase >= 0 ? `+${deltaVsBase}` : deltaVsBase}
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 border-t border-white/[0.06] pt-3 sm:grid-cols-2">
        <div className="rounded-md border border-white/[0.06] bg-black/20 px-2.5 py-2">
          <p className="m-0 text-[9px] font-semibold uppercase tracking-wide text-slate-500">현재 국면</p>
          <p className="m-0 mt-0.5 text-[12px] font-semibold text-slate-100">{phaseHeadline}</p>
        </div>
        <div className="rounded-md border border-white/[0.06] bg-black/20 px-2.5 py-2">
          <p className="m-0 text-[9px] font-semibold uppercase tracking-wide text-slate-500">위험등급</p>
          <p className={`m-0 mt-0.5 text-[12px] font-semibold ${scoreTextClass(snapshot.score)}`}>
            {scoreBandLabel(snapshot.score)}
          </p>
        </div>
        <div className="rounded-md border border-white/[0.06] bg-black/20 px-2.5 py-2">
          <p className="m-0 text-[9px] font-semibold uppercase tracking-wide text-slate-500">시장 영향</p>
          <p className="m-0 mt-0.5 text-[12px] font-medium text-slate-200">{impactLine}</p>
        </div>
        <div className="rounded-md border border-white/[0.06] bg-black/20 px-2.5 py-2">
          <p className="m-0 text-[9px] font-semibold uppercase tracking-wide text-slate-500">행동</p>
          <p className="m-0 mt-0.5 text-[12px] font-semibold text-cyan-200/90">{snapshot.tactical}</p>
        </div>
      </div>

      <p className="m-0 mt-2 text-[11px] text-slate-500">{snapshot.subheadline}</p>

      {macroDevUi && breakdown ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowBreakdown((v) => !v)}
            className="rounded-md border border-white/[0.1] bg-white/[0.03] px-2 py-1 text-[10px] font-semibold text-slate-200"
          >
            Score breakdown / metric audit {showBreakdown ? "닫기" : "열기"}
          </button>
        </div>
      ) : null}
      {macroDevUi && showBreakdown && breakdown ? (
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
            <p className="m-0 font-semibold text-slate-200">metric audit (normalized / raw)</p>
            {breakdown.metrics.map((m) => (
              <p key={m.key} className="m-0 mt-0.5 text-slate-400">
                {METRIC_NAME[m.key] ?? m.key} cur:{fmt(m.current)} 1D:{fmt(m.delta1D)} 5D:{fmt(m.delta5D)} 20D:
                {fmt(m.delta20D)} raw:{fmt(m.raw)} norm:{fmt(m.normalized)} pts:{m.score}
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
