import { deriveBondLiquidityStatuses } from "../../market-os/bondLiquidityStatus.js"
import { BOND_MONITOR_TAGLINE } from "../../market-os/bondMonitorLabels.js"

/**
 * @param {{ snapshot: import("../../macro-risk/engine.js").MacroRiskSnapshot | null }} props
 */
export default function BondLiquidityStatusBar({ snapshot }) {
  if (!snapshot) return null
  const statuses = deriveBondLiquidityStatuses(snapshot)

  return (
    <section className="trading-card-shell border-amber-500/20 px-3 py-2.5 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-[9px] font-semibold tracking-[0.16em] text-amber-200/80">BOND · LIQUIDITY</p>
        <p className="m-0 text-[9px] text-slate-500">{BOND_MONITOR_TAGLINE}</p>
      </div>
      <ul className="m-0 mt-2 flex list-none flex-wrap gap-1.5 p-0">
        {statuses.map((s) => (
          <li
            key={s}
            className="rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-100/95"
          >
            {s}
          </li>
        ))}
      </ul>
    </section>
  )
}
