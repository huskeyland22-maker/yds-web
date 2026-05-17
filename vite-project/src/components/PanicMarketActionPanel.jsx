import { useMemo } from "react"
import {
  actionModeBadgeClass,
  computeMarketAction,
  regimeToneClass,
} from "../utils/panicMarketActionEngine.js"

/**
 * @param {{ panicData?: object | null }} props
 */
export default function PanicMarketActionPanel({ panicData = null }) {
  const guide = useMemo(() => computeMarketAction(panicData), [panicData])

  if (!guide) {
    return (
      <div className="border-t border-white/[0.06] px-3 py-2.5">
        <p className="m-0 text-[10px] text-slate-500">
          9대 지표 중 3개 이상 입력 시 시장 행동 가이드가 표시됩니다.
        </p>
      </div>
    )
  }

  return (
    <div className="border-t border-white/[0.06] px-2 py-2.5 sm:px-2.5 sm:py-3">
      <p className="m-0 mb-2 border-l-2 border-cyan-400/40 pl-2 text-left text-[11px] font-bold tracking-[0.02em] text-slate-300">
        시장 액션
      </p>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3 sm:gap-2">
        <article className="rounded-md border border-white/[0.08] bg-[#070a10] px-2.5 py-2">
          <p className="m-0 text-[9px] font-semibold tracking-wide text-slate-500">시장 상태</p>
          <p className={`m-0 mt-1 text-[15px] font-bold leading-tight ${regimeToneClass(guide.regime)}`}>
            {guide.regimeLabel}
          </p>
          <p className="m-0 mt-1 font-mono text-[10px] tabular-nums text-slate-500">
            종합 {guide.totalScore > 0 ? "+" : ""}
            {guide.totalScore}
            <span className="text-slate-600"> · {guide.metricCount}지표</span>
          </p>
          <span
            className={[
              "mt-1.5 inline-block rounded border px-1.5 py-px text-[10px] font-bold",
              actionModeBadgeClass(guide.actionMode),
            ].join(" ")}
          >
            {guide.actionMode}
          </span>
        </article>

        <article className="rounded-md border border-white/[0.08] bg-[#070a10] px-2.5 py-2">
          <p className="m-0 text-[9px] font-semibold tracking-wide text-slate-500">행동 전략</p>
          <p className="m-0 mt-1 text-[11px] font-semibold leading-snug text-slate-100">{guide.actionHeadline}</p>
          <ul className="m-0 mt-1.5 list-none space-y-0.5 p-0 text-[10px] leading-snug text-slate-400">
            <li>
              <span className="text-slate-500">단기 · </span>
              {guide.shortTerm}
            </li>
            <li>
              <span className="text-slate-500">중기 · </span>
              {guide.midTerm}
            </li>
            <li>
              <span className="text-slate-500">장기 · </span>
              {guide.longTerm}
            </li>
          </ul>
        </article>

        <article className="rounded-md border border-white/[0.08] bg-[#070a10] px-2.5 py-2">
          <p className="m-0 text-[9px] font-semibold tracking-wide text-slate-500">우위 섹터</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {guide.sectors.map((s) => (
              <span
                key={s}
                className="rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-px text-[10px] font-medium text-slate-300"
              >
                {s}
              </span>
            ))}
          </div>
        </article>
      </div>
    </div>
  )
}
