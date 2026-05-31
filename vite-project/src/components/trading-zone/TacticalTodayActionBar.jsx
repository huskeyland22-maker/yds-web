import { buildTodayActionCompact } from "../../trading-zone/marketPolicyEngine.js"
import { compactToTodayActionChips } from "../../trading-zone/tradingZoneTodayActionChips.js"
import TacticalTodayActionChips from "./TacticalTodayActionChips.jsx"

/**
 * @param {{
 *   marketPolicy?: {
 *     stockActionRange?: { newEntry?: string; chase?: string; splitBuy?: string; cash?: string }
 *     sectorBias?: { label?: string; sectors?: string[] }
 *   } | null
 * }} props
 */
export default function TacticalTodayActionBar({ marketPolicy = null }) {
  const compact = buildTodayActionCompact(marketPolicy?.stockActionRange, marketPolicy?.sectorBias)
  const chips = compactToTodayActionChips(compact)

  return (
    <section className="tactical-zone-today-action tactical-zone-today-action--compact" aria-label="오늘 행동">
      <p className="m-0 tactical-zone-today-action__head">오늘 행동</p>
      <TacticalTodayActionChips chips={chips} />
    </section>
  )
}
