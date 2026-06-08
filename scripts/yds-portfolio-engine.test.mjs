/**
 * Phase 3-1 portfolio engine — node scripts/yds-portfolio-engine.test.mjs
 */
import {
  computeRecommendedAllocation,
  derivePortfolioRebalance,
} from "../vite-project/src/content/ydsPortfolioEngine.js"
import { resolveMarketAdapterContext } from "../vite-project/src/content/ydsMarketAdapter.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const defensive = resolveMarketAdapterContext(
  { fearGreed: 58, bofa: 6.5, vix: 15, putCall: 0.8 },
  [],
)
const alloc = computeRecommendedAllocation(defensive)
assert(alloc.stockPct >= 35 && alloc.stockPct <= 50, `defensive stock ${alloc.stockPct}`)
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
  defensive: alloc,
  dca: dcaAlloc,
  rebalance: rebalance.conclusion,
})
