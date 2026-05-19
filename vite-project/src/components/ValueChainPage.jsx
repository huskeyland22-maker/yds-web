import { useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { VALUE_CHAIN_SECTORS } from "../data/valueChainSectors.js"
import { useAppDataStore } from "../store/appDataStore.js"
import { usePanicStore } from "../store/panicStore.js"
import { ValueChainHeatTraceBadge } from "./DataTraceBadge.jsx"
import { resolveGrowthSectorIdFromQuery } from "../utils/sectorFlowNav.js"
import { ensurePageScrollUnlocked, scrollToValueChainSection } from "../utils/valueChainSectorNav.js"
import KoreaValueChainDesk from "./KoreaValueChainDesk.jsx"
import ValueChainStockPanel from "./ValueChainStockPanel.jsx"

/** @type {Record<string, string[]>} */
const GROWTH_TO_VC_HEAT_IDS = {
  "ai-semiconductor": ["ai-datacenter-infra", "hbm-ai-semiconductor"],
  "power-infra": ["power-grid-hvdc", "power-semiconductor-electronics"],
  "nuclear-energy": ["nuclear-smr"],
  "robot-automation": ["on-device-ai-robotics"],
  "defense-space": ["defense", "aerospace"],
  shipbuilding: ["shipbuilding-offshore"],
  "bio-healthcare": ["biosimilar-cdmo"],
  "battery-materials": ["power-semiconductor-electronics"],
}

export default function ValueChainPage({
  panicData: panicDataProp,
  marketCycleStage: _marketCycleStage,
  finderCandidates = [],
  insightWarnings = [],
}) {
  const panicFromStore = usePanicStore((s) => s.panicData)
  const panicData = panicFromStore ?? panicDataProp
  const sectorHeatMap = useAppDataStore((s) => s.sectorHeatMap)
  const fetchSectorHeat = useAppDataStore((s) => s.fetchSectorHeat)
  const [searchParams] = useSearchParams()

  const sectorFromQuery = useMemo(
    () => resolveGrowthSectorIdFromQuery(searchParams.get("sector")),
    [searchParams],
  )
  const stockCodeFromQuery = searchParams.get("code")

  const [sectors, setSectors] = useState(() => VALUE_CHAIN_SECTORS.map((s) => ({ ...s })))
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    void fetchSectorHeat()
  }, [fetchSectorHeat, panicData?.updatedAt])

  useEffect(() => {
    if (typeof document === "undefined") return
    document.body.classList.add("valuechain-route-active")
    document.documentElement.classList.add("valuechain-route-active")

    const main = document.querySelector("main")
    const column = main?.parentElement ?? null
    const shell = column?.parentElement ?? null
    main?.classList.add("value-chain-main-host")
    column?.classList.add("value-chain-column-host")
    shell?.classList.add("value-chain-shell-host")

    ensurePageScrollUnlocked()
    return () => {
      document.body.classList.remove("valuechain-route-active")
      document.documentElement.classList.remove("valuechain-route-active")
      main?.classList.remove("value-chain-main-host")
      column?.classList.remove("value-chain-column-host")
      shell?.classList.remove("value-chain-shell-host")
    }
  }, [])

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
    if (typeof window === "undefined" || window.location.hash !== "#industry-signal-board") return
    const el = document.getElementById("industry-signal-board")
    if (!el) return
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 120)
    return () => window.clearTimeout(t)
  }, [sectors.length])

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
    <div className="value-chain-page value-chain-layout relative overflow-visible rounded-[1.35rem] border border-[rgba(146,164,201,0.2)] bg-[#0c1222] shadow-[0_0_0_1px_rgba(88,132,255,0.08),0_32px_80px_rgba(0,0,0,0.5)]">
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

      <div className="value-chain-content relative z-[1] px-5 pb-3 pt-6 md:px-8 md:pb-4 md:pt-8">
        <nav className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 md:text-xs" aria-label="플로우 내비게이션">
          <Link to="/cycle" className="text-slate-400 underline-offset-4 transition hover:text-cyan-200/90 hover:underline">
            시장 사이클
          </Link>
          <span className="text-slate-600">→</span>
          <span className="font-medium text-cyan-200/85">산업 흐름</span>
          <span className="text-slate-600">→</span>
          <a
            href="/value-chain"
            className="text-slate-400 underline-offset-4 transition hover:text-cyan-200/90 hover:underline"
            onClick={(e) => {
              e.preventDefault()
              scrollToValueChainSection("industry-map")
            }}
          >
            산업맵
          </a>
          <span className="text-slate-600">→</span>
          <span className="text-slate-500">종목</span>
          <span className="text-slate-600">→</span>
          <a
            href="#industry-signal-board"
            className="text-slate-400 underline-offset-4 transition hover:text-cyan-200/90 hover:underline"
          >
            산업 시그널
          </a>
        </nav>

        <ValueChainHeatTraceBadge className="mb-3" />

        <KoreaValueChainDesk
          heatById={growthHeatById}
          initialSectorId={sectorFromQuery}
          highlightStockCode={stockCodeFromQuery}
          onStockSelect={(payload) => setSelected(payload)}
        />
      </div>

      {selected ? (
        <ValueChainStockPanel stock={selected.stock} sectorName={selected.sectorName} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  )
}
