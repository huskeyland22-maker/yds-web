import { useMemo } from "react"
import { isMacroRiskEnabled } from "../../macro-risk/featureFlag.js"
import { useMacroRiskSnapshot } from "../../macro-risk/useMacroRiskSnapshot.js"
import { getFinalScore } from "../../utils/tradingScores.js"
import MarketOsCommandCard from "./MarketOsCommandCard.jsx"

/**
 * Cycle·Macro 스냅샷 로드 + Phase2 카드 (사이클/매크로 페이지 공통)
 * @param {{ panicData?: object | null; sticky?: boolean }} props
 */
export default function MarketOsPhase2Shell({ panicData = null, sticky = true }) {
  const enabled = isMacroRiskEnabled()
  const { snapshot, loading } = useMacroRiskSnapshot(panicData)
  const cycleScore = useMemo(() => (panicData ? getFinalScore(panicData) : null), [panicData])

  if (!enabled) return null

  const wrapCls = sticky
    ? "sticky top-0 z-[35] -mx-0.5 mb-3 py-0.5 backdrop-blur-md"
    : "mb-3"

  return (
    <div className={wrapCls}>
      <MarketOsCommandCard
        cycleScore={cycleScore}
        snapshot={snapshot}
        panicData={panicData}
        loading={loading}
      />
    </div>
  )
}
