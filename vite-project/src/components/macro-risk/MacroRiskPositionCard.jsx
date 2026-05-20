import { useMemo } from "react"
import {
  dangerProgressPct,
  fearProgressPct,
  resolveCyclePosition,
  resolveMacroPosition,
} from "../../market-os/positionLabels.js"
import { getFinalScore } from "../../utils/tradingScores.js"

/**
 * @param {{ snapshot: import("../../macro-risk/engine.js").MacroRiskSnapshot; panicData?: object | null }} props
 */
export default function MacroRiskPositionCard({ snapshot, panicData = null }) {
  const cycleScore = useMemo(() => (panicData ? getFinalScore(panicData) : null), [panicData])
  const cyclePos = resolveCyclePosition(cycleScore)
  const macroPos = resolveMacroPosition(snapshot.score)
  const macroPast = Number(snapshot?.scoreBreakdown?.formula?.base)

  const cycleToNeutralPct = fearProgressPct(cycleScore)
  const macroDangerPct = dangerProgressPct(snapshot.score)

  const macroPhaseLabel = String(snapshot.headline ?? "")
    .replace(/\s*이벤트\s*$/u, "")
    .trim()

  return (
    <section className="trading-card-shell px-4 py-4">
      <p className="m-0 text-[9px] font-semibold tracking-[0.18em] text-slate-500">MARKET POSITION</p>
      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
        <PositionBlock
          variant="cycle"
          title="Cycle"
          score={cycleScore}
          subtitle={`${cyclePos.phaseLine} · 반전대기`}
          positionLabel={cyclePos.position}
          emoji={cyclePos.emoji}
          gaugeLabel="공포 → 중립 진행률"
          gaugePercent={cycleToNeutralPct}
          footnote={
            cycleScore == null
              ? null
              : Number(cycleScore) <= 35
                ? `30 근처까지 ${Math.max(0, Math.round(30 - Number(cycleScore)))}pt`
                : "중립권 또는 그 이상"
          }
        />
        <PositionBlock
          variant="macro"
          title="Macro"
          score={snapshot.score}
          subtitle={macroPhaseLabel ? `${macroPhaseLabel} 국면` : macroPos.phaseLine}
          positionLabel={macroPos.position}
          emoji={macroPos.emoji}
          gaugeLabel="위험영역 진행률"
          gaugePercent={macroDangerPct}
          footnote={
            Number.isFinite(macroPast) ? `베이스(이벤트 제외) ${Math.round(macroPast)}` : "베이스 데이터 없음"
          }
        />
      </div>
    </section>
  )
}

/**
 * @param {object} p
 */
function PositionBlock({
  variant,
  title,
  score,
  subtitle,
  positionLabel,
  emoji,
  gaugeLabel,
  gaugePercent,
  footnote,
}) {
  const s = Number(score)
  const value = Number.isFinite(s) ? Math.min(100, Math.max(0, s)) : null

  return (
    <div className="min-w-0 rounded-lg border border-white/[0.07] bg-black/22 px-2.5 py-2.5">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <p className="m-0 truncate text-[11px] font-semibold text-slate-200">{title}</p>
        <span className="shrink-0 text-sm" aria-hidden>
          {emoji}
        </span>
      </div>
      <p className="m-0 mt-0.5 truncate text-[10px] leading-snug text-slate-400">{subtitle}</p>
      <p className="m-0 mt-1 truncate text-[10px] text-slate-500">
        포지션: <span className="text-slate-300">{positionLabel}</span>
      </p>

      {value != null ? (
        <PositionSlider value={value} variant={variant} />
      ) : (
        <p className="m-0 mt-2 text-[10px] text-slate-600">게이지 · 데이터 대기</p>
      )}

      <div className="mt-2 min-w-0 border-t border-white/[0.05] pt-2">
        <p className="m-0 truncate text-[10px] text-slate-500">{gaugeLabel}</p>
        <p className="m-0 font-mono text-[11px] font-semibold tabular-nums text-slate-200">
          {gaugePercent == null ? "—" : `${gaugePercent}%`}
        </p>
        {footnote ? <p className="m-0 mt-1 truncate text-[9px] text-slate-600">{footnote}</p> : null}
      </div>
    </div>
  )
}

/**
 * bar → current marker → (진행률은 PositionBlock 하단)
 * @param {{ value: number; variant: "cycle" | "macro" }} props
 */
function PositionSlider({ value, variant }) {
  const v = Math.min(100, Math.max(0, value))
  const rounded = Math.round(v)
  const isCycle = variant === "cycle"

  const fillCls = isCycle ? "bg-emerald-500/35" : "bg-rose-500/35"
  const dotCls = isCycle
    ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.55)] ring-2 ring-emerald-300/30"
    : "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.55)] ring-2 ring-rose-300/30"
  const valueCls = isCycle ? "text-emerald-300" : "text-rose-300"

  return (
    <div className="macro-position-slider mt-2 flex min-w-0 items-center gap-1.5 overflow-hidden">
      <span className="shrink-0 font-mono text-[9px] tabular-nums text-slate-600">0</span>
      <div className="min-w-0 flex-1">
        <div className="relative h-2 rounded-full bg-white/[0.08]">
          <div className={`absolute inset-y-0 left-0 rounded-full ${fillCls}`} style={{ width: `${v}%` }} />
          <div
            className="pointer-events-none absolute top-1/2 z-[2] -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${v}%` }}
            aria-hidden
          >
            <span className={`block h-2.5 w-2.5 rounded-full ${dotCls}`} />
          </div>
        </div>
        <div className="relative mt-1 h-[1.125rem] w-full">
          <p
            className={`absolute m-0 -translate-x-1/2 whitespace-nowrap font-mono text-[11px] font-bold leading-none tabular-nums ${valueCls}`}
            style={{ left: `${v}%` }}
          >
            <span aria-hidden>● </span>
            {rounded}
          </p>
        </div>
      </div>
      <span className="shrink-0 font-mono text-[9px] tabular-nums text-slate-600">100</span>
    </div>
  )
}
