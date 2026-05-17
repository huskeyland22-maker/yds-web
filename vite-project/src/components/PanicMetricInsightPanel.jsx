import { useMemo } from "react"
import { buildMetricInsightBrief } from "../utils/panicMetricInsightBrief.js"
import {
  interpretTonePanelClass,
  interpretToneTextClass,
} from "../utils/panicMetricInterpretation.js"

/**
 * @param {{
 *   metricKey: string
 *   currentValue: unknown
 *   historyRows?: object[]
 *   panicData?: object | null
 * }} props
 */
export default function PanicMetricInsightPanel({
  metricKey,
  currentValue,
  historyRows = [],
  panicData = null,
}) {
  const brief = useMemo(
    () => buildMetricInsightBrief(metricKey, currentValue, { historyRows, panicData }),
    [metricKey, currentValue, historyRows, panicData],
  )

  if (!brief) {
    return (
      <div className="border-t border-white/[0.06] px-3 py-2.5">
        <p className="m-0 text-[10px] text-slate-500">지표 데이터가 없어 해석을 표시할 수 없습니다.</p>
      </div>
    )
  }

  const changeTone =
    brief.changePct == null
      ? "text-slate-500"
      : brief.changePct > 0
        ? metricKey === "fearGreed" || metricKey === "bofa" || metricKey === "gsBullBear"
          ? "text-cyan-300"
          : "text-orange-300"
        : metricKey === "fearGreed" || metricKey === "bofa" || metricKey === "gsBullBear"
          ? "text-orange-300"
          : "text-cyan-300"

  return (
    <div
      className={[
        "border-t px-3 py-3 sm:px-3.5 sm:py-3.5",
        interpretTonePanelClass(brief.tone),
      ].join(" ")}
      role="region"
      aria-label={`${brief.metricTitle} 시장 해석`}
    >
      <p className={`m-0 text-[11px] font-bold ${interpretToneTextClass(brief.tone)}`}>
        [{brief.metricTitle} 해석]
      </p>

      <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">현재</span>
        <span className="font-mono text-[18px] font-bold tabular-nums leading-none text-slate-100">
          {brief.valueText}
        </span>
        {brief.changeLabel ? (
          <span className={`font-mono text-[11px] font-semibold tabular-nums ${changeTone}`}>
            {brief.changeLabel}
          </span>
        ) : null}
        {brief.changeContext ? (
          <span className="text-[10px] text-slate-400">{brief.changeContext}</span>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <BriefRow label="상태" value={brief.statusDisplay} tone={brief.tone} />
        <BriefRow label="단기" value={brief.shortLine} />
        <BriefRow label="중기" value={brief.midLine} />
        <BriefRow label="장기" value={brief.longLine} />
        <BriefRow label="리스크" value={brief.riskLine} warn className="sm:col-span-2" />
      </div>

      <div className="mt-3 border-t border-white/[0.07] pt-2.5">
        <p className="m-0 text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          현재 매매 우선순위
        </p>
        <p className="m-0 mt-1 text-[11px] font-semibold leading-relaxed text-amber-200/90">
          {brief.tradePriority}
        </p>
      </div>
    </div>
  )
}

/**
 * @param {{
 *   label: string
 *   value: string
 *   tone?: import("../utils/panicMetricInterpretation.js").InterpretTone
 *   warn?: boolean
 *   className?: string
 * }} props
 */
function BriefRow({ label, value, tone, warn = false, className = "" }) {
  const valueClass = warn
    ? "text-orange-200/90"
    : tone
      ? interpretToneTextClass(tone)
      : "text-slate-200"

  return (
    <div
      className={[
        "rounded border border-white/[0.05] bg-black/20 px-2 py-1.5",
        className,
      ].join(" ")}
    >
      <p className="m-0 text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className={`m-0 mt-1 text-[10px] leading-relaxed ${valueClass}`}>{value}</p>
    </div>
  )
}
