import {
  interpretPanicMetric,
  interpretToneBadgeClass,
  interpretTonePanelClass,
  interpretToneTextClass,
} from "../utils/panicMetricInterpretation.js"

/**
 * @param {{
 *   metricKey: string
 *   currentValue: unknown
 *   historyRows?: object[]
 * }} props
 */
export default function PanicMetricInsightPanel({ metricKey, currentValue, historyRows = [] }) {
  const insight = interpretPanicMetric(metricKey, currentValue, { historyRows })

  if (!insight) {
    return (
      <div className="border-t border-white/[0.06] px-3 py-2.5">
        <p className="m-0 text-[10px] text-slate-500">지표 데이터가 없어 해석을 표시할 수 없습니다.</p>
      </div>
    )
  }

  return (
    <div
      className={[
        "border-t px-3 py-2.5 sm:px-3.5 sm:py-3",
        interpretTonePanelClass(insight.tone),
      ].join(" ")}
      role="region"
      aria-label={`${insight.metricTitle} 시장 해석`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className={`m-0 text-[11px] font-bold ${interpretToneTextClass(insight.tone)}`}>
          [{insight.metricTitle} 해석]
        </p>
        <span
          className={[
            "rounded border px-1.5 py-px text-[9px] font-semibold tracking-wide",
            interpretToneBadgeClass(insight.tone),
          ].join(" ")}
        >
          {insight.statusLabel}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-slate-500">{insight.valueText}</span>
      </div>
      <p className={`m-0 mt-1.5 text-[11px] font-semibold leading-snug ${interpretToneTextClass(insight.tone)}`}>
        {insight.headline}
      </p>
      <p className="m-0 mt-1 text-[10px] leading-relaxed text-slate-400">{insight.body}</p>
    </div>
  )
}
