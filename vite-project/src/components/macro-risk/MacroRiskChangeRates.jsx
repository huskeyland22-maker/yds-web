import { formatCurrent, slopeLabelKo } from "../../macro-risk/displayMetrics.js"
import { formatDeltaByMethod, inferDeltaMethod } from "../../macro-risk/deltaSemantics.js"
import { DATA_BADGE_CLASS } from "../../macro-risk/metricSourceCatalog.js"
import { slopeArrow } from "../../macro-risk/seriesMath.js"

const STANCE_COLOR = {
  up: "text-rose-300/90",
  down: "text-emerald-300/90",
  flat: "text-slate-400",
}

const LABEL_T1 = {
  US10Y: "10Y",
  REAL_YIELD: "REAL",
  DXY: "DXY",
  MOVE: "MOVE",
}
const LABEL_T2 = {
  US30Y: "30Y",
  BEI: "BEI",
  VXN: "VXN",
  US2Y: "2Y",
}

/**
 * @param {{
 *   metrics?: import("../../macro-risk/displayMetrics.js").MetricDisplayRow[];
 *   title?: string;
 *   variant?: "tier1" | "tier2";
 *   hideBlockTitle?: boolean;
 * }} props
 */
export default function MacroRiskChangeRates({ metrics = [], title = "변화율", variant = "tier1", hideBlockTitle = false }) {
  if (!metrics.length) return null

  const shellTier1 = "border-white/[0.18] bg-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
  const shellTier2 = "border-white/[0.07] bg-black/14 opacity-[0.92]"

  return (
    <div
      className={
        hideBlockTitle ? "mt-0 pt-0 first:mt-0" : "mt-3 border-t border-white/[0.06] pt-3 first:mt-0 first:border-t-0 first:pt-0"
      }
    >
      {!hideBlockTitle ? (
        <p className="m-0 text-[9px] font-semibold tracking-[0.1em] text-slate-500">{title}</p>
      ) : null}
      <div className={`mt-2 grid grid-cols-2 gap-3 ${hideBlockTitle ? "mt-0" : ""}`}>
        {metrics.map((row) => {
          const fmt = row.format === "pct" ? "level" : row.format
          const currentDisplay =
            row.current == null || !Number.isFinite(Number(row.current)) ? "—" : formatCurrent(row.current, fmt)

          const short =
            variant === "tier2"
              ? LABEL_T2[row.key] ?? row.label
              : LABEL_T1[row.key] ?? row.label

          const shell = variant === "tier1" ? shellTier1 : shellTier2

          const d1 =
            !row.hide1D && row.change1D != null
              ? `1D ${formatDeltaByMethod(row.change1D, inferDeltaMethod(row.key, row.current, row.change1D, "1D"), fmt)}`
              : null
          const d5 =
            !row.deltaHorizonNA && row.change5D != null
              ? `5D ${formatDeltaByMethod(row.change5D, inferDeltaMethod(row.key, row.current, row.change5D, "5D"), fmt)}`
              : null
          const d20 =
            !row.deltaHorizonNA && row.change20D != null
              ? `20D ${formatDeltaByMethod(row.change20D, inferDeltaMethod(row.key, row.current, row.change20D, "20D"), fmt)}`
              : null
          const deltas = [d1, d5, d20].filter(Boolean).join(" · ")

          return (
            <div
              key={row.key}
              className={[
                "macro-risk-tier-cell flex h-[92px] max-h-[100px] flex-col justify-between rounded-lg border px-2 py-1.5 text-left",
                shell,
              ].join(" ")}
            >
              <div>
                <p className="m-0 truncate text-[10px] font-semibold leading-tight text-slate-200">{short}</p>
                <p className="m-0 mt-0.5 font-mono text-[16px] font-bold tabular-nums leading-none text-slate-50">
                  {currentDisplay}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  {row.dataBadge ? (
                    <span
                      className={[
                        "rounded px-1 py-px text-[6px] font-bold tracking-wide",
                        DATA_BADGE_CLASS[row.dataBadge] ?? DATA_BADGE_CLASS.MOCK,
                      ].join(" ")}
                    >
                      {row.dataBadge === "LIVE" ? "LIVE" : row.dataBadge}
                    </span>
                  ) : null}
                  <span
                    className={`text-[9px] font-semibold ${STANCE_COLOR[row.slope] ?? STANCE_COLOR.flat}`}
                  >
                    {slopeArrow(row.slope)} {slopeLabelKo(row.slope)}
                  </span>
                </div>
              </div>
              <p className="m-0 border-t border-white/[0.06] pt-1 font-mono text-[8px] tabular-nums leading-tight text-slate-400">
                {deltas || "—"}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
