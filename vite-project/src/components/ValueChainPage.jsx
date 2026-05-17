import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { VALUE_CHAIN_SECTORS } from "../data/valueChainSectors.js"
import { useAppDataStore } from "../store/appDataStore.js"
import { usePanicStore } from "../store/panicStore.js"
import { ValueChainHeatTraceBadge } from "./DataTraceBadge.jsx"
import { buildSectorTree, curatedBySector, heatSortRank } from "../utils/valueChainTree.js"
import { timingBadgeClass, timingSignalForItem } from "../utils/valueChainTiming.js"
import AiBottleneckFlow from "./AiBottleneckFlow.jsx"
import KoreaValueChainDesk from "./KoreaValueChainDesk.jsx"
import ValueChainStockPanel from "./ValueChainStockPanel.jsx"
import ValueChainStockSignals from "./ValueChainStockSignals.jsx"

/** @type {Record<string, string[]>} */
const GROWTH_TO_VC_HEAT_IDS = {
  "ai-infra": ["ai-datacenter-infra", "hbm-ai-semiconductor"],
  semiconductor: ["hbm-ai-semiconductor"],
  "power-grid": ["power-grid-hvdc", "power-semiconductor-electronics"],
  nuclear: ["nuclear-smr"],
  "copper-wire": ["power-grid-hvdc"],
  "robot-automation": ["on-device-ai-robotics"],
  defense: ["defense"],
}

function heatPillClass(heat) {
  if (heat === "VERY HOT") return "text-rose-200 bg-rose-500/20 border-rose-300/30"
  if (heat === "HOT") return "text-amber-200 bg-amber-500/20 border-amber-300/30"
  return "text-emerald-200 bg-emerald-500/20 border-emerald-300/30"
}

function sectorMomentumPct(heat) {
  const h = String(heat || "").toUpperCase()
  if (h === "VERY HOT") return 100
  if (h === "HOT") return 72
  if (h === "WARM") return 44
  return 24
}

function SectorMomentumBar({ heat }) {
  const pct = sectorMomentumPct(heat)
  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between text-[9px] uppercase tracking-[0.14em] text-slate-500">
        <span>Sector momentum</span>
        <span className="font-mono tabular-nums text-slate-400">{pct}%</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-600/75 via-indigo-500/70 to-sky-500/65 shadow-[0_0_12px_rgba(99,102,241,0.25)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function ValueChainPage({
  panicData: panicDataProp,
  marketCycleStage,
  finderCandidates = [],
  insightWarnings = [],
}) {
  const panicFromStore = usePanicStore((s) => s.panicData)
  const panicData = panicFromStore ?? panicDataProp
  const sectorHeatMap = useAppDataStore((s) => s.sectorHeatMap)
  const fetchSectorHeat = useAppDataStore((s) => s.fetchSectorHeat)

  const [sectors, setSectors] = useState(() => VALUE_CHAIN_SECTORS.map((s) => ({ ...s })))
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    void fetchSectorHeat()
  }, [fetchSectorHeat, panicData?.updatedAt])

  useEffect(() => {
    if (!sectorHeatMap || typeof sectorHeatMap !== "object") return
    setSectors((prev) =>
      prev.map((s) => ({
        ...s,
        heat: sectorHeatMap[s.id] || s.heat,
      })),
    )
  }, [sectorHeatMap])

  useEffect(() => {
    if (typeof window === "undefined" || window.location.hash !== "#stock-signals") return
    const el = document.getElementById("stock-signals")
    if (!el) return
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 120)
    return () => window.clearTimeout(t)
  }, [sectors.length])

  const ordered = useMemo(() => {
    return sectors.slice().sort((a, b) => {
      const ar = heatSortRank(a.heat)
      const br = heatSortRank(b.heat)
      if (ar !== br) return ar - br
      return a.order - b.order
    })
  }, [sectors])

  const growthHeatById = useMemo(() => {
    const byVc = Object.fromEntries(sectors.map((s) => [s.id, s.heat]))
    const rank = (h) => {
      const u = String(h || "").toUpperCase()
      if (u === "VERY HOT") return 4
      if (u === "HOT") return 3
      if (u === "WARM") return 2
      return 1
    }
    const labelFromRank = (r) => {
      if (r >= 4) return "VERY HOT"
      if (r >= 3) return "HOT"
      if (r >= 2) return "WARM"
      return "COOL"
    }
    /** @type {Record<string, string>} */
    const out = {}
    for (const [growthId, vcIds] of Object.entries(GROWTH_TO_VC_HEAT_IDS)) {
      let best = 0
      for (const id of vcIds) {
        best = Math.max(best, rank(byVc[id]))
      }
      if (best > 0) out[growthId] = labelFromRank(best)
    }
    return out
  }, [sectors])

  return (
    <div className="relative overflow-hidden rounded-[1.35rem] border border-[rgba(146,164,201,0.2)] bg-[#0c1222] shadow-[0_0_0_1px_rgba(88,132,255,0.08),0_32px_80px_rgba(0,0,0,0.5)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(165deg,#0b0f14_0%,#11161c_38%,#1a2438_100%)]" aria-hidden />
      <div
        className="pointer-events-none absolute -right-[10%] -top-[12%] h-[min(50vw,460px)] w-[min(50vw,460px)] rounded-full opacity-[0.36]"
        style={{ background: "radial-gradient(circle, rgba(198,163,90,0.2), transparent 70%)", filter: "blur(76px)" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-[20%] -left-[14%] h-[min(65vw,540px)] w-[min(65vw,540px)] rounded-full opacity-[0.3]"
        style={{ background: "radial-gradient(circle, rgba(61,90,128,0.4), transparent 65%)", filter: "blur(84px)" }}
        aria-hidden
      />

      <div className="relative z-[1] px-5 pb-8 pt-6 md:px-8 md:pb-10 md:pt-8">
        <nav className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 md:text-xs" aria-label="플로우 내비게이션">
          <Link to="/cycle" className="text-slate-400 underline-offset-4 transition hover:text-cyan-200/90 hover:underline">
            시장 사이클
          </Link>
          <span className="text-slate-600">→</span>
          <span className="font-medium text-cyan-200/85">산업 흐름</span>
          <span className="text-slate-600">→</span>
          <a href="#korea-compressed-map" className="text-slate-400 underline-offset-4 transition hover:text-cyan-200/90 hover:underline">
            산업맵
          </a>
          <span className="text-slate-600">→</span>
          <a href="#korea-sector-details" className="text-slate-400 underline-offset-4 transition hover:text-cyan-200/90 hover:underline">
            상세
          </a>
          <span className="text-slate-600">→</span>
          <a href="#ai-bottleneck-flow" className="text-slate-400 underline-offset-4 transition hover:text-cyan-200/90 hover:underline">
            병목
          </a>
          <span className="text-slate-600">→</span>
          <span className="text-slate-500">종목</span>
          <span className="text-slate-600">→</span>
          <a href="#stock-signals" className="text-slate-400 underline-offset-4 transition hover:text-cyan-200/90 hover:underline">
            종목 시그널
          </a>
        </nav>

        <ValueChainHeatTraceBadge className="mb-3" />

        <KoreaValueChainDesk
          heatById={growthHeatById}
          onStockSelect={(payload) => setSelected(payload)}
        >
          <section className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-4 md:px-4">
            <h2 className="m-0 text-sm font-semibold text-slate-200">메인 산업 밸류체인</h2>
            <p className="m-0 mt-1 text-[10px] text-slate-500">
              13개 산업군 · 수요단 / 생산단 / 부품단 · 종목 클릭 시 한국투자 연결
            </p>
          </section>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">

          {ordered.map((sector, index) => {
            const curated = curatedBySector(sector)
            const { tree, stages } = buildSectorTree(sector)
            const counts = curated.all.length
            return (
              <article
                key={sector.id}
                className="group relative flex flex-col rounded-2xl border border-white/[0.07] bg-[rgba(12,14,18,0.95)] p-4 transition duration-200 hover:border-white/12 md:p-5"
              >
                <div className="relative z-[1] mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="m-0 font-mono text-[10px] tracking-[0.12em] text-slate-500">SECTOR {String(index + 1).padStart(2, "0")}</p>
                    <h3 className="m-0 mt-1 text-base font-semibold leading-snug tracking-tight text-slate-50 md:text-lg">
                      {sector.icon} {sector.name}
                    </h3>
                    <SectorMomentumBar heat={sector.heat} />
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold md:text-[10px] ${heatPillClass(sector.heat)}`}>
                    {sector.heat}
                  </span>
                </div>

                {sector.sections?.length ? (
                  <div className="relative z-[1] mb-4 flex flex-wrap gap-1.5">
                    {sector.sections.map((label) => (
                      <span
                        key={label}
                        className="rounded-full border border-blue-300/25 bg-blue-500/10 px-2 py-0.5 text-[11px] text-blue-100/90"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="relative z-[1] rounded-xl border border-white/[0.06] bg-black/30 p-3 md:p-3.5">
                  <p className="m-0 text-[10px] font-medium text-slate-500">핵심 종목 · {counts}</p>
                  <div className="mt-3 space-y-3">
                    {stages.map((stage) => (
                      <div key={stage}>
                        <span className="inline-flex items-center gap-1 rounded-full border border-sky-300/35 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-100">
                          {stage}
                        </span>
                        <div className="relative ml-2 mt-2 border-l border-dashed border-slate-500/35 pl-3">
                          {Object.keys(tree[stage]).map((sub) => (
                            <div key={`${stage}-${sub}`} className="mb-2.5 last:mb-0">
                              <span className="inline-flex rounded-full border border-amber-200/25 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-100/95">
                                {sub}
                              </span>
                              <div className="relative ml-1 mt-1.5 border-l border-dashed border-slate-600/30 pl-2.5">
                                <div className="flex flex-wrap gap-1.5">
                                  {tree[stage][sub].map((item) => {
                                    const sig = timingSignalForItem(item, stage)
                                    return (
                                      <button
                                        key={item.code || item.name}
                                        type="button"
                                        onClick={() => setSelected({ stock: item, sectorName: sector.name })}
                                        className="group/stock inline-flex max-w-full flex-wrap items-center gap-1 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-left transition duration-200 hover:border-indigo-400/30 hover:bg-indigo-500/[0.06] md:gap-1.5"
                                      >
                                        <span className="text-[11px] text-slate-200 group-hover/stock:text-white md:text-xs">{item.name}</span>
                                        <span
                                          className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-medium md:text-[10px] ${timingBadgeClass(sig.tone)}`}
                                        >
                                          {sig.label}
                                        </span>
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        <div className="mt-8">
          <ValueChainStockSignals
            sectors={sectors}
            finderCandidates={finderCandidates}
            insightWarnings={insightWarnings}
            onSelectStock={(row) => setSelected({ stock: row, sectorName: row.sectorName })}
          />
        </div>

        <AiBottleneckFlow sectors={sectors} />
        </KoreaValueChainDesk>
      </div>

      {selected ? (
        <ValueChainStockPanel stock={selected.stock} sectorName={selected.sectorName} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  )
}
