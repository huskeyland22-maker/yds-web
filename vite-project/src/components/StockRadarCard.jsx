import { useMemo } from "react"
import { buildStockRadar } from "../utils/stockRadarEngine.js"

function toneClass(tone) {
  if (tone === "emerald") return "text-emerald-300"
  if (tone === "rose") return "text-rose-300"
  if (tone === "sky") return "text-sky-300"
  if (tone === "amber") return "text-amber-300"
  return "text-gray-300"
}

export default function StockRadarCard({ brief, score }) {
  const radar = useMemo(() => buildStockRadar({ brief, score }), [brief, score])

  return (
    <section className="rounded-2xl border border-cyan-500/20 bg-[#0b1220]/85 p-4 sm:p-5">
      <p className="m-0 text-xs font-semibold tracking-wide text-cyan-300">TRADER RADAR</p>
      <h3 className="m-0 mt-1 text-lg font-bold text-gray-100">{radar.headline}</h3>
      <p className="m-0 mt-1 text-xs text-gray-400">{radar.subline}</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3">
          <p className="m-0 text-xs font-semibold text-emerald-300">강세 섹터</p>
          <div className="mt-1 space-y-1">
            {radar.strongSectors.map((sector) => (
              <p key={sector.name} className="m-0 text-xs text-gray-100">
                {sector.name} <span className="text-emerald-300">{sector.score}</span>
              </p>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3">
          <p className="m-0 text-xs font-semibold text-amber-300">약세 섹터</p>
          <div className="mt-1 space-y-1">
            {radar.weakSectors.map((sector) => (
              <p key={sector.name} className="m-0 text-xs text-gray-100">
                {sector.name} <span className="text-amber-300">{sector.score}</span>
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {radar.candidates.map((item) => (
          <article key={item.ticker} className="rounded-xl border border-gray-700/80 bg-[#111827]/80 p-3">
            <div className="flex items-center justify-between">
              <p className="m-0 text-sm font-semibold text-gray-100">{item.name}</p>
              <p className="m-0 font-mono text-[11px] text-gray-500">{item.ticker}</p>
            </div>
            <p className="m-0 mt-1 text-[11px] text-gray-400">{item.sector}</p>
            <p className={`m-0 mt-1 text-xs font-semibold ${toneClass(item.signal.tone)}`}>{item.signal.tag}</p>
            <p className="m-0 mt-1 text-xs text-gray-300">{item.signal.desc}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.techSignals.map((sig) => (
                <span key={sig} className="rounded-md border border-gray-600/70 bg-[#0b1220]/80 px-1.5 py-0.5 text-[10px] text-gray-300">
                  {sig}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>

      <p className="m-0 mt-3 text-xs text-gray-400">{radar.cautionLine}</p>
      <p className="m-0 mt-1 text-xs font-semibold text-gray-200">{radar.strategyLine}</p>
    </section>
  )
}
