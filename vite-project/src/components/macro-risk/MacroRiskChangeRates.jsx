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
    <div className="mt-3 border-t border-white/[0.06] pt-3 first:mt-0 first:border-t-0 first:pt-0">
      <p className="m-0 text-[9px] font-semibold tracking-[0.1em] text-slate-500">{title}</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        {metrics.map((row) => {
          const fmt = row.format === "pct" ? "level" : row.format
          const currentDisplay =
            row.current == null || !Number.isFinite(Number(row.current)) ? "—" : formatCurrent(row.current, fmt)

          return (
            <div
              key={row.key}
              className="macro-risk-tier-cell flex min-h-[124px] max-h-[140px] flex-col items-center rounded-lg border border-white/[0.07] bg-black/22 px-2 py-3 text-center"
              title={row.tooltip ?? undefined}
            >
              <span className="line-clamp-2 min-h-[2.25rem] text-[11px] font-semibold leading-tight text-slate-100">
                {row.label}
              </span>
              {row.tooltip ? (
                <span className="mt-0.5 line-clamp-2 text-[9px] leading-snug text-slate-500">{row.tooltip}</span>
              ) : (
                <span className="mt-0.5 text-[9px] text-slate-600">
                  {row.category ? row.category : "\u00A0"}
                </span>
              )}

              <div className="mt-2 flex flex-wrap items-center justify-center gap-1">
                {row.dataBadge ? (
                  <span
                    className={[
                      "rounded px-1 py-0.5 text-[7px] font-bold tracking-wide",
                      DATA_BADGE_CLASS[row.dataBadge] ?? DATA_BADGE_CLASS.MOCK,
                    ].join(" ")}
                  >
                    {row.dataBadge === "LIVE" ? "LIVE" : row.dataBadge}
                  </span>
                ) : null}
              </div>

              <span className="mx-auto mt-2 font-mono text-[17px] font-bold tabular-nums leading-none text-slate-50">
                {currentDisplay}
              </span>

              <p
                className={`m-0 mt-1 flex items-center justify-center gap-1 text-[10px] font-semibold ${STANCE_COLOR[row.slope] ?? STANCE_COLOR.flat}`}
              >
                <span>{slopeArrow(row.slope)}</span>
                <span>{slopeLabelKo(row.slope)}</span>
              </p>

              <div className="mt-auto flex w-full flex-wrap items-center justify-center gap-x-2 gap-y-0.5 border-t border-white/[0.06] pt-2 font-mono text-[9px] tabular-nums text-slate-400">
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
                  <span className="text-slate-500">5D N/A</span>
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
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
