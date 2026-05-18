import { motion } from "framer-motion"
import { CYCLE_PHASES } from "../../data/koreaGrowthSectorMap.js"
import { heatToRadarTemp, radarTempPillClass } from "../../utils/koreaValueChainHeat.js"

/**
 * @param {{
 *   sector: import("../../data/koreaGrowthSectorMap.js").KoreaSectorCard | null
 *   heat?: string
 *   onStockSelect: (p: { stock: { name: string; code: string; tip?: string }; sectorName: string }) => void
 * }} props
 */
export default function KoreaSectorInsightPanel({ sector, heat, onStockSelect }) {
  if (!sector) {
    return (
      <aside className="korea-dash-insight live-insight" aria-label="실시간 인사이트">
        <header className="korea-dash-panel-head">
          <p className="m-0 font-mono text-[8px] uppercase tracking-[0.18em] text-slate-500">Live insight</p>
          <h2 className="m-0 mt-0.5 text-xs font-semibold text-slate-200">실시간 인사이트</h2>
        </header>
        <p className="m-0 mt-6 text-[11px] leading-relaxed text-slate-500">
          산업을 선택하면 현재 단계·사이클·수혜 논리·대표 종목이 표시됩니다.
        </p>
      </aside>
    )
  }

  const temp = heatToRadarTemp(heat || sector.heat)
  const phaseLabel = CYCLE_PHASES.find((p) => p.id === sector.cyclePhase)?.label ?? sector.cyclePosition

  return (
    <aside className="korea-dash-insight live-insight" aria-label="실시간 인사이트">
      <header className="korea-dash-panel-head border-b border-white/[0.06] pb-3">
        <p className="m-0 font-mono text-[8px] uppercase tracking-[0.18em] text-slate-500">Live insight</p>
        <h2 className="m-0 mt-0.5 text-sm font-semibold text-slate-100">
          {sector.icon} {sector.name}
        </h2>
        <motion.div className="mt-2 flex flex-wrap gap-1" layout>
          {sector.themes.map((t) => (
            <span
              key={t}
              className="rounded border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 text-[9px] text-slate-400"
            >
              {t}
            </span>
          ))}
        </motion.div>
      </header>

      <div className="mt-3 space-y-2.5">
        <InsightRow label="현재 단계" value={sector.currentStage} />
        <InsightRow label="사이클 위치" value={phaseLabel} highlight />
        <div className="rounded-lg border border-white/[0.05] bg-black/20 px-2.5 py-2">
          <p className="m-0 text-[7px] font-semibold uppercase tracking-[0.1em] text-slate-500">수혜 논리</p>
          <p className="m-0 mt-1 text-[10px] leading-relaxed text-slate-400">{sector.beneficiaryReason}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <InsightRow label="시장 온도" value={sector.marketTemperature} />
          <div className="rounded-lg border border-white/[0.05] bg-black/15 px-2.5 py-2">
            <p className="m-0 text-[7px] font-semibold uppercase tracking-[0.1em] text-slate-500">온도</p>
            <span
              className={[
                "mt-1 inline-block rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase",
                radarTempPillClass(temp),
              ].join(" ")}
            >
              {temp}
            </span>
          </div>
        </div>
        <InsightRow label="관심도" value={sector.interestLevel} />

        <div className="border-t border-white/[0.06] pt-3">
          <p className="m-0 text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-500">국내 대표 종목</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sector.stocks.map((s) => (
              <button
                key={s.code}
                type="button"
                title={s.tip || s.code}
                onClick={() =>
                  onStockSelect({
                    stock: { name: s.name, code: s.code, tip: s.tip },
                    sectorName: sector.name,
                  })
                }
                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium text-slate-200 transition hover:border-white/20"
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        <CyclePhaseBar activePhase={sector.cyclePhase} pct={sector.cyclePct} />
      </div>
    </aside>
  )
}

/** @param {{ label: string; value: string; highlight?: boolean }} props */
function InsightRow({ label, value, highlight = false }) {
  return (
    <motion.div layout className="rounded-lg border border-white/[0.05] bg-black/15 px-2.5 py-2">
      <p className="m-0 text-[7px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className={`m-0 mt-0.5 text-[10px] font-semibold ${highlight ? "text-indigo-200/90" : "text-slate-200"}`}>
        {value}
      </p>
    </motion.div>
  )
}

/** @param {{ activePhase: string; pct: number }} props */
function CyclePhaseBar({ activePhase, pct }) {
  return (
    <div className="rounded-lg border border-white/[0.05] bg-black/15 px-2.5 py-2.5">
      <p className="m-0 text-[7px] font-semibold uppercase tracking-[0.1em] text-slate-500">사이클</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {CYCLE_PHASES.map((p) => (
          <span
            key={p.id}
            className={[
              "rounded px-1.5 py-0.5 text-[8px] font-medium",
              p.id === activePhase
                ? "border border-indigo-400/30 bg-indigo-500/15 text-indigo-200/95"
                : "border border-transparent text-slate-600",
            ].join(" ")}
          >
            {p.label}
          </span>
        ))}
      </div>
      <motion.div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          className="h-full rounded-full bg-indigo-500/55"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </motion.div>
    </div>
  )
}
