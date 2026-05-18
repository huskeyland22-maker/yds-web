import { useCallback, useEffect, useState } from "react"
import { SECTOR_ANCHOR_BY_ID } from "../data/koreaGrowthSectorMap.js"
import {
  clearValueChainHash,
  ensurePageScrollUnlocked,
  scrollToValueChainSection,
} from "../utils/valueChainSectorNav.js"
import KoreaBackToIndustryMap from "./KoreaBackToIndustryMap.jsx"
import KoreaCompressedIndustryMap from "./KoreaCompressedIndustryMap.jsx"
import KoreaSectorDetailCards from "./KoreaSectorDetailCards.jsx"
import KoreaValueChainHero from "./KoreaValueChainHero.jsx"

const TOGGLE_BTN_CLASS =
  "rounded-lg border border-white/10 bg-white/[0.04] px-5 py-2.5 text-[12px] font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.07]"

const EXPAND_SCROLL_DELAY_MS = 80

/**
 * @param {{
 *   heatById?: Record<string, string>
 *   onStockSelect: (payload: { stock: object; sectorName: string }) => void
 *   children?: import("react").ReactNode
 * }} props
 */
export default function KoreaValueChainDesk({ heatById = {}, onStockSelect, children }) {
  const [expanded, setExpanded] = useState(false)
  const [pendingSectorElementId, setPendingSectorElementId] = useState(null)

  const scrollToIndustryMap = useCallback(() => {
    scrollToValueChainSection("industry-map")
  }, [])

  const handleSectorSelect = useCallback((sectorId) => {
    ensurePageScrollUnlocked()
    const elementId = SECTOR_ANCHOR_BY_ID[sectorId] ?? sectorId
    setExpanded(true)
    setPendingSectorElementId(elementId)
  }, [])

  useEffect(() => {
    if (!expanded || !pendingSectorElementId || typeof window === "undefined") return
    const elementId = pendingSectorElementId
    const t = window.setTimeout(() => {
      scrollToValueChainSection(elementId)
      ensurePageScrollUnlocked()
      setPendingSectorElementId(null)
    }, EXPAND_SCROLL_DELAY_MS)
    return () => window.clearTimeout(t)
  }, [expanded, pendingSectorElementId])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.location.hash) clearValueChainHash()
  }, [])

  const handleExpand = useCallback(() => {
    setPendingSectorElementId(null)
    setExpanded((v) => {
      if (v) clearValueChainHash()
      return !v
    })
  }, [])

  return (
    <div className="space-y-3">
      <KoreaValueChainHero />

      <KoreaCompressedIndustryMap heatById={heatById} onNodeClick={handleSectorSelect} />

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
            <KoreaSectorDetailCards
              heatById={heatById}
              onStockSelect={onStockSelect}
              onBackToMap={scrollToIndustryMap}
            />
            {children}
          </div>

          <KoreaBackToIndustryMap active={expanded} onBackToMap={scrollToIndustryMap} />
        </div>
      ) : null}
    </div>
  )
}
