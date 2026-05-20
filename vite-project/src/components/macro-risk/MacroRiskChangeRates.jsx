import { formatCurrent, slopeLabelKo } from "../../macro-risk/displayMetrics.js"
import { formatDeltaByMethod, inferDeltaMethod } from "../../macro-risk/deltaSemantics.js"
import { DATA_BADGE_CLASS } from "../../macro-risk/metricSourceCatalog.js"
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
        {metrics.map((row) => {
          const fmt = row.format === "pct" ? "level" : row.format
          return (
            <div
              key={row.key}
              className="rounded-md border border-white/[0.05] bg-black/15 px-2 py-1.5"
              title={row.tooltip ?? undefined}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <span className="min-w-0 flex flex-wrap items-center gap-1.5" title={row.tooltip ?? undefined}>
                  <span className="text-[11px] font-semibold text-slate-200">{row.label}</span>
                  {row.dataBadge ? (
                    <span
                      className={[
                        "rounded px-1 py-px text-[8px] font-bold tracking-wide",
                        DATA_BADGE_CLASS[row.dataBadge] ?? DATA_BADGE_CLASS.MOCK,
                      ].join(" ")}
                    >
                      {row.dataBadge}
                    </span>
                  ) : null}
                  {row.category ? (
                    <span className="text-[9px] font-medium text-slate-500">{row.category}</span>
                  ) : null}
                </span>
                <span className="font-mono text-[12px] font-bold tabular-nums text-slate-100">
                  {row.current == null || !Number.isFinite(Number(row.current)) ? "—" : formatCurrent(row.current, fmt)}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-[10px] tabular-nums text-slate-400">
                {!row.hide1D && row.change1D != null ? (
                  <span>
                    1D{" "}
                    {formatDeltaByMethod(
                      row.change1D,
                      inferDeltaMethod(row.key, row.current, row.change1D, "1D"),
                      fmt,
                    )}
                  </span>
                ) : null}
                {row.deltaHorizonNA ? (
                  <span className="text-slate-500">
                    5D N/A · 20D N/A
                  </span>
                ) : (
                  <>
                    {row.change5D != null ? (
                      <span>
                        5D{" "}
                        {formatDeltaByMethod(
                          row.change5D,
                          inferDeltaMethod(row.key, row.current, row.change5D, "5D"),
                          fmt,
                        )}
                      </span>
                    ) : null}
                    {row.change20D != null ? (
                      <span>
                        20D{" "}
                        {formatDeltaByMethod(
                          row.change20D,
                          inferDeltaMethod(row.key, row.current, row.change20D, "20D"),
                          fmt,
                        )}
                      </span>
                    ) : null}
                  </>
                )}
                {!row.deltaHorizonNA ? (
                  <span className={STANCE_COLOR[row.slope] ?? STANCE_COLOR.flat}>
                    {slopeArrow(row.slope)} {slopeLabelKo(row.slope)}
                  </span>
                ) : (
                  <span className="text-slate-600">—</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
