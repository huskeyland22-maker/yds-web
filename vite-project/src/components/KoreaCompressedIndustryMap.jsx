import { KOREA_COMPRESSED_MAP_NODES } from "../data/koreaGrowthSectorMap.js"

const NODE_CLASS =
  "rounded-[18px] border border-white/[0.06] bg-[rgba(12,14,18,0.95)] px-3 py-2.5 text-center transition duration-200 hover:-translate-y-0.5 hover:border-white/15"

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
      className="relative scroll-mt-24 overflow-hidden rounded-2xl border border-white/[0.07] bg-[rgba(12,14,18,0.88)] px-3 py-5 md:px-5 md:py-6"
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

      <div className="relative z-[1] mx-auto mt-5 max-w-3xl">
        <MapRow nodes={top} heatById={heatById} onNodeClick={onNodeClick} />
        <div className="my-2 flex justify-center" aria-hidden>
          <span className="text-slate-600">│</span>
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
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5">
      {nodes.map((node) => {
        const heat = heatById[node.sectorId]
        return (
          <button
            key={node.id}
            type="button"
            onClick={() => onNodeClick?.(node.sectorId)}
            className={[NODE_CLASS, "group w-full"].join(" ")}
          >
            <span className="block text-[11px] font-semibold text-slate-200 group-hover:text-slate-50 sm:text-[12px]">
              {node.label}
            </span>
            {heat ? (
              <span className="mt-1 block font-mono text-[8px] uppercase tracking-wide text-slate-500">
                {heat}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
