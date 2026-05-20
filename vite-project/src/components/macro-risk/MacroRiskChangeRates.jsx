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
    <div className="mt-4 border-t border-white/[0.06] pt-4 first:mt-0 first:border-t-0 first:pt-0">
      <p className="m-0 text-[10px] font-semibold tracking-[0.08em] text-slate-500">{title}</p>
      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
        {metrics.map((row) => {
          const fmt = row.format === "pct" ? "level" : row.format
          const currentDisplay =
            row.current == null || !Number.isFinite(Number(row.current)) ? "—" : formatCurrent(row.current, fmt)

          return (
            <div
              key={row.key}
              className="macro-risk-tier-cell flex min-h-[6.25rem] flex-col rounded-xl border border-white/[0.07] bg-black/18 px-[18px] py-5 sm:min-h-[6.75rem] sm:px-6 sm:py-6"
              title={row.tooltip ?? undefined}
            >
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <div className="min-w-0 flex flex-col gap-1">
                  <span className="text-[11px] font-semibold leading-tight text-slate-200" title={row.tooltip ?? undefined}>
                    {row.label}
                  </span>
                  {row.tooltip ? (
                    <span className="text-[10px] leading-snug text-slate-500">{row.tooltip}</span>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {row.dataBadge ? (
                      <span
                        className={[
                          "rounded px-1.5 py-0.5 text-[8px] font-bold tracking-wide",
                          DATA_BADGE_CLASS[row.dataBadge] ?? DATA_BADGE_CLASS.MOCK,
                        ].join(" ")}
                      >
                        {row.dataBadge}
                      </span>
                    ) : null}
                    {row.category ? (
                      <span className="text-[9px] font-medium text-slate-500">{row.category}</span>
                    ) : null}
                  </div>
                </div>
                <span className="shrink-0 self-start text-right font-mono text-[15px] font-bold tabular-nums leading-tight text-slate-50 sm:text-base">
                  {currentDisplay}
                </span>
              </div>

              <div className="mt-auto flex flex-wrap gap-x-2.5 gap-y-1.5 border-t border-white/[0.05] pt-3 font-mono text-[10px] tabular-nums text-slate-400 sm:gap-x-3 sm:pt-3.5">
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
                  <span className="text-slate-500">5D N/A · 20D N/A</span>
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
