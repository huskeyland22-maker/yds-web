import { useMemo, useState } from "react"
import {
  GROWTH_MAP_THEMES,
  KOREA_GROWTH_SECTOR_MAP,
} from "../data/koreaGrowthSectorMap.js"

function heatPillClass(heat) {
  const h = String(heat || "").toUpperCase()
  if (h === "VERY HOT") return "border-rose-400/35 bg-rose-500/15 text-rose-200"
  if (h === "HOT") return "border-amber-400/35 bg-amber-500/15 text-amber-200"
  if (h === "WARM") return "border-sky-400/30 bg-sky-500/12 text-sky-200"
  return "border-slate-500/25 bg-slate-500/10 text-slate-400"
}

/**
 * @param {{ sectors?: import("../data/koreaGrowthSectorMap.js").GrowthSectorCard[]; heatById?: Record<string, string> }} props
 */
export default function KoreaGrowthSectorMap({ sectors = KOREA_GROWTH_SECTOR_MAP, heatById = {} }) {
  const [themeFilter, setThemeFilter] = useState("all")

  const merged = useMemo(
    () =>
      sectors.map((s) => ({
        ...s,
        heat: heatById[s.id] || s.heat,
      })),
    [sectors, heatById],
  )

  const filtered = useMemo(() => {
    if (themeFilter === "all") return merged
    const theme = GROWTH_MAP_THEMES.find((t) => t.id === themeFilter)
    if (!theme) return merged
    return merged.filter((s) => s.themes.includes(theme.label))
  }, [merged, themeFilter])

  return (
    <section id="growth-sector-map" className="relative z-[1] scroll-mt-24">
      <header className="mb-5">
        <p className="m-0 text-[9px] font-semibold uppercase tracking-[0.22em] text-indigo-300/80">
          Growth sector map
        </p>
        <h2 className="m-0 mt-1.5 font-['Playfair_Display',Georgia,serif] text-lg font-semibold tracking-tight text-slate-50 md:text-xl">
          AI 병목 · 산업 재편 · 순환매 맵
        </h2>
        <p className="m-0 mt-2 max-w-2xl text-[11px] leading-relaxed text-slate-500 md:text-xs">
          9개 핵심 성장 섹터의 현재 단계·사이클 위치·수혜 논리·한국·미국 대표 종목을 카드로 정리합니다.
        </p>
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        <ThemeChip active={themeFilter === "all"} onClick={() => setThemeFilter("all")} label="전체" />
        {GROWTH_MAP_THEMES.map((t) => (
          <ThemeChip
            key={t.id}
            active={themeFilter === t.id}
            onClick={() => setThemeFilter(t.id)}
            label={t.label}
            title={t.desc}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((sector, index) => (
          <GrowthSectorCard key={sector.id} sector={sector} index={index} />
        ))}
      </div>
    </section>
  )
}

/** @param {{ active: boolean; onClick: () => void; label: string; title?: string }} props */
function ThemeChip({ active, onClick, label, title }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={[
        "rounded-full border px-2.5 py-1 text-[10px] font-medium transition",
        active
          ? "border-indigo-400/40 bg-indigo-500/15 text-indigo-100"
          : "border-white/[0.08] bg-white/[0.03] text-slate-500 hover:border-white/15 hover:text-slate-300",
      ].join(" ")}
    >
      {label}
    </button>
  )
}

/** @param {{ sector: import("../data/koreaGrowthSectorMap.js").GrowthSectorCard; index: number }} props */
function GrowthSectorCard({ sector, index }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[linear-gradient(165deg,rgba(16,22,36,0.95),rgba(8,10,18,0.98))] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)] transition duration-300 hover:border-indigo-500/25 md:p-5">
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: "radial-gradient(circle at 100% 0%, rgba(99,102,241,0.12), transparent 55%)",
        }}
        aria-hidden
      />

      <div className="relative z-[1] flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="m-0 font-mono text-[9px] tracking-[0.14em] text-slate-600">
            SECTOR {String(index + 1).padStart(2, "0")}
          </p>
          <h3 className="m-0 mt-1 flex items-center gap-1.5 text-base font-semibold text-slate-50">
            <span aria-hidden>{sector.icon}</span>
            {sector.name}
          </h3>
          <div className="mt-2 flex flex-wrap gap-1">
            {sector.themes.map((t) => (
              <span
                key={t}
                className="rounded-full border border-white/[0.06] bg-white/[0.04] px-1.5 py-px text-[8px] text-slate-400"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold ${heatPillClass(sector.heat)}`}
        >
          {sector.heat}
        </span>
      </div>

      <div className="relative z-[1] mt-3 grid grid-cols-2 gap-2">
        <MetaBlock label="현재 단계" value={sector.currentStage} />
        <MetaBlock label="사이클 위치" value={sector.cyclePosition} highlight />
      </div>

      <CycleBar pct={sector.cyclePct} />

      <p className="relative z-[1] m-0 mt-3 border-l-2 border-indigo-500/30 pl-2.5 text-[11px] leading-relaxed text-slate-400">
        <span className="mb-0.5 block text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          수혜 이유
        </span>
        {sector.beneficiaryReason}
      </p>

      <div className="relative z-[1] mt-4 grid grid-cols-1 gap-3 border-t border-white/[0.06] pt-3 sm:grid-cols-2">
        <StockColumn market="한국" stocks={sector.korea} isKr />
        <StockColumn market="미국" stocks={sector.us} />
      </div>
    </article>
  )
}

/** @param {{ label: string; value: string; highlight?: boolean }} props */
function MetaBlock({ label, value, highlight = false }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-2">
      <p className="m-0 text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p
        className={[
          "m-0 mt-0.5 text-[11px] font-semibold leading-snug",
          highlight ? "text-indigo-200/95" : "text-slate-200",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  )
}

/** @param {{ pct: number }} props */
function CycleBar({ pct }) {
  const v = Math.min(100, Math.max(0, Number(pct) || 0))
  return (
    <div className="relative z-[1] mt-2.5">
      <div className="mb-1 flex justify-between text-[8px] uppercase tracking-[0.12em] text-slate-500">
        <span>사이클 강도</span>
        <span className="font-mono tabular-nums text-slate-400">{v}%</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-600/80 via-violet-500/75 to-cyan-500/70"
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  )
}

/**
 * @param {{ market: string; stocks: import("../data/koreaGrowthSectorMap.js").MapStockRef[]; isKr?: boolean }} props
 */
function StockColumn({ market, stocks, isKr = false }) {
  return (
    <div>
      <p className="m-0 mb-1.5 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        <span
          className={[
            "inline-block h-1.5 w-1.5 rounded-full",
            isKr ? "bg-rose-400/90" : "bg-sky-400/90",
          ].join(" ")}
        />
        {market}
      </p>
      <ul className="m-0 list-none space-y-1.5 p-0">
        {stocks.map((s) => (
          <li
            key={`${s.name}-${s.code || s.ticker}`}
            className="rounded-md border border-white/[0.05] bg-white/[0.02] px-2 py-1.5"
          >
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-[11px] font-semibold text-slate-200">{s.name}</span>
              <span className="shrink-0 font-mono text-[9px] tabular-nums text-slate-500">
                {s.code || s.ticker}
              </span>
            </div>
            {s.tip ? <p className="m-0 mt-0.5 text-[9px] leading-snug text-slate-500">{s.tip}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
