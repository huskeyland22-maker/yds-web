import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { VALUE_CHAIN_SECTORS } from "../data/valueChainSectors.js"
import { buildValueChainHeaderBundle } from "../utils/valueChainHero.js"
import { buildTodaysKeySignal } from "../utils/macroTerminalPulse.js"
import { buildSectorTree, curatedBySector, heatSortRank } from "../utils/valueChainTree.js"
import { timingBadgeClass, timingSignalForItem } from "../utils/valueChainTiming.js"
import AiBottleneckFlow from "./AiBottleneckFlow.jsx"
import ValueChainStockPanel from "./ValueChainStockPanel.jsx"

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

export default function ValueChainPage({ panicData, marketCycleStage }) {
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

  const header = useMemo(() => buildValueChainHeaderBundle(sectors, panicData), [sectors, panicData])
  const todaysKey = useMemo(
    () => buildTodaysKeySignal(sectors, panicData, marketCycleStage),
    [sectors, panicData, marketCycleStage],
  )

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

        <section className="relative mb-7 min-h-0 overflow-hidden rounded-2xl border border-white/[0.07] bg-[linear-gradient(145deg,rgba(14,18,28,0.97),rgba(8,10,16,0.99))] px-4 py-5 md:px-6 md:py-6">
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 12% 0%, rgba(99,102,241,0.09), transparent 52%), radial-gradient(ellipse 50% 40% at 100% 100%, rgba(56,189,248,0.06), transparent 50%)",
            }}
            aria-hidden
          />
          <div className="relative z-[1] grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_minmax(240px,300px)] lg:gap-8">
            <div className="min-w-0">
              <p className="m-0 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">Research desk · Korea</p>
              <p className="m-0 mt-2 text-[1.05rem] font-semibold leading-snug tracking-tight text-slate-50 md:text-[1.2rem]">
                한국 시장의 가치 흐름을 한눈에
              </p>
              <p className="m-0 mt-2 font-display text-[0.95rem] font-semibold leading-none tracking-[-0.02em] text-slate-400 md:text-[1.05rem]">
                KOREA VALUE CHAIN MAP
              </p>
              <dl className="m-0 mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-white/[0.05] bg-black/25 px-3 py-2.5">
                  <dt className="m-0 text-[9px] font-medium uppercase tracking-[0.16em] text-slate-500">현재 시장 에너지</dt>
                  <dd className="m-0 mt-1 text-[12px] font-medium leading-snug text-cyan-100/95">{header.marketEnergy}</dd>
                </div>
                <div className="rounded-lg border border-white/[0.05] bg-black/25 px-3 py-2.5">
                  <dt className="m-0 text-[9px] font-medium uppercase tracking-[0.16em] text-slate-500">핵심 흐름</dt>
                  <dd className="m-0 mt-1 text-[12px] leading-snug text-slate-200">{header.coreFlow}</dd>
                </div>
                <div className="rounded-lg border border-white/[0.05] bg-black/25 px-3 py-2.5">
                  <dt className="m-0 text-[9px] font-medium uppercase tracking-[0.16em] text-slate-500">위험 신호</dt>
                  <dd className="m-0 mt-1 text-[12px] leading-snug text-slate-300">{header.riskState}</dd>
                </div>
                <div className="rounded-lg border border-white/[0.05] bg-black/25 px-3 py-2.5">
                  <dt className="m-0 text-[9px] font-medium uppercase tracking-[0.16em] text-slate-500">오늘 핵심 테마</dt>
                  <dd className="m-0 mt-1 text-[12px] leading-snug text-indigo-200/95">{todaysKey.theme}</dd>
                </div>
              </dl>
              <p className="m-0 mt-3 font-mono text-[9px] text-slate-600">Heat · {heatUpdatedAt}</p>
            </div>

            <aside
              className="rounded-xl border border-indigo-500/20 bg-[rgba(6,8,14,0.85)] px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_24px_rgba(79,70,229,0.08)] md:px-4 md:py-3.5"
              aria-label="오늘의 핵심 시그널"
            >
              <p className="m-0 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-indigo-300/80">
                Today&apos;s key signal
              </p>
              <div className="m-0 mt-3 space-y-2.5 text-[11px] leading-snug">
                <div className="flex items-start justify-between gap-2 border-b border-white/[0.06] pb-2">
                  <span className="text-slate-500">Risk-on / off</span>
                  <span className="text-right font-semibold text-slate-100">{todaysKey.riskOnOff}</span>
                </div>
                <p className="m-0 text-right font-mono text-[9px] text-slate-500">{todaysKey.riskDetail}</p>
                <div className="flex items-start justify-between gap-2 border-b border-white/[0.06] pb-2">
                  <span className="text-slate-500">Leading sector</span>
                  <span className="max-w-[11rem] text-right font-medium text-slate-100">{todaysKey.leadingSector}</span>
                </div>
                <div className="flex items-start justify-between gap-2 border-b border-white/[0.06] pb-2">
                  <span className="text-slate-500">Foreign flow</span>
                  <span className="max-w-[11rem] text-right text-slate-200">{todaysKey.foreignFlow}</span>
                </div>
                <div className="flex items-start justify-between gap-2 pt-0.5">
                  <span className="text-slate-500">Market cycle</span>
                  <span className="font-mono text-indigo-200/95">{todaysKey.marketCycle}</span>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <h2 className="m-0 font-['Playfair_Display',Georgia,serif] text-base font-semibold tracking-tight text-slate-100 md:text-lg">
          메인 산업 밸류체인
        </h2>
        <p className="m-0 mt-1.5 max-w-2xl text-[11px] leading-snug text-slate-500 md:text-xs">
          13개 산업군 · 수요단 / 생산단 / 부품단 공급망
        </p>

        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 xl:grid-cols-3 xl:gap-6">
          {ordered.map((sector, index) => {
            const curated = curatedBySector(sector)
            const { tree, stages } = buildSectorTree(sector)
            const counts = curated.all.length
            return (
              <article
                key={sector.id}
                className="group relative flex flex-col rounded-2xl border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,20,32,0.92),rgba(8,10,18,0.96))] p-4 shadow-[0_0_0_1px_rgba(99,102,241,0.06),0_16px_40px_rgba(0,0,0,0.4)] transition duration-300 hover:border-indigo-500/25 hover:shadow-[0_0_0_1px_rgba(99,102,241,0.12),0_20px_48px_rgba(0,0,0,0.45),0_0_28px_rgba(79,70,229,0.06)] md:p-5"
              >
                <div
                  className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition duration-300 group-hover:opacity-100"
                  style={{
                    background: "radial-gradient(circle at 90% 0%, rgba(129,140,248,0.1), transparent 55%)",
                  }}
                  aria-hidden
                />
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
                                        className="group/stock inline-flex max-w-full flex-wrap items-center gap-1 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-left transition duration-200 hover:border-indigo-400/35 hover:bg-indigo-500/[0.08] hover:shadow-[0_0_16px_rgba(99,102,241,0.12)] md:gap-1.5"
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
