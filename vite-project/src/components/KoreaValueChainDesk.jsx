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

  const handleExpand = useCallback(() => {
    setExpanded((v) => !v)
  }, [])

  const handleMapNodeClick = useCallback(() => {
    setExpanded(true)
  }, [])

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

      <div
        id="korea-value-chain-expand"
        aria-hidden={!expanded}
        className={
          expanded
            ? "max-h-[5000px] overflow-hidden opacity-100 pt-6"
            : "m-0 h-0 max-h-0 overflow-hidden p-0 opacity-0"
        }
        style={{ transition: "max-height 0.4s ease, opacity 0.3s ease" }}
      >
        {expanded ? (
          <div className="space-y-8">
            <KoreaSectorDetailCards heatById={heatById} onStockSelect={onStockSelect} />
            {children}
          </div>
        ) : null}
      </div>
    </div>
  )
}
