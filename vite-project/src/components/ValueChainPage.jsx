import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { VALUE_CHAIN_SECTORS } from "../data/valueChainSectors.js"
import { buildValueChainHero } from "../utils/valueChainHero.js"
import { buildSectorTree, curatedBySector, heatSortRank } from "../utils/valueChainTree.js"
import { timingBadgeClass, timingSignalForItem } from "../utils/valueChainTiming.js"
import AiBottleneckFlow from "./AiBottleneckFlow.jsx"
import ValueChainStockPanel from "./ValueChainStockPanel.jsx"

function heatPillClass(heat) {
  if (heat === "VERY HOT") return "text-rose-200 bg-rose-500/20 border-rose-300/30"
  if (heat === "HOT") return "text-amber-200 bg-amber-500/20 border-amber-300/30"
  return "text-emerald-200 bg-emerald-500/20 border-emerald-300/30"
}

export default function ValueChainPage({ panicData }) {
  const [sectors, setSectors] = useState(() => VALUE_CHAIN_SECTORS.map((s) => ({ ...s })))
  const [heatUpdatedAt, setHeatUpdatedAt] = useState("-")
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch("/value-chain-heat.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return
        const map = data?.sectorHeat
        setHeatUpdatedAt(data?.updatedAt || "-")
        if (!map || typeof map !== "object") return
        setSectors((prev) =>
          prev.map((s) => ({
            ...s,
            heat: map[s.id] || s.heat,
          })),
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const ordered = useMemo(() => {
    return sectors.slice().sort((a, b) => {
      const ar = heatSortRank(a.heat)
      const br = heatSortRank(b.heat)
      if (ar !== br) return ar - br
      return a.order - b.order
    })
  }, [sectors])

  const hero = useMemo(() => buildValueChainHero(sectors, panicData), [sectors, panicData])

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

      <div className="relative z-[1] px-5 pb-12 pt-10 md:px-10 md:pb-14 md:pt-12">
        <nav className="mb-8 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 md:text-xs" aria-label="플로우 내비게이션">
          <Link to="/cycle" className="text-slate-400 underline-offset-4 transition hover:text-cyan-200/90 hover:underline">
            시장 사이클
          </Link>
          <span className="text-slate-600">→</span>
          <span className="font-medium text-cyan-200/85">산업 흐름</span>
          <span className="text-slate-600">→</span>
          <a href="#ai-bottleneck-flow" className="text-slate-400 underline-offset-4 transition hover:text-cyan-200/90 hover:underline">
            병목
          </a>
          <span className="text-slate-600">→</span>
          <span className="text-slate-500">종목</span>
          <span className="text-slate-600">→</span>
          <Link to="/timing" className="text-slate-400 underline-offset-4 transition hover:text-cyan-200/90 hover:underline">
            타점
          </Link>
        </nav>

        <section className="relative mb-12 overflow-hidden rounded-2xl border border-white/[0.07] bg-[linear-gradient(135deg,rgba(12,20,38,0.95),rgba(6,10,18,0.98))] px-5 py-8 md:px-10 md:py-10">
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background: "radial-gradient(ellipse 90% 80% at 20% 0%, rgba(34,211,238,0.12), transparent 52%), radial-gradient(ellipse 60% 50% at 100% 100%, rgba(167,139,250,0.08), transparent 50%)",
            }}
            aria-hidden
          />
          <div className="relative z-[1]">
            <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.26em] text-cyan-200/75 md:text-[11px]">Market control · Korea</p>
            <h1 className="m-0 mt-3 font-['Playfair_Display',Georgia,serif] text-[1.75rem] font-semibold leading-[1.1] tracking-tight text-[#e8ecf4] md:text-[2.25rem]">
              KOREA VALUE
              <br />
              CHAIN MAP
            </h1>
            <dl className="m-0 mt-8 grid max-w-2xl gap-5 text-sm md:grid-cols-1 md:gap-6 md:text-[0.95rem]">
              <div>
                <dt className="m-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">현재 시장 에너지</dt>
                <dd className="m-0 mt-1.5 font-medium text-cyan-100/95">{hero.marketEnergy}</dd>
              </div>
              <div>
                <dt className="m-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">핵심 흐름</dt>
                <dd className="m-0 mt-1.5 text-slate-200">{hero.coreFlow}</dd>
              </div>
              <div>
                <dt className="m-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">위험 상태</dt>
                <dd className="m-0 mt-1.5 text-slate-200">{hero.riskState}</dd>
              </div>
            </dl>
            <p className="m-0 mt-6 text-[11px] text-slate-600">Heat 기준일 · {heatUpdatedAt}</p>
          </div>
        </section>

        <h2 className="m-0 font-['Playfair_Display',Georgia,serif] text-lg font-semibold text-slate-100 md:text-xl">메인 산업 밸류체인</h2>
        <p className="m-0 mt-2 max-w-2xl text-xs text-slate-500 md:text-sm">13개 산업군 · 수요단 / 생산단 / 부품단 공급망</p>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 xl:gap-7">
          {ordered.map((sector, index) => {
            const curated = curatedBySector(sector)
            const { tree, stages } = buildSectorTree(sector)
            const counts = curated.all.length
            return (
              <article
                key={sector.id}
                className="group relative flex flex-col rounded-2xl border border-[rgba(146,164,201,0.26)] bg-[linear-gradient(180deg,rgba(18,28,52,0.82),rgba(10,16,34,0.92))] p-5 shadow-[0_0_0_1px_rgba(88,132,255,0.1),0_22px_52px_rgba(0,0,0,0.34)] transition duration-300 md:p-6"
              >
                <div
                  className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition duration-300 group-hover:opacity-100"
                  style={{
                    background: "radial-gradient(circle at 85% 0%, rgba(119,193,255,0.12), transparent 55%)",
                  }}
                  aria-hidden
                />
                <div className="relative z-[1] mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="m-0 text-[11px] tracking-[0.16em] text-blue-200/65">SECTOR {String(index + 1).padStart(2, "0")}</p>
                    <h3 className="m-0 mt-1.5 text-lg font-semibold leading-snug text-slate-100 md:text-xl">
                      {sector.icon} {sector.name}
                    </h3>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium md:text-[11px] ${heatPillClass(sector.heat)}`}>
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

                <div className="relative z-[1] rounded-xl border border-[rgba(146,164,201,0.28)] bg-[linear-gradient(180deg,rgba(16,24,44,0.75),rgba(10,16,34,0.88))] p-3.5 md:p-4">
                  <p className="m-0 text-[11px] text-slate-400">핵심 종목 · 표시 {counts}</p>
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
                                        className="group/stock inline-flex max-w-full flex-wrap items-center gap-1 rounded-lg border border-slate-500/30 bg-slate-900/40 px-2 py-1 text-left transition duration-200 hover:border-cyan-400/45 hover:bg-cyan-500/[0.12] hover:shadow-[0_0_22px_rgba(34,211,238,0.18)] md:gap-1.5"
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

        <AiBottleneckFlow sectors={sectors} />
      </div>

      {selected ? (
        <ValueChainStockPanel stock={selected.stock} sectorName={selected.sectorName} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  )
}
