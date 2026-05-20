const STATUS_CLASS = {
  normal: "text-emerald-300/95",
  inversion: "text-rose-300/95",
  resteepening: "text-amber-300/95",
}

/**
 * @param {{ curve: NonNullable<import("../../macro-risk/yieldCurve.js").ReturnType<import("../../macro-risk/yieldCurve.js").buildYieldCurve>> }} props
 */
export default function MacroRiskYieldCurveCard({ curve }) {
  const color = STATUS_CLASS[curve.statusKey] ?? "text-slate-200"

  return (
    <section className="trading-card-shell px-3 py-2.5 sm:px-3.5 sm:py-3">
      <p className="m-0 text-[10px] font-semibold tracking-[0.12em] text-slate-500">장단기 금리차</p>
      <p className="m-0 mt-0.5 text-[10px] text-slate-600">10년물 − 2년물</p>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="m-0 font-mono text-[1.6rem] font-bold tabular-nums text-slate-50">
            {curve.spread >= 0 ? "+" : ""}
            {curve.spread.toFixed(2)}%
          </p>
          <p className="m-0 mt-0.5 font-mono text-[10px] tabular-nums text-slate-500">
            10Y {curve.y10.toFixed(2)} · 2Y {curve.y2.toFixed(2)}
          </p>
        </div>
        <p className={["m-0 text-[13px] font-semibold", color].join(" ")}>{curve.status}</p>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 font-mono text-[10px] tabular-nums text-slate-400">
        {curve.change5D != null ? <span>5D Δ {curve.change5D >= 0 ? "+" : ""}{curve.change5D.toFixed(2)}</span> : null}
        {curve.change20D != null ? (
          <span>
            20D Δ {curve.change20D >= 0 ? "+" : ""}
            {curve.change20D.toFixed(2)}
          </span>
        ) : null}
      </div>
    </section>
  )
}
