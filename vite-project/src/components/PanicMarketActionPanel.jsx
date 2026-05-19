import { useMemo } from "react"
import {
  actionModeBadgeClass,
  computeMarketAction,
  marketTemperatureBarClass,
  regimeToneClass,
} from "../utils/panicMarketActionEngine.js"

const STRATEGY_CHIP =
  "rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[9px] font-semibold text-slate-200"

const STRATEGY_CHIPS = [
  { id: "growth", label: "\uC131\uC7A5" },
  { id: "cycle", label: "\uC0AC\uC774\uD074" },
  { id: "short", label: "\uB2E8\uAE30" },
  { id: "mid", label: "\uC911\uAE30" },
]

const SECTOR_CHIP =
  "rounded-full border border-white/8 bg-white/[0.03] px-1.5 py-px text-[8px] font-medium text-slate-400"

/**
 * @param {{ panicData?: object | null }} props
 */
export default function PanicMarketActionPanel({ panicData = null }) {
  const guide = useMemo(() => computeMarketAction(panicData), [panicData])

  if (!guide) {
    return (
      <div className="border-t border-white/[0.06] px-2 py-1">
        <p className="m-0 text-[9px] text-slate-500">
          {"3\uAC1C \uC774\uC0C1 \uC9C0\uD45C \uC785\uB825 \uC2DC \uC2DC\uC7A5 \uC561\uC158 \uD45C\uC2DC"}
        </p>
      </div>
    )
  }

  const temp = guide.marketTemperature
  const barGlow =
    temp >= 58
      ? "0 0 8px rgba(34,211,238,0.35)"
      : temp <= 32
        ? "0 0 8px rgba(251,113,133,0.32)"
        : "0 0 6px rgba(148,163,184,0.22)"

  return (
    <div className="border-t border-white/[0.06] px-2 py-1.5">
      <div className="border-l-2 border-cyan-400/35 pl-1.5">
        <p className="m-0 text-[10px] font-bold text-slate-300">{"\uC2DC\uC7A5 \uC561\uC158"}</p>
      </div>

      <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr]">
        <article className="rounded border border-white/[0.06] bg-[#070a10] px-2 py-1.5">
          <p className="m-0 text-[8px] font-semibold uppercase text-slate-500">{"\uC2DC\uC7A5 \uC628\uB3C4"}</p>
          <p className={`m-0 font-mono text-[16px] font-bold tabular-nums leading-none ${regimeToneClass(guide.regime)}`}>
            {temp}
          </p>
          <span className={`text-[8px] font-bold ${actionModeBadgeClass(guide.actionMode)}`}>
            {guide.regimeLabel} {"\u00B7"} {guide.actionMode}
          </span>
          <div className="relative mt-1 h-2 overflow-hidden rounded-full bg-gradient-to-r from-rose-600/40 via-slate-500/25 to-cyan-500/40">
            <div
              className={[
                "absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-white/80",
                marketTemperatureBarClass(temp),
              ].join(" ")}
              style={{
                left: `calc(${Math.max(4, Math.min(96, temp))}% - 5px)`,
                boxShadow: barGlow,
              }}
            />
          </div>
        </article>

        <article className="flex flex-col justify-between rounded border border-white/[0.06] bg-[#070a10] px-2 py-1.5">
          <div>
            <p className="m-0 text-[8px] font-semibold uppercase text-slate-500">{"\uD589\uB3D9 \uC804\uB7B5"}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {STRATEGY_CHIPS.map((chip) => (
                <span key={chip.id} className={STRATEGY_CHIP}>
                  {chip.label}
                </span>
              ))}
            </div>
          </div>
          <p className="m-0 mt-1 line-clamp-2 text-[8px] leading-snug text-slate-500">{guide.actionHeadline}</p>
        </article>
      </div>

      <div className="mt-1.5 flex flex-wrap gap-1">
        {guide.sectors.map((s) => (
          <span key={s} className={SECTOR_CHIP}>
            {s}
          </span>
        ))}
      </div>
    </div>
  )
}
