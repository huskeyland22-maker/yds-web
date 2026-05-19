import { useMemo } from "react"
import {
  actionModeBadgeClass,
  computeMarketAction,
  marketTemperatureBarClass,
  regimeToneClass,
} from "../utils/panicMarketActionEngine.js"

const STRATEGY_CHIP =
  "rounded-full border border-white/12 bg-white/[0.06] px-2 py-0.5 text-[9px] font-semibold text-slate-200"

const STRATEGY_CHIPS = [
  { id: "growth", label: "성장" },
  { id: "cycle", label: "사이클" },
  { id: "short", label: "단기" },
  { id: "mid", label: "중기" },
]

/**
 * @param {{ panicData?: object | null }} props
 */
export default function PanicMarketActionPanel({ panicData = null }) {
  const guide = useMemo(() => computeMarketAction(panicData), [panicData])

  if (!guide) {
    return (
      <div className="border-t border-white/[0.06] px-2 py-1.5">
        <p className="m-0 text-[9px] text-slate-500">3개 이상 지표 입력 시 시장 액션 표시</p>
      </div>
    )
  }

  const temp = guide.marketTemperature
  const barGlow =
    temp >= 58
      ? "0 0 12px rgba(34,211,238,0.55)"
      : temp <= 32
        ? "0 0 12px rgba(251,113,133,0.5)"
        : "0 0 10px rgba(148,163,184,0.35)"

  return (
    <div className="border-t border-white/[0.06] px-2 py-1.5">
      <p className="m-0 mb-1 border-l-2 border-cyan-400/35 pl-1.5 text-[10px] font-bold text-slate-300">
        시장 액션
      </p>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        <article className="rounded border border-white/[0.07] bg-[#070a10] px-2 py-1.5">
          <p className="m-0 text-[8px] font-semibold uppercase text-slate-500">시장 온도</p>
          <p className={`m-0 mt-0.5 font-mono text-[18px] font-bold tabular-nums ${regimeToneClass(guide.regime)}`}>
            {temp}
          </p>
          <span className={`mt-0.5 inline-block text-[9px] font-bold ${actionModeBadgeClass(guide.actionMode)}`}>
            {guide.regimeLabel} · {guide.actionMode}
          </span>
          <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-gradient-to-r from-rose-600/50 via-slate-500/35 to-cyan-500/55 shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)]">
            <div
              className={[
                "absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-white/90",
                marketTemperatureBarClass(temp),
              ].join(" ")}
              style={{
                left: `calc(${Math.max(4, Math.min(96, temp))}% - 6px)`,
                boxShadow: barGlow,
              }}
            />
          </div>
        </article>

        <article className="rounded border border-white/[0.07] bg-[#070a10] px-2 py-1.5">
          <p className="m-0 text-[8px] font-semibold uppercase text-slate-500">행동 전략</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {STRATEGY_CHIPS.map((chip) => (
              <span key={chip.id} className={STRATEGY_CHIP}>
                {chip.label}
              </span>
            ))}
          </div>
          <p className="m-0 mt-1 line-clamp-2 text-[8px] leading-snug text-slate-500">{guide.actionHeadline}</p>
        </article>
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {guide.sectors.map((s) => (
          <span
            key={s}
            className="rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-px text-[8px] font-medium text-slate-400"
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  )
}
