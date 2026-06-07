/**
 * Market cycle labels — node scripts/yds-market-cycle-display.test.mjs
 */
import {
  MARKET_CYCLE_STAGES,
  MARKET_CYCLE_RAIL_LABELS,
  resolveMarketCycleStage,
  marketCycleTooltip,
} from "../vite-project/src/content/ydsMarketCycleDisplay.js"
import { YDS_CYCLE_RAIL_LABELS } from "../vite-project/src/content/ydsLanguage.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const cashPrep = resolveMarketCycleStage(62, 6.2)
assert(cashPrep?.label === "현금 준비", cashPrep?.label)
assert(cashPrep?.short === "현금 준비", cashPrep?.short)

const peak = resolveMarketCycleStage(82, 8.2)
assert(peak?.label === "최고 과열", peak?.label)
assert(peak?.id === "partialCash", peak?.id)

const mid = resolveMarketCycleStage(72, 7.2)
assert(mid?.label === "현금 준비", `70-79 should be cash prep: ${mid?.label}`)

assert(!MARKET_CYCLE_STAGES.some((s) => s.short === "일부"), "no 일부 short label")
assert(YDS_CYCLE_RAIL_LABELS.includes("현금 준비"), YDS_CYCLE_RAIL_LABELS)
assert(MARKET_CYCLE_RAIL_LABELS.includes("현금 준비"), MARKET_CYCLE_RAIL_LABELS)
assert(marketCycleTooltip("cashPrep").includes("CNN 60+"), marketCycleTooltip("cashPrep"))

console.log("OK market cycle labels", {
  cashPrep: cashPrep.label,
  peak: peak.label,
  rail: MARKET_CYCLE_RAIL_LABELS,
})
