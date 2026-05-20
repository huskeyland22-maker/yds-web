import { useMemo } from "react"
import {
  dangerProgressPct,
  fearProgressPct,
  resolveCyclePosition,
  resolveMacroPosition,
} from "../../market-os/positionLabels.js"
import { scoreBarClass, scoreTextClass } from "../../macro-risk/macroRiskUiTone.js"
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
      <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
        <PositionBlock
          title="Cycle"
          score={cycleScore}
          subtitle={`${cyclePos.phaseLine} · 반전대기`}
          positionLabel={cyclePos.position}
          emoji={cyclePos.emoji}
          gaugeLabel="공포 → 중립 진행률"
          gaugePercent={cycleToNeutralPct}
          gaugeTransition={30}
          toneScore={cycleScore ?? 0}
          footnote={
            cycleScore == null
              ? null
              : Number(cycleScore) <= 35
                ? `30 근처까지 ${Math.max(0, Math.round(30 - Number(cycleScore)))}pt`
                : "중립권 또는 그 이상"
          }
        />
        <PositionBlock
          title="Macro"
          score={snapshot.score}
          subtitle={macroPhaseLabel ? `${macroPhaseLabel} 국면` : macroPos.phaseLine}
          positionLabel={macroPos.position}
          emoji={macroPos.emoji}
          gaugeLabel="위험영역 진행률"
          gaugePercent={macroDangerPct}
          gaugeTransition={80}
          toneScore={snapshot.score}
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
  title,
  score,
  subtitle,
  positionLabel,
  emoji,
  gaugeLabel,
  gaugePercent,
  gaugeTransition,
  toneScore,
  footnote,
}) {
  const s = Number(score)
  const value = Number.isFinite(s) ? Math.min(100, Math.max(0, s)) : null
  const barCls = scoreBarClass(Number.isFinite(toneScore) ? toneScore : s ?? 0)

  return (
    <div className="rounded-lg border border-white/[0.07] bg-black/22 px-2.5 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="m-0 text-[11px] font-semibold text-slate-200">
          {title}{" "}
          <span className={`font-mono tabular-nums ${scoreTextClass(s)}`}>{score == null ? "—" : Math.round(s)}</span>
        </p>
        <span className="text-sm" aria-hidden>
          {emoji}
        </span>
      </div>
      <p className="m-0 mt-0.5 text-[10px] leading-snug text-slate-400">{subtitle}</p>
      <p className="m-0 mt-1 text-[10px] text-slate-500">
        포지션: <span className="text-slate-300">{positionLabel}</span>
      </p>

      {value != null ? (
        <HorizontalGauge value={value} transitionAt={gaugeTransition} gradientClass={barCls} />
      ) : (
        <p className="m-0 mt-2 text-[10px] text-slate-600">게이지 · 데이터 대기</p>
      )}

      <p className="m-0 mt-2 text-[10px] text-slate-500">{gaugeLabel}</p>
      <p className="m-0 font-mono text-[11px] font-semibold tabular-nums text-slate-200">
        {gaugePercent == null ? "—" : `${gaugePercent}%`}
      </p>
      {footnote ? <p className="m-0 mt-1 text-[9px] text-slate-600">{footnote}</p> : null}
    </div>
  )
}

/**
 * @param {{ value: number; transitionAt: number; gradientClass: string }} props
 */
function HorizontalGauge({ value, transitionAt, gradientClass }) {
  const v = Math.min(100, Math.max(0, value))
  const tick = Math.min(100, Math.max(0, transitionAt))
  return (
    <div className="mt-2">
      <div className="flex justify-between font-mono text-[9px] tabular-nums text-slate-600">
        <span>0</span>
        <span className="text-slate-500">{tick}</span>
        <span>100</span>
      </div>
      <div className="relative mt-1 h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${gradientClass}`}
          style={{ width: `${v}%` }}
        />
        <div
          className="pointer-events-none absolute top-0 bottom-0 w-px bg-white/50"
          style={{ left: `${tick}%`, transform: "translateX(-50%)" }}
          title="전환·기준선"
        />
        <div
          className="pointer-events-none absolute -top-1 h-0 w-0 translate-x-[-50%] border-x-[4px] border-x-transparent border-b-[5px] border-b-slate-200"
          style={{ left: `${v}%` }}
        />
      </div>
      <p className="m-0 mt-0.5 text-center font-mono text-[9px] tabular-nums text-slate-500">
        0 ····· {Math.round(v)} ····· 100
      </p>
    </div>
  )
}

