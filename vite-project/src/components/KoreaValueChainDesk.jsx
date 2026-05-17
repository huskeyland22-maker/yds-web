import { useCallback, useRef, useState } from "react"
import { scrollToElementWithOffset } from "../utils/scrollWithOffset.js"
import KoreaCompressedIndustryMap from "./KoreaCompressedIndustryMap.jsx"
import KoreaSectorDetailCards from "./KoreaSectorDetailCards.jsx"
import KoreaValueChainHero from "./KoreaValueChainHero.jsx"

const EXPAND_SCROLL_DELAY_MS = 420

/**
 * @param {{
 *   heatById?: Record<string, string>
 *   onStockSelect: (payload: { stock: object; sectorName: string }) => void
 *   children?: import("react").ReactNode
 * }} props
 */
export default function KoreaValueChainDesk({ heatById = {}, onStockSelect, children }) {
  const [expanded, setExpanded] = useState(false)
  const expandScrollTimer = useRef(null)

  const scrollToDetailTarget = useCallback((elementId) => {
    const el =
      document.getElementById(elementId) ??
      document.getElementById("korea-sector-details") ??
      document.getElementById("korea-value-chain-expand")
    scrollToElementWithOffset(el, "smooth")
  }, [])

  const scheduleScrollAfterExpand = useCallback(
    (elementId = "korea-sector-details") => {
      if (expandScrollTimer.current) window.clearTimeout(expandScrollTimer.current)
      expandScrollTimer.current = window.setTimeout(() => {
        scrollToDetailTarget(elementId)
        expandScrollTimer.current = null
      }, EXPAND_SCROLL_DELAY_MS)
    },
    [scrollToDetailTarget],
  )

  const scrollToSector = useCallback(
    (sectorId) => {
      const targetId = `korea-sector-${sectorId}`
      if (!expanded) {
        setExpanded(true)
        scheduleScrollAfterExpand(targetId)
        return
      }
      scrollToDetailTarget(targetId)
    },
    [expanded, scheduleScrollAfterExpand, scrollToDetailTarget],
  )

  const handleToggleExpand = useCallback(() => {
    setExpanded((wasExpanded) => {
      if (!wasExpanded) scheduleScrollAfterExpand("korea-sector-details")
      return !wasExpanded
    })
  }, [scheduleScrollAfterExpand])

  return (
    <div className="space-y-3">
      <KoreaValueChainHero />

      <KoreaCompressedIndustryMap heatById={heatById} onNodeClick={scrollToSector} />

      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleToggleExpand}
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
        className={[
          "korea-value-chain-detail-section",
          expanded
            ? "max-h-[5000px] scroll-mt-[140px] overflow-hidden opacity-100 pt-6"
            : "m-0 h-0 max-h-0 overflow-hidden p-0 opacity-0",
        ].join(" ")}
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
