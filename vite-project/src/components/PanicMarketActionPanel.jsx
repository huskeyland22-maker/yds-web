import { useMemo } from "react"
import {
  actionModeBadgeClass,
  computeMarketAction,
  marketTemperatureBarClass,
  regimeToneClass,
} from "../utils/panicMarketActionEngine.js"

const SECTOR_CHIP =
  "rounded border px-1.5 py-px text-[9px] font-semibold border-white/10 bg-white/[0.05] text-slate-300"

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
  const bullets = [
    guide.strategyThesis,
    `단기 ${guide.shortTerm.replace(/눌림 매수 가능|매수 가능/g, "눌림").slice(0, 12)}`,
    `중기 ${guide.midTerm.replace(/비중 확대 가능| 가능/g, "").slice(0, 10)}`,
    `장기 ${guide.longTerm.replace(/추세 추종 유효|과열 전 — /g, "").slice(0, 8)}`,
  ].filter(Boolean)

  return (
    <div className="border-t border-white/[0.06] px-2 py-2">
      <p className="m-0 mb-1.5 border-l-2 border-cyan-400/35 pl-1.5 text-[10px] font-bold text-slate-300">
        시장 액션
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <article className="rounded border border-white/[0.07] bg-[#070a10] px-2 py-1.5">
          <p className="m-0 text-[8px] font-semibold uppercase text-slate-500">시장 온도</p>
          <p className={`m-0 mt-0.5 font-mono text-[20px] font-bold tabular-nums ${regimeToneClass(guide.regime)}`}>
            {temp}
          </p>
          <span className={`mt-0.5 inline-block text-[9px] font-bold ${actionModeBadgeClass(guide.actionMode)}`}>
            {guide.regimeLabel} · {guide.actionMode}
          </span>
          <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-gradient-to-r from-rose-600/45 via-slate-500/30 to-cyan-500/50">
            <div
              className={[
                "absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-white/80",
                marketTemperatureBarClass(temp),
              ].join(" ")}
              style={{ left: `calc(${Math.max(4, Math.min(96, temp))}% - 5px)` }}
            />
          </div>
        </article>

        <article className="rounded border border-white/[0.07] bg-[#070a10] px-2 py-1.5">
          <p className="m-0 text-[8px] font-semibold uppercase text-slate-500">행동 전략</p>
          <ul className="m-0 mt-1 list-none space-y-0.5 p-0">
            {bullets.map((line) => (
              <li key={line} className="text-[9px] leading-snug text-slate-300 before:mr-1 before:content-['•']">
                {line}
              </li>
            ))}
          </ul>
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
