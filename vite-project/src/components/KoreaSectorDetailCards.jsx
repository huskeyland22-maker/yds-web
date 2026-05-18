import { useMemo } from "react"
import {
  CYCLE_PHASES,
  KOREA_GROWTH_SECTOR_MAP,
  SECTOR_ANCHOR_BY_ID,
  SECTOR_STAGGER_MS_BY_ID,
} from "../data/koreaGrowthSectorMap.js"

/** @param {string | undefined} heat */
function marketTempBadge(heat) {
  const h = String(heat || "").toUpperCase()
  if (h === "VERY HOT" || h === "HOT") {
    return {
      label: "HOT",
      className: "border-rose-400/35 bg-rose-500/12 text-rose-200/95",
    }
  }
  if (h === "WARM") {
    return {
      label: "WARM",
      className: "border-amber-400/35 bg-amber-500/12 text-amber-200/95",
    }
  }
  return {
    label: "NEUTRAL",
    className: "border-slate-500/25 bg-slate-500/10 text-slate-400",
  }
}

/**
 * @param {{
 *   heatById?: Record<string, string>
 *   onStockSelect: (payload: { stock: { name: string; code: string; tip?: string }; sectorName: string }) => void
 *   onBackToMap?: () => void
 * }} props
 */
export default function KoreaSectorDetailCards({ heatById = {}, onStockSelect, onBackToMap }) {
  const sectors = useMemo(
    () =>
      KOREA_GROWTH_SECTOR_MAP.map((s) => ({
        ...s,
        heat: heatById[s.id] || s.heat,
        anchorId: SECTOR_ANCHOR_BY_ID[s.id] || s.id,
        staggerMs: SECTOR_STAGGER_MS_BY_ID[s.id] ?? 0,
      })),
    [heatById],
  )

  return (
    <div id="korea-sector-details" className="space-y-4">
      <style>{`
        @keyframes koreaSectorCardIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <header className="border-b border-white/[0.06] pb-3">
        <p className="m-0 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">
          Sector detail · Korea only
        </p>
        <h2 className="m-0 mt-1 text-base font-semibold text-slate-100">상세 밸류체인</h2>
      </header>

      {sectors.map((sector) => (
        <DetailCard
          key={sector.id}
          sector={sector}
          onStockSelect={onStockSelect}
          onBackToMap={onBackToMap}
        />
      ))}
    </div>
  )
}

/**
 * @param {{
 *   sector: import("../data/koreaGrowthSectorMap.js").KoreaSectorCard & {
 *     anchorId: string
 *     staggerMs: number
 *   }
 *   onStockSelect: (p: { stock: { name: string; code: string; tip?: string }; sectorName: string }) => void
 *   onBackToMap?: () => void
 * }} props
 */
function DetailCard({ sector, onStockSelect, onBackToMap }) {
  const temp = marketTempBadge(sector.heat)

  return (
    <article
      id={sector.anchorId}
      className="valuechain-section rounded-2xl border border-white/[0.07] bg-[rgba(12,14,18,0.95)] p-4 md:p-5"
      style={{
        animation: "koreaSectorCardIn 0.35s ease-out both",
        animationDelay: `${sector.staggerMs}ms`,
      }}
    >
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] pb-3">
        <h3 className="m-0 flex min-w-0 items-center gap-1.5 text-base font-semibold text-slate-50">
          <span aria-hidden>{sector.icon}</span>
          {sector.name}
        </h3>
        <div className="flex shrink-0 items-start gap-2">
          {onBackToMap ? (
            <button
              type="button"
              onClick={onBackToMap}
              className="valuechain-map-link mt-0.5"
              aria-label="산업맵으로 이동"
            >
              맵
            </button>
          ) : null}
          <div className="text-right">
            <p className="m-0 text-[8px] font-medium uppercase tracking-[0.1em] text-slate-500">시장 온도</p>
            <span
              className={[
                "mt-1 inline-block rounded-md border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide",
                temp.className,
              ].join(" ")}
            >
              {temp.label}
            </span>
          </div>
        </div>
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
        <p className="m-0 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          {sector.subChains?.length ? "하위 밸류체인" : "국내 대표 종목"}
        </p>
        {sector.subChains?.length > 0 ? (
          <div className="mt-3 space-y-3">
            {sector.subChains.map((sub) => (
              <div
                key={sub.id}
                className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2.5"
              >
                <p className="m-0 text-[10px] font-semibold text-slate-300">{sub.label}</p>
                <StockChips
                  stocks={sub.stocks}
                  sectorName={`${sector.name} · ${sub.label}`}
                  onStockSelect={onStockSelect}
                />
              </div>
            ))}
          </div>
        ) : (
          <StockChips stocks={sector.stocks} sectorName={sector.name} onStockSelect={onStockSelect} />
        )}
      </div>

      <div className="mt-3">
        <Meta label="관심도" value={sector.interestLevel} />
      </div>
    </article>
  )
}

/**
 * @param {{
 *   stocks: import("../data/koreaGrowthSectorMap.js").KoreaStockRef[]
 *   sectorName: string
 *   onStockSelect: (p: { stock: { name: string; code: string; tip?: string }; sectorName: string }) => void
 * }} props
 */
function StockChips({ stocks, sectorName, onStockSelect }) {
  return (
    <div className="mt-2.5 flex flex-wrap gap-2">
      {stocks.map((s) => (
        <button
          key={s.code}
          type="button"
          title={s.tip || s.code}
          onClick={() =>
            onStockSelect({
              stock: { name: s.name, code: s.code, tip: s.tip },
              sectorName,
            })
          }
          className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-slate-200 transition duration-200 hover:border-white/25"
        >
          {s.name}
        </button>
      ))}
    </div>
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
