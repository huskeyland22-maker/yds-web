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
      <div className="border-b border-white/[0.06] px-2 py-1.5">
        <p className="m-0 text-[9px] text-slate-500">지표 데이터 없음</p>
      </div>
    )
  }

  const rows = [
    { label: "상태", value: brief.statusDisplay, tone: brief.tone },
    { label: "단기", value: brief.shortLine },
    { label: "중기", value: brief.midLine },
    { label: "리스크", value: brief.riskLine },
    { label: "섹터", value: brief.tradePriority?.replace(/현재 매매 우선순위[:\s]*/i, "") ?? brief.longLine },
  ]

  return (
    <div
      className={[
        "border-b px-2 py-1.5 sm:px-2.5",
        interpretTonePanelClass(brief.tone),
      ].join(" ")}
      role="region"
      aria-label={`${brief.metricTitle} 해석`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <p className={`m-0 text-[10px] font-bold ${interpretToneTextClass(brief.tone)}`}>
          {brief.metricTitle} · {brief.valueText}
          {brief.changeLabel ? (
            <span className="ml-1 font-mono text-[9px] font-normal text-slate-400">{brief.changeLabel}</span>
          ) : null}
        </p>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-5">
        {rows.map((r) => (
          <div key={r.label} className="flex min-w-0 items-baseline gap-1.5 text-[9px] leading-snug">
            <span className="shrink-0 text-slate-500">{r.label}</span>
            <span
              className={[
                "truncate font-medium",
                r.tone ? interpretToneTextClass(r.tone) : "text-slate-200",
              ].join(" ")}
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
