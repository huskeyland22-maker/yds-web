import { formatCurrent, formatDelta, slopeLabelKo } from "../../macro-risk/displayMetrics.js"
import { slopeArrow } from "../../macro-risk/seriesMath.js"

const STANCE_COLOR = {
  up: "text-rose-300/90",
  down: "text-emerald-300/90",
  flat: "text-slate-400",
}

/**
 * @param {{ metrics?: import("../../macro-risk/displayMetrics.js").MetricDisplayRow[]; title?: string }} props
 */
export default function MacroRiskChangeRates({ metrics = [], title = "변화율" }) {
  if (!metrics.length) return null

  return (
    <div className="mt-2 border-t border-white/[0.06] pt-2">
      <p className="m-0 text-[10px] font-semibold tracking-[0.08em] text-slate-500">{title}</p>
      <div className="mt-1.5 space-y-2">
        {metrics.map((row) => (
          <div
            key={row.key}
            className="rounded-md border border-white/[0.05] bg-black/15 px-2 py-1.5"
            title={row.tooltip ?? undefined}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
              <span className="min-w-0" title={row.tooltip ?? undefined}>
                <span className="text-[11px] font-semibold text-slate-200">{row.label}</span>
                {row.category ? (
                  <span className="ml-1.5 text-[9px] font-medium text-slate-500">{row.category}</span>
                ) : null}
              </span>
              <span className="font-mono text-[12px] font-bold tabular-nums text-slate-100">
                {formatCurrent(row.current, row.format)}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-[10px] tabular-nums text-slate-400">
              {!row.hide1D ? <span>1D {formatDelta(row.change1D, row.format, row.current)}</span> : null}
              <span>5D {formatDelta(row.change5D, row.format, row.current)}</span>
              <span>20D {formatDelta(row.change20D, row.format, row.current)}</span>
              <span className={STANCE_COLOR[row.slope] ?? STANCE_COLOR.flat}>
                {slopeArrow(row.slope)} {slopeLabelKo(row.slope)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
