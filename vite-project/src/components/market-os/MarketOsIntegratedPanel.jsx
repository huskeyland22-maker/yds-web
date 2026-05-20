import { buildMarketOsIntegrated } from "../../market-os/buildMarketOsIntegrated.js"

/**
 * Cycle + Macro 통합 판단 (Market OS)
 * @param {{
 *   cycleScore: number|null;
 *   snapshot: import("../../macro-risk/engine.js").MacroRiskSnapshot;
 * }} props
 */
export default function MarketOsIntegratedPanel({ cycleScore, snapshot }) {
  const os = buildMarketOsIntegrated({ cycleScore, snapshot })

  return (
    <section className="trading-card-shell border-violet-500/20 px-4 py-3 shadow-[inset_0_1px_0_rgba(139,92,246,0.08)]">
      <p className="m-0 text-[9px] font-semibold tracking-[0.2em] text-violet-200/80">MARKET OS · 통합</p>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono tabular-nums">
        <span className="text-[11px] text-slate-400">
          Cycle{" "}
          <strong className="text-[15px] text-slate-100">{os.cycleScore ?? "—"}</strong>
        </span>
        <span className="text-[11px] text-slate-400">
          Bond{" "}
          <strong className="text-[12px] text-amber-100/95">{os.bondStatuses?.[0] ?? "—"}</strong>
        </span>
      </div>

      <p className="m-0 mt-2 text-[12px] font-bold leading-snug text-slate-50">{os.positionSummary}</p>
      <p className="m-0 mt-1 text-[10px] leading-relaxed text-slate-400">{os.briefing}</p>

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <ProgressChip label="공포 진행률" value={os.fearProgressPct} tone="fear" />
        <BondStatusChip statuses={os.bondStatuses} confirming={os.bondConfirming} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 border-t border-white/[0.06] pt-3 sm:grid-cols-3">
        <ActionBlock k="추천 행동" v={os.recommendedAction} accent="text-cyan-200" />
        <ActionBlock k="추천 섹터" v={os.recommendedSector} accent="text-slate-100" />
        <ActionBlock k="금지" v={os.forbiddenActions.join(" · ")} accent="text-rose-200/90" />
      </div>

      <p className="m-0 mt-3 border-t border-white/[0.05] pt-2 text-[8px] leading-relaxed text-slate-600">
        데이터: 미국장 마감 · CORE LIVE · 패닉 9대 = Cycle 수동 (Bond는 보조)
      </p>
    </section>
  )
}

function ProgressChip({ label, value, tone }) {
  const bar =
    tone === "fear"
      ? "from-emerald-700 to-emerald-400"
      : "from-orange-700 to-rose-400"
  const pct = value == null ? 0 : Math.min(100, Math.max(0, value))
  return (
    <div className="rounded-md border border-white/[0.07] bg-black/25 px-2 py-1.5">
      <p className="m-0 text-[8px] font-semibold text-slate-500">{label}</p>
      <p className="m-0 font-mono text-[11px] font-bold tabular-nums text-slate-200">
        {value == null ? "—" : `${value}%`}
      </p>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.08]">
        <div className={`h-full rounded-full bg-gradient-to-r ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function BondStatusChip({ statuses, confirming }) {
  const label = confirming ? "보조 경고" : "보조 양호"
  const bar = confirming ? "from-amber-700 to-rose-500" : "from-slate-600 to-emerald-600"
  const text = (statuses ?? []).slice(0, 2).join(" · ") || "—"
  return (
    <div className="rounded-md border border-white/[0.07] bg-black/25 px-2 py-1.5">
      <p className="m-0 text-[8px] font-semibold text-slate-500">{label}</p>
      <p className="m-0 line-clamp-2 text-[10px] font-bold leading-snug text-amber-100/90">{text}</p>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.08]">
        <div className={`h-full rounded-full bg-gradient-to-r ${bar}`} style={{ width: confirming ? "72%" : "28%" }} />
      </div>
    </div>
  )
}

function ActionBlock({ k, v, accent }) {
  return (
    <div className="min-w-0">
      <p className="m-0 text-[8px] font-semibold uppercase tracking-wide text-slate-500">{k}</p>
      <p className={`m-0 mt-0.5 text-[11px] font-bold leading-snug ${accent}`}>{v}</p>
    </div>
  )
}
