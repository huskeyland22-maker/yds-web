import { useMemo } from "react"
import { CYCLE_PHASES, KOREA_GROWTH_SECTOR_MAP } from "../data/koreaGrowthSectorMap.js"

function heatPillClass(heat) {
  const h = String(heat || "").toUpperCase()
  if (h === "VERY HOT") return "border-rose-400/30 bg-rose-500/12 text-rose-200/90"
  if (h === "HOT") return "border-amber-400/30 bg-amber-500/12 text-amber-200/90"
  if (h === "WARM") return "border-sky-400/25 bg-sky-500/10 text-sky-200/90"
  return "border-slate-500/20 bg-slate-500/8 text-slate-400"
}

/**
 * @param {{
 *   heatById?: Record<string, string>
 *   onStockSelect: (payload: { stock: { name: string; code: string; tip?: string }; sectorName: string }) => void
 * }} props
 */
export default function KoreaSectorDetailCards({ heatById = {}, onStockSelect }) {
  const sectors = useMemo(
    () =>
      KOREA_GROWTH_SECTOR_MAP.map((s) => ({
        ...s,
        heat: heatById[s.id] || s.heat,
      })),
    [heatById],
  )

  return (
    <div id="korea-sector-details" className="scroll-mt-24 space-y-4">
      <header className="border-b border-white/[0.06] pb-3">
        <p className="m-0 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">
          Sector detail · Korea only
        </p>
        <h2 className="m-0 mt-1 text-base font-semibold text-slate-100">상세 밸류체인</h2>
      </header>

      {sectors.map((sector, index) => (
        <DetailCard
          key={sector.id}
          sector={sector}
          index={index}
          onStockSelect={onStockSelect}
        />
      ))}
    </div>
  )
}

/**
 * @param {{
 *   sector: import("../data/koreaGrowthSectorMap.js").KoreaSectorCard
 *   index: number
 *   onStockSelect: (p: { stock: { name: string; code: string; tip?: string }; sectorName: string }) => void
 * }} props
 */
function DetailCard({ sector, index, onStockSelect }) {
  return (
    <article
      id={`korea-sector-${sector.id}`}
      className="scroll-mt-28 rounded-2xl border border-white/[0.07] bg-[rgba(12,14,18,0.95)] p-4 md:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-white/[0.06] pb-3">
        <div>
          <p className="m-0 font-mono text-[9px] text-slate-600">
            CARD {String(index + 1).padStart(2, "0")}
          </p>
          <h3 className="m-0 mt-1 flex items-center gap-1.5 text-base font-semibold text-slate-50">
            <span aria-hidden>{sector.icon}</span>
            {sector.name}
          </h3>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${heatPillClass(sector.heat)}`}>
          {sector.heat}
        </span>
      </div>

      {sector.nodes?.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {sector.nodes.map((n) => (
            <span
              key={n}
              className="rounded-md border border-white/[0.06] bg-white/[0.02] px-1.5 py-0.5 text-[9px] text-slate-400"
            >
              {n}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Meta label="현재 단계" value={sector.currentStage} />
        <Meta label="사이클 위치" value={sector.cyclePosition} highlight />
      </div>

      <CycleTimeline activePhase={sector.cyclePhase} />

      <div className="mt-3 rounded-lg border border-white/[0.05] bg-black/20 px-3 py-2.5">
        <p className="m-0 text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-500">수혜 논리</p>
        <p className="m-0 mt-1 text-[11px] leading-relaxed text-slate-400">{sector.beneficiaryReason}</p>
      </div>

      <div className="mt-4 border-t border-white/[0.06] pt-3">
        <p className="m-0 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">국내 대표 종목</p>
        <ul className="m-0 mt-2 list-none space-y-1.5 p-0">
          {sector.stocks.map((s) => (
            <li key={s.code}>
              <button
                type="button"
                onClick={() =>
                  onStockSelect({
                    stock: { name: s.name, code: s.code, tip: s.tip },
                    sectorName: sector.name,
                  })
                }
                className="flex w-full items-baseline justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-left transition hover:border-indigo-400/30 hover:bg-indigo-500/[0.06]"
              >
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold text-slate-200">{s.name}</span>
                  {s.tip ? (
                    <span className="mt-0.5 block text-[9px] text-slate-500">{s.tip}</span>
                  ) : null}
                </span>
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-slate-500">{s.code}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Meta label="시장 온도" value={sector.marketTemperature} />
        <Meta label="관심도" value={sector.interestLevel} />
      </div>
    </article>
  )
}

/** @param {{ label: string; value: string; highlight?: boolean }} props */
function Meta({ label, value, highlight = false }) {
  return (
    <div className="rounded-lg border border-white/[0.05] bg-black/15 px-2.5 py-2">
      <p className="m-0 text-[7px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className={`m-0 mt-0.5 text-[10px] font-semibold ${highlight ? "text-indigo-200/90" : "text-slate-200"}`}>
        {value}
      </p>
    </div>
  )
}

/** @param {{ activePhase: string }} props */
function CycleTimeline({ activePhase }) {
  return (
    <div className="mt-3">
      <p className="m-0 mb-1.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-500">사이클</p>
      <div className="flex flex-wrap items-center gap-1">
        {CYCLE_PHASES.map((phase, i) => {
          const active = phase.id === activePhase
          return (
            <span key={phase.id} className="flex items-center gap-1">
              <span
                className={[
                  "rounded px-1.5 py-0.5 text-[9px] font-medium",
                  active
                    ? "border border-indigo-400/35 bg-indigo-500/15 text-indigo-100"
                    : "border border-transparent text-slate-500 opacity-40",
                ].join(" ")}
              >
                {phase.label}
              </span>
              {i < CYCLE_PHASES.length - 1 ? (
                <span className="text-[8px] text-slate-600 opacity-40" aria-hidden>
                  →
                </span>
              ) : null}
            </span>
          )
        })}
      </div>
    </div>
  )
}
