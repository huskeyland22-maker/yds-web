import { KOREA_RADIAL_MAP_NODES } from "../data/koreaGrowthSectorMap.js"

const NODE_BTN =
  "group flex min-h-[52px] min-w-[88px] max-w-[120px] flex-col items-center justify-center rounded-full border border-white/[0.08] bg-[rgba(12,14,18,0.95)] px-2.5 py-2 text-center transition duration-200 hover:border-white/18 hover:bg-[rgba(18,22,30,0.98)] sm:min-h-[56px] sm:min-w-[96px] sm:max-w-[130px]"

/**
 * @param {{
 *   heatById?: Record<string, string>
 *   onNodeClick?: (sectorId: string) => void
 * }} props
 */
export default function KoreaRadialIndustryMap({ heatById = {}, onNodeClick }) {
  const radiusSm = 118
  const radiusMd = 148

  return (
    <section
      id="industry-map"
      className="valuechain-section relative overflow-visible rounded-2xl border border-white/[0.07] bg-[rgba(12,14,18,0.88)] px-3 py-8 md:px-6 md:py-10"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
        aria-hidden
      />

      <div className="relative z-[1] mx-auto w-full max-w-[min(92vw,560px)]">
        <div className="relative mx-auto aspect-square w-full max-w-[min(88vw,480px)]">
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 hidden h-[min(58vw,280px)] w-[min(58vw,280px)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/[0.06] md:block"
            aria-hidden
          />

          <div className="absolute left-1/2 top-1/2 z-[2] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-2xl border border-white/[0.1] bg-[rgba(8,10,14,0.92)] px-4 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] md:px-5 md:py-4">
            <p className="m-0 font-mono text-[8px] uppercase tracking-[0.22em] text-slate-500 md:text-[9px]">
              Korea
            </p>
            <p className="m-0 mt-1 text-[11px] font-semibold tracking-[0.12em] text-slate-100 md:text-xs">
              VALUE MAP
            </p>
          </div>

          {KOREA_RADIAL_MAP_NODES.map((node) => (
            <RadialNode
              key={node.id}
              node={node}
              heat={heatById[node.sectorId]}
              onNodeClick={onNodeClick}
              radiusSm={radiusSm}
              radiusMd={radiusMd}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

/**
 * @param {{
 *   node: import("../data/koreaGrowthSectorMap.js").RadialMapNode
 *   heat?: string
 *   onNodeClick?: (sectorId: string) => void
 *   radiusSm: number
 *   radiusMd: number
 * }} props
 */
function RadialNode({ node, heat, onNodeClick, radiusSm, radiusMd }) {
  const angleRad = ((node.angleDeg - 90) * Math.PI) / 180

  const styleSm = {
    left: "50%",
    top: "50%",
    transform: `translate(-50%, -50%) translate(${Math.cos(angleRad) * radiusSm}px, ${Math.sin(angleRad) * radiusSm}px)`,
  }

  const styleMd = {
    transform: `translate(-50%, -50%) translate(${Math.cos(angleRad) * radiusMd}px, ${Math.sin(angleRad) * radiusMd}px)`,
  }

  return (
    <>
      <button
        type="button"
        onClick={() => onNodeClick?.(node.sectorId)}
        className={[NODE_BTN, "absolute z-[3] md:hidden"].join(" ")}
        style={styleSm}
      >
        <NodeLabel label={node.label} heat={heat} />
      </button>
      <button
        type="button"
        onClick={() => onNodeClick?.(node.sectorId)}
        className={[NODE_BTN, "absolute z-[3] hidden md:flex"].join(" ")}
        style={{ left: "50%", top: "50%", ...styleMd }}
      >
        <NodeLabel label={node.label} heat={heat} />
      </button>
    </>
  )
}

/** @param {{ label: string; heat?: string }} props */
function NodeLabel({ label, heat }) {
  const parts = label.split(" / ")
  return (
    <>
      <span className="block text-[10px] font-semibold leading-tight text-slate-200 group-hover:text-slate-50 sm:text-[11px]">
        {parts[0]}
      </span>
      {parts[1] ? (
        <span className="mt-0.5 block text-[9px] leading-tight text-slate-500 group-hover:text-slate-400">
          {parts[1]}
        </span>
      ) : null}
      {heat ? (
        <span className="mt-1 block font-mono text-[7px] uppercase tracking-wide text-slate-600">{heat}</span>
      ) : null}
    </>
  )
}
