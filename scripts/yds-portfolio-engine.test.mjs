/**
 * Phase 3-1 portfolio engine — node scripts/yds-portfolio-engine.test.mjs
 *
 * Expectations follow current adapter + BASE_ALLOCATION / CYCLE_ADJUST
 * (not a stale "defensive = 35–50" band).
 */
import {
  computeRecommendedAllocation,
  derivePortfolioRebalance,
} from "../vite-project/src/content/ydsPortfolioEngine.js"
import { resolveMarketAdapterContext } from "../vite-project/src/content/ydsMarketAdapter.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

// FG 58 / VIX 15 → macro overheated (공포 부족), cycle warning → stock 30 − 5 = 25
const calm = resolveMarketAdapterContext(
  { fearGreed: 58, bofa: 6.5, vix: 15, putCall: 0.8 },
  [],
)
assert(calm.macroId === "overheated", `expected overheated, got ${calm.macroId}`)
assert(calm.cycleStageId === "warning", `expected warning cycle, got ${calm.cycleStageId}`)
assert(calm.isDefensive === true, "calm tape is defensive posture")
const alloc = computeRecommendedAllocation(calm)
assert(alloc.stockPct === 25, `overheated+warning stock ${alloc.stockPct}`)
assert(alloc.cashPct === 75, `overheated+warning cash ${alloc.cashPct}`)
assert(alloc.stockPct + alloc.cashPct === 100, "sum 100")

const dca = resolveMarketAdapterContext(
  { fearGreed: 18, bofa: 1, vix: 32, putCall: 1.15, highYield: 6.5 },
  [],
)
const dcaAlloc = computeRecommendedAllocation(dca)
assert(dcaAlloc.stockPct >= 80, `dca stock ${dcaAlloc.stockPct} macro ${dca.macroId}`)

const rebalance = derivePortfolioRebalance(alloc, { stockPct: 80, cashPct: 20 })
assert(rebalance.tone === "warning", "overweight warning")
assert(rebalance.actions.includes("현금 확보"), "cash action")

const neutralReb = derivePortfolioRebalance(alloc, { stockPct: alloc.stockPct, cashPct: alloc.cashPct })
assert(neutralReb.tone === "neutral", "balanced")

console.log("OK portfolio engine", {
  calm: { macroId: calm.macroId, cycleStageId: calm.cycleStageId, alloc },
  dca: dcaAlloc,
  rebalance: rebalance.conclusion,
})
