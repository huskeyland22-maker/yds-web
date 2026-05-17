import { useMemo, useState } from "react"
import {
  KOREA_GROWTH_SECTOR_MAP,
  KOREA_INDUSTRY_FLOW,
  KOREA_MAP_THEMES,
} from "../data/koreaGrowthSectorMap.js"

function heatPillClass(heat) {
  const h = String(heat || "").toUpperCase()
  if (h === "VERY HOT") return "border-rose-400/35 bg-rose-500/15 text-rose-200"
  if (h === "HOT") return "border-amber-400/35 bg-amber-500/15 text-amber-200"
  if (h === "WARM") return "border-sky-400/30 bg-sky-500/12 text-sky-200"
  return "border-slate-500/25 bg-slate-500/10 text-slate-400"
}

function interestClass(level) {
  if (/매우|상위/.test(level)) return "text-rose-200/90"
  if (/높/.test(level)) return "text-amber-200/90"
  if (/보통|중/.test(level)) return "text-slate-300"
  return "text-slate-500"
}

/**
 * @param {{
 *   sectors?: import("../data/koreaGrowthSectorMap.js").KoreaSectorCard[]
 *   heatById?: Record<string, string>
 *   onSectorAnchor?: (sectorId: string) => void
 * }} props
 */
export default function KoreaGrowthSectorMap({
  sectors = KOREA_GROWTH_SECTOR_MAP,
  heatById = {},
  onSectorAnchor,
}) {
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
    const theme = KOREA_MAP_THEMES.find((t) => t.id === themeFilter)
    if (!theme) return merged
    return merged.filter((s) => s.themes.includes(theme.label))
  }, [merged, themeFilter])

  const scrollToSector = (sectorId) => {
    if (onSectorAnchor) {
      onSectorAnchor(sectorId)
      return
    }
    const el = document.getElementById(`korea-sector-${sectorId}`)
    el?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="space-y-10">
      <section id="growth-sector-map" className="relative z-[1] scroll-mt-24">
        <header className="mb-5 border-b border-white/[0.06] pb-4">
          <p className="m-0 font-mono text-[9px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Korea Value Chain · v1
          </p>
          <h2 className="m-0 mt-2 font-['Playfair_Display',Georgia,serif] text-lg font-semibold tracking-tight text-slate-50 md:text-xl">
            국내 메가트렌드 섹터 맵
          </h2>
          <p className="m-0 mt-2 max-w-2xl text-[11px] leading-relaxed text-slate-500 md:text-xs">
            국내 산업 재편·순환매·메가트렌드 수혜 축을 기관 리포트 형식으로 정리합니다. 대표 종목은
            <span className="text-slate-400"> 국내 상장</span> 기준입니다.
          </p>
          <ul className="m-0 mt-3 flex flex-wrap gap-x-4 gap-y-1 list-none p-0 text-[10px] text-slate-500">
            <li>· 산업 재편</li>
            <li>· 순환매</li>
            <li>· 메가트렌드 수혜</li>
            <li>· 국내 대표 종목 추적</li>
          </ul>
        </header>

        <div className="mb-5 flex flex-wrap gap-2">
          <ThemeChip active={themeFilter === "all"} onClick={() => setThemeFilter("all")} label="전체" />
          {KOREA_MAP_THEMES.map((t) => (
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
            <GrowthSectorCard
              key={sector.id}
              sector={sector}
              index={index}
              onLinkClick={scrollToSector}
            />
          ))}
        </div>
      </section>

      <KoreaIndustryFlowMap flow={KOREA_INDUSTRY_FLOW} onNodeClick={scrollToSector} />
    </div>
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

/**
 * @param {{
 *   sector: import("../data/koreaGrowthSectorMap.js").KoreaSectorCard
 *   index: number
 *   onLinkClick: (id: string) => void
 * }} props
 */
function GrowthSectorCard({ sector, index, onLinkClick }) {
  return (
    <article
      id={`korea-sector-${sector.id}`}
      className="group relative scroll-mt-28 flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[linear-gradient(165deg,rgba(16,22,36,0.95),rgba(8,10,18,0.98))] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)] transition duration-300 hover:border-indigo-500/25 md:p-5"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: "radial-gradient(circle at 100% 0%, rgba(99,102,241,0.12), transparent 55%)",
        }}
        aria-hidden
      />

      <div className="relative z-[1] flex items-start justify-between gap-2 border-b border-white/[0.06] pb-3">
        <div className="min-w-0">
          <p className="m-0 font-mono text-[9px] tracking-[0.14em] text-slate-600">
            KR SECTOR {String(index + 1).padStart(2, "0")}
          </p>
          <h3 className="m-0 mt-1 flex items-center gap-1.5 text-base font-semibold text-slate-50">
            <span aria-hidden>{sector.icon}</span>
            {sector.name}
          </h3>
          <div className="mt-2 flex flex-wrap gap-1">
            {sector.themes.map((t) => (
              <span
                key={t}
                className="rounded border border-white/[0.06] bg-white/[0.03] px-1.5 py-px text-[8px] text-slate-500"
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

      <div className="relative z-[1] mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetaBlock label="현재 단계" value={sector.currentStage} />
        <MetaBlock label="사이클 위치" value={sector.cyclePosition} highlight />
        <MetaBlock label="시장 온도" value={sector.marketTemperature} />
        <MetaBlock
          label="관심도"
          value={sector.interestLevel}
          valueClassName={interestClass(sector.interestLevel)}
        />
      </div>

      <CycleBar pct={sector.cyclePct} />

      <div className="relative z-[1] m-0 mt-3 rounded-lg border border-white/[0.05] bg-black/20 px-3 py-2.5">
        <p className="m-0 text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-500">수혜 논리</p>
        <p className="m-0 mt-1 text-[11px] leading-relaxed text-slate-400">{sector.beneficiaryReason}</p>
      </div>

      {sector.relatedLinks?.length > 0 ? (
        <div className="relative z-[1] mt-3">
          <p className="m-0 text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            관련 산업 연결
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {sector.relatedLinks.map((link) => (
              <button
                key={link.sectorId}
                type="button"
                onClick={() => onLinkClick(link.sectorId)}
                className="rounded-full border border-indigo-500/25 bg-indigo-500/10 px-2 py-0.5 text-[9px] font-medium text-indigo-200/90 transition hover:border-indigo-400/40 hover:bg-indigo-500/15"
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="relative z-[1] mt-4 border-t border-white/[0.06] pt-3">
        <p className="m-0 mb-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          국내 대표 종목
        </p>
        <ul className="m-0 list-none space-y-1.5 p-0">
          {sector.stocks.map((s) => (
            <li
              key={`${s.code}-${s.name}`}
              className="flex items-baseline justify-between gap-2 rounded-md border border-white/[0.05] bg-white/[0.02] px-2.5 py-1.5"
            >
              <div className="min-w-0">
                <span className="text-[11px] font-semibold text-slate-200">{s.name}</span>
                {s.tip ? (
                  <p className="m-0 mt-0.5 text-[9px] leading-snug text-slate-500">{s.tip}</p>
                ) : null}
              </div>
              <span className="shrink-0 font-mono text-[10px] font-medium tabular-nums text-slate-400">
                {s.code}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}

/** @param {{ label: string; value: string; highlight?: boolean; valueClassName?: string }} props */
function MetaBlock({ label, value, highlight = false, valueClassName = "" }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/25 px-2 py-1.5">
      <p className="m-0 text-[7px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p
        className={[
          "m-0 mt-0.5 text-[10px] font-semibold leading-snug",
          valueClassName || (highlight ? "text-indigo-200/95" : "text-slate-200"),
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
 * @param {{
 *   flow: import("../data/koreaGrowthSectorMap.js").IndustryFlowNode[]
 *   onNodeClick: (sectorId: string) => void
 * }} props
 */
function KoreaIndustryFlowMap({ flow, onNodeClick }) {
  return (
    <section
      id="korea-industry-flow"
      className="scroll-mt-24 rounded-2xl border border-white/[0.08] bg-[linear-gradient(180deg,rgba(10,14,24,0.98),rgba(6,8,14,0.99))] px-4 py-6 md:px-8 md:py-8"
    >
      <header className="mb-6 text-center">
        <p className="m-0 font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          Industry linkage map
        </p>
        <h2 className="m-0 mt-2 font-['Playfair_Display',Georgia,serif] text-base font-semibold text-slate-100 md:text-lg">
          국내 산업 연결 맵
        </h2>
        <p className="m-0 mt-1.5 text-[10px] text-slate-500">AI 수요 → 전력·소재 → 원전·자동화 (기관 리포트 스키마)</p>
      </header>

      <div className="mx-auto flex max-w-[200px] flex-col items-center gap-0">
        {flow.map((node, i) => (
          <div key={node.id} className="flex w-full flex-col items-center">
            <button
              type="button"
              onClick={() => node.sectorId && onNodeClick(node.sectorId)}
              disabled={!node.sectorId}
              className={[
                "w-full rounded-lg border px-4 py-2.5 text-center text-[12px] font-semibold transition",
                node.sectorId
                  ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-100 hover:border-indigo-400/45 hover:bg-indigo-500/15"
                  : "border-white/[0.08] bg-white/[0.03] text-slate-400",
              ].join(" ")}
            >
              {node.label}
            </button>
            {i < flow.length - 1 ? (
              <span className="my-1 select-none text-slate-600" aria-hidden>
                ↓
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <p className="m-0 mt-6 text-center text-[9px] leading-relaxed text-slate-600">
        글로벌(미국·ETF) 데이터는{" "}
        <span className="text-slate-500">03 글로벌 메가트렌드</span> 페이지에서 분리 제공 예정
      </p>
    </section>
  )
}
