/**
 * Phase 3-1 portfolio engine — node scripts/yds-portfolio-engine.test.mjs
 *
 * Verifies recommended stock/cash bands by macro policy:
 * - neutral → defensive stock ~45% (capped ≤50 when isDefensive)
 * - dca → elevated stock ≥80%
 * Rebalance tone/actions stay consistent with those recommendations.
 */
import {
  computeRecommendedAllocation,
  derivePortfolioRebalance,
} from "../vite-project/src/content/ydsPortfolioEngine.js"
import { resolveMarketAdapterContext } from "../vite-project/src/content/ydsMarketAdapter.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

// CNN/지표가 과열에 가까우면 YDS 점수 ≤20 → overheated(주식 25%).
// neutral(YDS 21~40) 방어 비중을 검증하려면 해당 점수대가 나오는 입력을 사용한다.
const defensive = resolveMarketAdapterContext(
  { fearGreed: 45, bofa: 5.5, vix: 18, putCall: 0.85 },
  [],
)
assert(defensive.macroId === "neutral", `expected neutral macro, got ${defensive.macroId}`)
assert(defensive.isDefensive === true, "neutral band should be defensive")
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
  defensive: { macroId: defensive.macroId, ydsScore: defensive.ydsScore, ...alloc },
  dca: dcaAlloc,
  rebalance: rebalance.conclusion,
})
