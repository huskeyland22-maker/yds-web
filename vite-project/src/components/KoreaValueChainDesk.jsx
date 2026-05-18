import { useCallback, useEffect, useMemo, useState } from "react"
import { getKoreaSectorById } from "../data/koreaGrowthSectorMap.js"
import { clearValueChainHash } from "../utils/valueChainSectorNav.js"
import KoreaIndustryRadar from "./korea-dashboard/KoreaIndustryRadar.jsx"
import KoreaSectorInsightPanel from "./korea-dashboard/KoreaSectorInsightPanel.jsx"
import KoreaValueMapHub from "./korea-dashboard/KoreaValueMapHub.jsx"
import KoreaValueChainHero from "./KoreaValueChainHero.jsx"

const MOBILE_TABS = [
  { id: "radar", label: "산업 선택" },
  { id: "map", label: "맵" },
  { id: "insight", label: "정보" },
]

/**
 * @param {{
 *   heatById?: Record<string, string>
 *   onStockSelect: (payload: { stock: object; sectorName: string }) => void
 *   children?: import("react").ReactNode
 * }} props
 */
export default function KoreaValueChainDesk({ heatById = {}, onStockSelect, children }) {
  const [selectedId, setSelectedId] = useState("ai-semiconductor")
  const [mobileTab, setMobileTab] = useState("map")

  const sector = useMemo(
    () => (selectedId ? getKoreaSectorById(selectedId) : null),
    [selectedId],
  )

  const sectorHeat = selectedId ? heatById[selectedId] || sector?.heat : undefined

  const handleSectorSelect = useCallback((sectorId) => {
    setSelectedId(sectorId)
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setMobileTab("map")
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.location.hash) clearValueChainHash()
  }, [])

  return (
    <div className="value-chain-dashboard korea-dashboard space-y-4">
      <KoreaValueChainHero />

      <div className="lg:hidden">
        <div className="korea-mobile-tabs" role="tablist" aria-label="코리아 밸류체인 모바일">
          {MOBILE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={mobileTab === tab.id}
              onClick={() => setMobileTab(tab.id)}
              className={["korea-mobile-tab", mobileTab === tab.id ? "is-active" : ""].filter(Boolean).join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="korea-dash-grid value-map">
        <div className={["korea-dash-col-radar", mobileTab !== "radar" ? "max-lg:hidden" : ""].join(" ")}>
          <KoreaIndustryRadar
            heatById={heatById}
            selectedId={selectedId}
            onSelect={handleSectorSelect}
          />
        </div>

        <div className={["korea-dash-col-map", mobileTab !== "map" ? "max-lg:hidden" : ""].join(" ")}>
          <KoreaValueMapHub sector={sector} onStockSelect={onStockSelect} />
        </div>

        <div
          className={["korea-dash-col-insight right-panel", mobileTab !== "insight" ? "max-lg:hidden" : ""]
            .filter(Boolean)
            .join(" ")}
        >
          <KoreaSectorInsightPanel sector={sector} heat={sectorHeat} onStockSelect={onStockSelect} />
        </div>
      </div>

      {children ? <div className="korea-dash-secondary space-y-8 border-t border-white/[0.06] pt-8">{children}</div> : null}
    </div>
  )
}
