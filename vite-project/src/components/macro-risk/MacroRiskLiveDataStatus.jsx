import { DATA_BADGE_CLASS } from "../../macro-risk/metricSourceCatalog.js"

const FALLBACK_BADGE_CLASS = {
  SEED: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  STATIC: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  "LIVE FAIL": "border-rose-500/35 bg-rose-500/12 text-rose-300",
}

/**
 * @param {{ status: import("../../macro-risk/liveDataStatus.js").LiveDataStatusPayload }} props
 */
export default function MacroRiskLiveDataStatus({ status }) {
  if (!status) return null

  return (
    <section className="trading-card-shell px-3 py-2.5 sm:px-3.5 sm:py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="m-0 text-[10px] font-semibold tracking-[0.12em] text-slate-500">
          종가 스냅샷 · 데이터 소스
        </p>
        <p className="m-0 font-mono text-[9px] text-slate-500">
          {status.liveFetchOk ? "API OK" : "API 실패"}
          {status.lastUpdateDisplay ? ` · ${status.lastUpdateDisplay}` : ""}
        </p>
      </div>

      {!status.liveFetchOk ? (
        <p className="m-0 mt-1.5 text-[10px] font-medium text-amber-300/90">
          /api/market-data LIVE FAIL — SEED · STATIC · LIVE FAIL 배지로 표시 (숨김 없음)
        </p>
      ) : null}

      <TierBlock title="Tier 1" rows={status.tier1} />
      <TierBlock title="Tier 2" rows={status.tier2} />
    </section>
  )
}

/**
 * @param {{ title: string; rows: import("../../macro-risk/liveDataStatus.js").LiveStatusRow[] }} props
 */
function TierBlock({ title, rows }) {
  if (!rows?.length) return null
  return (
    <div className="mt-2 border-t border-white/[0.06] pt-2 first:mt-1.5 first:border-0 first:pt-0">
      <p className="m-0 text-[9px] font-semibold tracking-wide text-slate-600">{title}</p>
      <ul className="m-0 mt-1 list-none space-y-1 p-0">
        {rows.map((r) => (
          <li key={r.key} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px]">
            <span className="min-w-[2.5rem] font-semibold text-slate-300">{r.short}</span>
            <span
              className={[
                "rounded px-1 py-px text-[8px] font-bold tracking-wide",
                DATA_BADGE_CLASS[r.badge] ?? DATA_BADGE_CLASS.MOCK,
              ].join(" ")}
            >
              {r.badge}
            </span>
            {r.fallbackTag ? (
              <span
                className={[
                  "rounded px-1 py-px text-[8px] font-bold tracking-wide",
                  FALLBACK_BADGE_CLASS[r.fallbackTag],
                ].join(" ")}
              >
                {r.fallbackTag}
              </span>
            ) : null}
            {r.fallbackNote ? (
              <span className="text-[9px] text-amber-300/85">{r.fallbackNote}</span>
            ) : r.badge === "MANUAL" ? (
              <span className="text-[9px] text-slate-500">cycle reuse</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
