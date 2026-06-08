/**
 * Phase 2-7 market adapter — node scripts/yds-market-adapter.test.mjs
 */
import {
  resolveMarketAdapterContext,
  computeMarketFitScore,
  buildMarketFitReason,
  DEFAULT_MARKET_CONTEXT,
} from "../vite-project/src/content/ydsMarketAdapter.js"
import { computeStockScores } from "../vite-project/src/content/ydsStockScoreEngine.js"
import { buildStockPriceSnapshot } from "../vite-project/src/content/stockPickSnapshotProfiles.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const defensivePanic = {
  fearGreed: 62,
  bofa: 7,
  vix: 14,
  putCall: 0.75,
}

const ctx = resolveMarketAdapterContext(defensivePanic, [])
assert(ctx.ready, "context ready")
assert(ctx.isDefensive, "defensive mode")
assert(ctx.cycleLabel.length > 0, "cycle label")

const nvdaSnap = buildStockPriceSnapshot("NVDA", "trend")
const base = computeStockScores(nvdaSnap, { marketFitScore: 0 })
const trendFit = computeMarketFitScore(ctx, "trend", base.scores)
const dipFit = computeMarketFitScore(ctx, "dip", base.scores)
assert(trendFit > dipFit, `trend ${trendFit} > dip ${dipFit}`)
assert(trendFit >= 16 && trendFit <= 20, "trend fit range")

const reason = buildMarketFitReason(ctx, "trend", trendFit)
assert(reason != null && reason.includes("추세"), `reason ${reason}`)

const dcaPanic = { fearGreed: 28, bofa: 2, vix: 28, putCall: 1.1 }
const dcaCtx = resolveMarketAdapterContext(dcaPanic, [])
const dcaFit = computeMarketFitScore(dcaCtx, "dip", base.scores)
assert(dcaFit >= trendFit - 2, "dca dip competitive")

assert(DEFAULT_MARKET_CONTEXT.ready === false, "default not ready")

console.log("OK market adapter", {
  strategy: ctx.strategyLabel,
  cycle: ctx.cycleLabel,
  trendFit,
  dipFit,
  reason,
})
