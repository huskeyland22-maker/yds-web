import { useCallback, useState } from "react"
import KoreaCompressedIndustryMap from "./KoreaCompressedIndustryMap.jsx"
import KoreaSectorDetailCards from "./KoreaSectorDetailCards.jsx"
import KoreaValueChainHero from "./KoreaValueChainHero.jsx"

/**
 * @param {{
 *   heatById?: Record<string, string>
 *   onStockSelect: (payload: { stock: object; sectorName: string }) => void
 *   children?: import("react").ReactNode
 * }} props
 */
export default function KoreaValueChainDesk({ heatById = {}, onStockSelect, children }) {
  const [expanded, setExpanded] = useState(false)

  const scrollToSector = useCallback(
    (sectorId) => {
      if (!expanded) {
        setExpanded(true)
        window.setTimeout(() => {
          document.getElementById(`korea-sector-${sectorId}`)?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          })
        }, 320)
        return
      }
      document.getElementById(`korea-sector-${sectorId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    },
    [expanded],
  )

  return (
    <div className="space-y-4">
      <KoreaValueChainHero />

      <KoreaCompressedIndustryMap heatById={heatById} onNodeClick={scrollToSector} />

      <div className="flex justify-center pt-1">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls="korea-value-chain-expand"
          className="rounded-lg border border-white/10 bg-white/[0.04] px-5 py-2.5 text-[12px] font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.07]"
        >
          {expanded ? "상세 밸류체인 접기" : "상세 밸류체인 보기"}
        </button>
      </div>

      <div
        id="korea-value-chain-expand"
        className={[
          "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
          expanded ? "max-h-[20000px] opacity-100" : "max-h-0 opacity-0",
        ].join(" ")}
      >
        <div className="space-y-8 pt-2">
          <KoreaSectorDetailCards heatById={heatById} onStockSelect={onStockSelect} />
          {children}
        </div>
      </div>
    </div>
  )
}
