import { RefreshCw } from "lucide-react"
import { deriveBondLiquidityStatuses } from "../../market-os/bondLiquidityStatus.js"
import { BOND_MONITOR_TAGLINE } from "../../market-os/bondMonitorLabels.js"
import { BOND_DATA_FOOTNOTE, BOND_FRED_POLICY_LABEL } from "../../macro-risk/bondFredPolicy.js"
import {
  BOND_SYNC_METRICS_LABEL,
  dispatchBondSyncRequest,
  formatBondLastSyncKst,
} from "../../macro-risk/bondSyncMeta.js"

/**
 * @param {{
 *   snapshot: import("../../macro-risk/engine.js").MacroRiskSnapshot | null;
 *   syncing?: boolean;
 *   lastSyncAt?: string | null;
 *   onBondSync?: () => void;
 * }} props
 */
export default function BondLiquidityStatusBar({
  snapshot,
  syncing = false,
  lastSyncAt = null,
  onBondSync,
}) {
  if (!snapshot) return null
  const statuses = deriveBondLiquidityStatuses(snapshot)
  const displaySyncAt = formatBondLastSyncKst(lastSyncAt ?? snapshot.updatedAt)

  const handleSync = () => {
    if (syncing) return
    if (onBondSync) onBondSync()
    else dispatchBondSyncRequest()
  }

  return (
    <section className="trading-card-shell border-amber-500/20 px-3 py-2.5 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-[9px] font-semibold tracking-[0.16em] text-amber-200/80">BOND · LIQUIDITY</p>
        <p className="m-0 text-[9px] text-slate-500">{BOND_MONITOR_TAGLINE}</p>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border border-white/[0.06] bg-black/25 px-2 py-1.5 rounded-md">
        <div className="min-w-0">
          <p className="m-0 text-[8px] font-semibold text-slate-500">마지막 갱신 (KST)</p>
          <p className="m-0 font-mono text-[11px] font-bold tabular-nums text-slate-100">{displaySyncAt}</p>
          <p className="m-0 mt-0.5 text-[8px] text-slate-600">{BOND_SYNC_METRICS_LABEL}</p>
        </div>
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          className={[
            "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[10px] font-bold tracking-wide transition",
            syncing
              ? "cursor-wait border-amber-500/30 bg-amber-500/10 text-amber-200/70"
              : "border-amber-400/40 bg-amber-500/15 text-amber-50 hover:bg-amber-500/25 active:scale-[0.98]",
          ].join(" ")}
          aria-busy={syncing}
        >
          <RefreshCw size={12} className={syncing ? "animate-spin" : ""} aria-hidden />
          {syncing ? "동기화 중…" : "Bond Sync"}
        </button>
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
      <p className="m-0 mt-2 border-t border-white/[0.06] pt-2 text-[8px] leading-relaxed text-slate-600">
        <span className="text-slate-500">{BOND_FRED_POLICY_LABEL}</span>
        {snapshot.bondAsOfNy ? ` · FRED ${snapshot.bondAsOfNy}` : ""}
        {snapshot.liveDataStatus?.lastUpdateDisplay
          ? ` · NY ${snapshot.liveDataStatus.lastUpdateDisplay}`
          : ""}
        <br />
        {BOND_DATA_FOOTNOTE}
        <br />
        <span className="text-slate-500">FRED 지연·PWA 캐시·모바일 차이 시 Bond Sync로 재조회</span>
      </p>
    </section>
  )
}
