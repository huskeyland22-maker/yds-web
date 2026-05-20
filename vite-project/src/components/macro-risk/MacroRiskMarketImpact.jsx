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

  return (
    <section className="trading-card-shell px-3 py-2.5 sm:px-3.5 sm:py-3">
      <p className="m-0 text-[10px] font-semibold tracking-[0.12em] text-slate-500">시장 영향</p>
      <p className="m-0 mt-0.5 text-[10px] text-slate-600">섹터별 매크로 해석 · 위험도</p>

      <ul className="m-0 mt-2 list-none space-y-1.5 p-0">
        {rows.map((r) => (
          <li
            key={r.id}
            className={[
              "flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5",
              STANCE_CLASS[r.stance] ?? STANCE_CLASS.neutral,
            ].join(" ")}
          >
            <div className="min-w-0">
              <span className={["text-[12px] font-semibold", TEXT_CLASS[r.stance]].join(" ")}>{r.label}</span>
              {r.hint ? <p className="m-0 text-[9px] text-slate-400">{r.hint}</p> : null}
            </div>
            <div className="shrink-0 text-right">
              <p className={["m-0 text-[11px] font-bold", TEXT_CLASS[r.stance]].join(" ")}>{r.riskLabel}</p>
              <span className="text-[12px]" aria-hidden>
                {r.emoji}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
