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
 * @param {{
 *   snapshot: import("../../macro-risk/engine.js").MacroRiskSnapshot;
 *   macroDevUi?: boolean;
 *   macroDay: { yesterdayScore: number | null; todayScore: number; delta: number | null; hasYesterday: boolean };
 *   cycleDay?: { yesterdayScore: number | null; todayScore: number | null; delta: number | null; hasYesterday: boolean };
 * }} props
 */
export default function MacroRiskHero({ snapshot, macroDevUi = false, macroDay, cycleDay }) {
  const [showBreakdown, setShowBreakdown] = useState(false)
  const breakdown = snapshot.scoreBreakdown

  const ratePillar = snapshot.pillars.find((p) => p.id === "rate")
  const phaseHeadline = String(snapshot.headline ?? "").replace(/\s*이벤트\s*$/u, "").trim() || "—"
  const impactLine = ratePillar?.status ?? "매크로 혼합"
  const positionLabel = scoreBandLabel(snapshot.score)
  const tacticLine = snapshot.tactical

  const macroDeltaText = formatDelta(macroDay.delta, macroDay.hasYesterday)
  const cycleDeltaText = formatDelta(cycleDay?.delta ?? null, cycleDay?.hasYesterday ?? false)

  return (
    <section className="macro-risk-hero trading-card-shell overflow-hidden px-4 py-3">
      <p className="m-0 text-[9px] font-semibold tracking-[0.18em] text-slate-500">BOND · LIQUIDITY</p>

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <ScoreDeltaBlock
          title="Bond 보조"
          yesterday={macroDay.hasYesterday ? macroDay.yesterdayScore : null}
          today={macroDay.todayScore}
          deltaText={macroDeltaText}
          scoreClass={scoreTextClass(snapshot.score)}
        />
        <ScoreDeltaBlock
          title="Cycle"
          yesterday={cycleDay?.hasYesterday ? cycleDay.yesterdayScore : null}
          today={cycleDay?.todayScore ?? null}
          deltaText={cycleDeltaText}
          scoreClass={scoreTextClass(cycleDay?.todayScore ?? 50)}
        />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 rounded-md border border-white/[0.06] bg-black/25 px-2 py-1.5 sm:grid-cols-4">
        <SummaryCell k="현재" v={phaseHeadline} />
        <SummaryCell k="시장" v={impactLine} />
        <SummaryCell k="위치" v={positionLabel} emphasizeClass={scoreTextClass(snapshot.score)} />
        <SummaryCell k="전술" v={tacticLine} emphasizeClass="text-cyan-200/90" />
      </div>

      {macroDevUi && snapshot.subheadline ? (
        <p className="m-0 mt-2 text-[10px] text-slate-500">{snapshot.subheadline}</p>
      ) : null}

      {macroDevUi && breakdown ? (
        <div className="mt-2">
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

function ScoreDeltaBlock({ title, yesterday, today, deltaText, scoreClass }) {
  return (
    <div className="rounded-md border border-white/[0.08] bg-black/30 px-2.5 py-2">
      <p className="m-0 text-[9px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-0.5 font-mono tabular-nums">
        <span className="text-[9px] text-slate-500">
          전일 <span className="text-[11px] font-semibold text-slate-300">{yesterday ?? "—"}</span>
        </span>
        <span className="text-[9px] text-slate-500">
          오늘{" "}
          <span className={`text-[14px] font-bold leading-none ${today != null ? scoreClass : "text-slate-500"}`}>
            {today ?? "—"}
          </span>
        </span>
        <span className="text-[9px] text-slate-500">
          변화 <span className="text-[11px] font-bold text-slate-100">{deltaText}</span>
        </span>
      </div>
    </div>
  )
}

function formatDelta(delta, hasYesterday) {
  if (!hasYesterday || delta == null) return "—"
  return delta >= 0 ? `+${delta}` : `${delta}`
}

function SummaryCell({ k, v, emphasizeClass = "" }) {
  return (
    <div className="min-w-0">
      <p className="m-0 text-[8px] font-semibold uppercase tracking-wide text-slate-500">{k}</p>
      <p className={`m-0 truncate text-[10px] font-semibold leading-tight text-slate-100 ${emphasizeClass}`}>{v}</p>
    </div>
  )
}

function fmt(v) {
  return Number.isFinite(Number(v)) ? Number(v).toFixed(2) : "—"
}
