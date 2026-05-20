const STANCE_CLASS = {
  risk: "border-rose-500/25 bg-rose-500/[0.08]",
  neutral: "border-amber-500/25 bg-amber-500/[0.08]",
  favorable: "border-emerald-500/25 bg-emerald-500/[0.08]",
}

const TEXT_CLASS = {
  risk: "text-rose-100",
  neutral: "text-amber-100",
  favorable: "text-emerald-100",
}

/**
 * @param {{ rows: import("../../macro-risk/marketImpact.js").MarketImpactRow[] }} props
 */
export default function MacroRiskMarketImpact({ rows }) {
  if (!rows?.length) return null

  const main = rows.filter((r) => r.id !== "value")
  const valueRow = rows.find((r) => r.id === "value")

  return (
    <section className="trading-card-shell px-[18px] py-5 sm:px-6 sm:py-6">
      <p className="m-0 text-[10px] font-semibold tracking-[0.12em] text-slate-500">시장 영향</p>
      <p className="m-0 mt-1 text-[10px] leading-snug text-slate-600">섹터별 매크로 해석 · 위험도</p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4">
        {main.map((r) => (
          <ImpactCell key={r.id} row={r} />
        ))}
        {valueRow ? (
          <div className="col-span-2">
            <ImpactCell row={valueRow} compact />
          </div>
        ) : null}
      </div>
    </section>
  )
}

/**
 * @param {{ row: import("../../macro-risk/marketImpact.js").MarketImpactRow; compact?: boolean }} props
 */
function ImpactCell({ row, compact = false }) {
  return (
    <div
      className={[
        "flex min-h-[3.25rem] items-center justify-between gap-2 rounded-xl border px-[18px] py-4 sm:min-h-[3.5rem]",
        STANCE_CLASS[row.stance] ?? STANCE_CLASS.neutral,
        compact ? "py-3" : "",
      ].join(" ")}
    >
      <div className="min-w-0">
        <span className={["text-[11px] font-semibold leading-tight sm:text-[12px]", TEXT_CLASS[row.stance]].join(" ")}>
          {row.label}
        </span>
        {!compact && row.hint ? <p className="m-0 mt-1 truncate text-[9px] leading-snug text-slate-400">{row.hint}</p> : null}
      </div>
      <div className="shrink-0 text-right leading-none">
        <p className={["m-0 text-[11px] font-bold sm:text-[12px]", TEXT_CLASS[row.stance]].join(" ")}>{row.riskLabel}</p>
        <span className="text-[12px]" aria-hidden>
          {row.emoji}
        </span>
      </div>
    </div>
  )
}
