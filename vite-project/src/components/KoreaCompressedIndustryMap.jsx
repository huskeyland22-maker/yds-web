import { KOREA_COMPRESSED_MAP_NODES } from "../data/koreaGrowthSectorMap.js"

const NODE_CLASS =
  "group flex h-[80px] w-[min(100%,200px)] min-w-[140px] max-w-[200px] shrink-0 flex-col items-center justify-center rounded-[18px] border border-white/[0.06] bg-[rgba(12,14,18,0.95)] px-3 text-center transition duration-200 hover:-translate-y-0.5 hover:border-white/15 sm:h-[86px] sm:w-[185px]"

/**
 * @param {{
 *   heatById?: Record<string, string>
 *   onNodeClick?: (sectorId: string) => void
 * }} props
 */
export default function KoreaCompressedIndustryMap({ heatById = {}, onNodeClick }) {
  const top = KOREA_COMPRESSED_MAP_NODES.filter((n) => n.row === "top").sort((a, b) => a.col - b.col)
  const bottom = KOREA_COMPRESSED_MAP_NODES.filter((n) => n.row === "bottom").sort((a, b) => a.col - b.col)

  return (
    <section
      id="korea-compressed-map"
      className="relative scroll-mt-24 overflow-hidden rounded-2xl border border-white/[0.07] bg-[rgba(12,14,18,0.88)] px-3 py-6 md:px-5 md:py-8"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
        aria-hidden
      />

      <p className="relative z-[1] m-0 text-center font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500">
        Korea industry map
      </p>

      <div className="relative z-[1] mx-auto mt-6 flex w-[88%] max-w-5xl flex-col items-center md:w-[90%]">
        <MapRow nodes={top} heatById={heatById} onNodeClick={onNodeClick} />
        <div className="my-3 flex h-6 items-center justify-center md:my-4" aria-hidden>
          <span className="text-lg text-slate-600">│</span>
        </div>
        <MapRow nodes={bottom} heatById={heatById} onNodeClick={onNodeClick} />
      </div>
    </section>
  )
}

/**
 * @param {{
 *   nodes: import("../data/koreaGrowthSectorMap.js").CompressedMapNode[]
 *   heatById: Record<string, string>
 *   onNodeClick?: (sectorId: string) => void
 * }} props
 */
function MapRow({ nodes, heatById, onNodeClick }) {
  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-3 sm:gap-4 md:gap-5">
      {nodes.map((node, index) => {
        const heat = heatById[node.sectorId]
        return (
          <span key={node.id} className="flex items-center">
            <button
              type="button"
              onClick={() => onNodeClick?.(node.sectorId)}
              className={NODE_CLASS}
            >
              <span className="block text-[12px] font-semibold text-slate-200 group-hover:text-slate-50 sm:text-[13px]">
                {node.label}
              </span>
              {heat ? (
                <span className="mt-1.5 block font-mono text-[8px] uppercase tracking-wide text-slate-500">
                  {heat}
                </span>
              ) : null}
            </button>
            {index < nodes.length - 1 ? (
              <span className="mx-0.5 hidden text-slate-600 sm:inline md:mx-1.5" aria-hidden>
                ─
              </span>
            ) : null}
          </span>
        )
      })}
    </div>
  )
}
