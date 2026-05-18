import { useCallback, useEffect, useState } from "react"
import { SECTOR_ANCHOR_BY_ID } from "../data/koreaGrowthSectorMap.js"
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
  const [pendingAnchor, setPendingAnchor] = useState(null)

  const handleExpand = useCallback(() => {
    setPendingAnchor(null)
    setExpanded((v) => !v)
  }, [])

  const handleMapNodeClick = useCallback((sectorId) => {
    const anchor = SECTOR_ANCHOR_BY_ID[sectorId] ?? sectorId
    setExpanded(true)
    setPendingAnchor(anchor)
  }, [])

  useEffect(() => {
    if (!expanded || !pendingAnchor || typeof window === "undefined") return
    const id = pendingAnchor
    const t = window.setTimeout(() => {
      if (window.location.hash !== `#${id}`) {
        window.location.hash = id
      }
      setPendingAnchor(null)
    }, 80)
    return () => window.clearTimeout(t)
  }, [expanded, pendingAnchor])

  return (
    <div className="space-y-3">
      <KoreaValueChainHero />

      <KoreaCompressedIndustryMap heatById={heatById} onNodeClick={handleMapNodeClick} />

      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleExpand}
          aria-expanded={expanded}
          aria-controls="korea-value-chain-expand"
          className="rounded-lg border border-white/10 bg-white/[0.04] px-5 py-2.5 text-[12px] font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.07]"
        >
          {expanded ? "상세 밸류체인 접기" : "상세 밸류체인 보기"}
        </button>
      </div>

      {expanded ? (
        <div id="korea-value-chain-expand" className="overflow-hidden pt-6">
          <div className="space-y-8">
            <KoreaSectorDetailCards heatById={heatById} onStockSelect={onStockSelect} />
            {children}
          </div>
        </div>
      ) : null}
    </div>
  )
}
