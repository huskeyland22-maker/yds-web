import { useCallback, useEffect, useState } from "react"
import { SECTOR_ANCHOR_BY_ID } from "../data/koreaGrowthSectorMap.js"
import KoreaBackToIndustryMap from "./KoreaBackToIndustryMap.jsx"
import KoreaCompressedIndustryMap from "./KoreaCompressedIndustryMap.jsx"
import KoreaSectorDetailCards from "./KoreaSectorDetailCards.jsx"
import KoreaValueChainHero from "./KoreaValueChainHero.jsx"

const TOGGLE_BTN_CLASS =
  "rounded-lg border border-white/10 bg-white/[0.04] px-5 py-2.5 text-[12px] font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.07]"

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

      {!expanded ? (
        <div className="valuechain-detail-toggle">
          <button
            type="button"
            onClick={handleExpand}
            aria-expanded={false}
            aria-controls="korea-value-chain-expand"
            className={TOGGLE_BTN_CLASS}
          >
            상세 밸류체인 보기
          </button>
        </div>
      ) : null}

      {expanded ? (
        <div id="korea-value-chain-expand" className="valuechain-detail-wrapper">
          <div className="valuechain-detail-toggle">
            <button
              type="button"
              onClick={handleExpand}
              aria-expanded={true}
              aria-controls="korea-value-chain-expand"
              className={TOGGLE_BTN_CLASS}
            >
              상세 밸류체인 접기
            </button>
          </div>

          <div className="space-y-8">
            <KoreaSectorDetailCards heatById={heatById} onStockSelect={onStockSelect} />
            {children}
          </div>

          <KoreaBackToIndustryMap active={expanded} />
        </div>
      ) : null}
    </div>
  )
}
