import { buildMarketOsPhase2 } from "../../market-os/buildMarketOsPhase2.js"

/**
 * Phase 2 — 상단 고정 Market OS 커맨드 카드 (Cycle+Macro+패닉+트리거)
 * @param {{
 *   cycleScore: number | null;
 *   snapshot: import("../../macro-risk/engine.js").MacroRiskSnapshot | null;
 *   panicData?: object | null;
 *   loading?: boolean;
 * }} props
 */
export default function MarketOsCommandCard({ cycleScore, snapshot, panicData = null, loading = false }) {
  if (loading && !snapshot) {
    return (
      <section className="yds-market-os-command trading-card-shell border-indigo-500/25 px-3 py-3">
        <p className="m-0 text-[10px] text-slate-500">Market OS 계산 중…</p>
      </section>
    )
  }

  if (!snapshot) return null

  const os = buildMarketOsPhase2({ cycleScore, snapshot, panicData })

  return (
    <section className="yds-market-os-command trading-card-shell border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-[#0a0d14] to-black/80 px-3 py-3 shadow-[0_0_24px_rgba(99,102,241,0.12)] sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-[9px] font-bold tracking-[0.22em] text-indigo-200/90">YDS MARKET OS</p>
        <p className="m-0 font-mono text-[10px] tabular-nums text-slate-500">
          Cycle {os.cycleScore ?? "—"} · Macro {os.macroScore ?? "—"}
          {os.panicStressScore != null ? ` · 패닉 ${os.panicStressScore}` : ""}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <BlockTitle>현재 위치</BlockTitle>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {os.currentPosition.map((line) => (
              <li key={line} className="flex gap-2 text-[11px] font-semibold text-slate-100">
                <span className="text-indigo-400/80" aria-hidden>
                  ·
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0 space-y-2">
          <BlockTitle>OS 위치맵</BlockTitle>
          <OsMiniBar
            label="Cycle"
            score={os.positionMap.cycle.score}
            phaseLabel={os.positionMap.cycleLabel}
            variant="cycle"
          />
          <OsMiniBar
            label="Macro"
            score={os.positionMap.macro.score}
            phaseLabel={os.positionMap.macroLabel}
            variant="macro"
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniCell k="현금" v={os.practicalActions.cash} />
        <MiniCell k="전략" v={os.practicalActions.strategy} />
        <MiniCell k="추격" v={os.practicalActions.chase} accent="text-rose-200/90" />
        <MiniCell k="AI" v={os.practicalActions.ai} accent="text-cyan-200/90" />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 border-t border-white/[0.06] pt-3 sm:grid-cols-2">
        <div className="min-w-0">
          <BlockTitle>추천 섹터</BlockTitle>
          <p className="m-0 mt-1 text-[11px] text-slate-200">
            <span className="text-slate-500">우호 </span>
            {os.sectors.favor.join(" · ")}
          </p>
          <p className="m-0 mt-1 text-[10px] text-slate-500">
            <span className="text-rose-300/80">주의 </span>
            {os.sectors.hostile.join(" · ")}
          </p>
        </div>
        <div className="min-w-0">
          <BlockTitle>금지 행동</BlockTitle>
          <ul className="m-0 mt-1 list-none space-y-0.5 p-0">
            {os.forbiddenActions.map((line) => (
              <li key={line} className="text-[10px] font-semibold text-rose-200/90">
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-2">
        <BlockTitle>실전 플레이북</BlockTitle>
        <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-4">
          <PlaybookCell k="장기" v={os.playbook.long} />
          <PlaybookCell k="중기" v={os.playbook.mid} />
          <PlaybookCell k="단기" v={os.playbook.short} />
          <PlaybookCell k="현금" v={os.playbook.cash} />
        </div>
      </div>
    </section>
  )
}

function BlockTitle({ children }) {
  return <p className="m-0 text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-500">{children}</p>
}

function MiniCell({ k, v, accent = "text-slate-50" }) {
  return (
    <div className="min-w-0 rounded-md border border-white/[0.08] bg-black/35 px-2 py-1.5">
      <p className="m-0 text-[8px] font-semibold text-slate-500">{k}</p>
      <p className={`m-0 truncate text-[11px] font-bold ${accent}`}>{v}</p>
    </div>
  )
}

function PlaybookCell({ k, v }) {
  return (
    <div className="min-w-0">
      <p className="m-0 text-[8px] text-slate-500">{k}</p>
      <p className="m-0 truncate text-[11px] font-bold text-slate-100">{v}</p>
    </div>
  )
}

/**
 * @param {{ label: string; score: number|null; phaseLabel: string; variant: "cycle"|"macro" }} props
 */
function OsMiniBar({ label, score, phaseLabel, variant }) {
  const v = Number(score)
  const value = Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : null
  const isCycle = variant === "cycle"
  const fillCls = isCycle ? "bg-emerald-500/35" : "bg-rose-500/35"
  const dotCls = isCycle
    ? "bg-emerald-400 ring-2 ring-emerald-300/25"
    : "bg-rose-400 ring-2 ring-rose-300/25"
  const valueCls = isCycle ? "text-emerald-300" : "text-rose-300"

  if (value == null) {
    return (
      <p className="m-0 text-[10px] text-slate-600">
        {label} · —
      </p>
    )
  }

  return (
    <div className="min-w-0">
      <p className="m-0 truncate text-[10px] text-slate-400">
        {label}{" "}
        <span className="text-slate-500">{phaseLabel}</span>
      </p>
      <div className="mt-1 flex min-w-0 items-center gap-1">
        <span className="shrink-0 font-mono text-[8px] text-slate-600">0</span>
        <div className="relative min-w-0 flex-1">
          <div className="relative h-1.5 rounded-full bg-white/[0.08]">
            <div className={`absolute inset-y-0 left-0 rounded-full ${fillCls}`} style={{ width: `${value}%` }} />
            <div
              className="absolute top-1/2 z-[1] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: `${value}%` }}
            >
              <span className={`block h-full w-full rounded-full ${dotCls}`} />
            </div>
          </div>
          <p
            className={`absolute m-0 -translate-x-1/2 whitespace-nowrap font-mono text-[9px] font-bold tabular-nums ${valueCls}`}
            style={{ left: `${value}%`, top: "0.85rem" }}
          >
            ● {Math.round(value)}
          </p>
        </div>
        <span className="shrink-0 font-mono text-[8px] text-slate-600">100</span>
      </div>
    </div>
  )
}
