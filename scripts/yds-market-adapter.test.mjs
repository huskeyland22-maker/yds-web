/**
 * Phase 2-7 market adapter — node scripts/yds-market-adapter.test.mjs
 */
import {
  resolveMarketAdapterContext,
  computeMarketFitScore,
  buildMarketFitReason,
  buildMarketFitReasons,
  DEFAULT_MARKET_CONTEXT,
} from "../vite-project/src/content/ydsMarketAdapter.js"
import { computeStockScores } from "../vite-project/src/content/ydsStockScoreEngine.js"
import { buildStockPriceSnapshot } from "../vite-project/src/content/stockPickSnapshotProfiles.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const nvdaSnap = buildStockPriceSnapshot("NVDA", "trend")
const base = computeStockScores(nvdaSnap, { marketFitScore: 0 })

// --- ok neutral (Official ~37) ---
const neutralPanic = { fearGreed: 45, bofa: 4, vix: 20, putCall: 0.95 }
const ctx = resolveMarketAdapterContext(neutralPanic, [])
assert(ctx.ready && ctx.scoreStatus === "ok", "context ready/ok")
assert(ctx.macroId === "neutral", `expected neutral got ${ctx.macroId}`)
assert(ctx.isDefensive, "defensive mode")
assert(ctx.cycleLabel.length > 0, "cycle label")

const trendFit = computeMarketFitScore(ctx, "trend", base.scores)
const dipFit = computeMarketFitScore(ctx, "dip", base.scores)
assert(trendFit > dipFit, `trend ${trendFit} > dip ${dipFit}`)
assert(trendFit >= 16 && trendFit <= 20, `trend fit range got ${trendFit}`)

const reason = buildMarketFitReason(ctx, "trend", trendFit)
assert(reason != null && reason.includes("추세"), `reason ${reason}`)
const reasons = buildMarketFitReasons(ctx, "trend", trendFit)
assert(reasons.length >= 1, "ok context yields market-fit reasons")
assert(reasons.some((r) => String(r.text).includes("적합")), "reason text")

// --- ok dca ---
const dcaPanic = { fearGreed: 20, bofa: 2, vix: 30, putCall: 1.15 }
const dcaCtx = resolveMarketAdapterContext(dcaPanic, [])
assert(dcaCtx.ready && dcaCtx.macroId === "dca", `dca macro got ${dcaCtx.macroId}`)
const dcaFit = computeMarketFitScore(dcaCtx, "dip", base.scores)
assert(dcaFit >= trendFit - 2, "dca dip competitive")
assert(dcaFit > 0, "dca fit not zeroed")

// --- ok panicBuy ---
const panicBuyPanic = { fearGreed: 12, bofa: 0, vix: 40, putCall: 1.4 }
const panicBuyCtx = resolveMarketAdapterContext(panicBuyPanic, [])
assert(
  panicBuyCtx.ready && panicBuyCtx.macroId === "panicBuy",
  `panicBuy got ${panicBuyCtx.macroId}`,
)
const panicBuyFit = computeMarketFitScore(panicBuyCtx, "trend", base.scores)
assert(panicBuyFit >= 18, `panicBuy trend fit ${panicBuyFit}`)
assert(buildMarketFitReasons(panicBuyCtx, "trend", panicBuyFit).length >= 1, "panicBuy reasons")

// --- ok overheated still computes (not insufficient) ---
const overheatedPanic = { fearGreed: 62, bofa: 7, vix: 14, putCall: 0.75 }
const overCtx = resolveMarketAdapterContext(overheatedPanic, [])
assert(overCtx.ready && overCtx.macroId === "overheated", `overheated got ${overCtx.macroId}`)
const overFit = computeMarketFitScore(overCtx, "trend", base.scores)
assert(overFit > 0, `overheated fit ${overFit}`)

// --- data insufficient / unknown ---
assert(DEFAULT_MARKET_CONTEXT.ready === false, "default not ready")
assert(DEFAULT_MARKET_CONTEXT.macroId === "unknown", "default unknown macro")
assert(computeMarketFitScore(DEFAULT_MARKET_CONTEXT, "trend", base.scores) === 0, "DEFAULT fit 0")
assert(buildMarketFitReasons(DEFAULT_MARKET_CONTEXT, "trend", 19).length === 0, "DEFAULT no reasons")
assert(buildMarketFitReason(DEFAULT_MARKET_CONTEXT, "trend", 19) === null, "DEFAULT no reason")

const unknownOnly = { ...ctx, macroId: "unknown" }
assert(computeMarketFitScore(unknownOnly, "trend", base.scores) === 0, "unknown macro → 0")
assert(buildMarketFitReasons(unknownOnly, "trend", 19).length === 0, "unknown → no reasons")

const notReady = { ...ctx, ready: false }
assert(computeMarketFitScore(notReady, "trend", base.scores) === 0, "ready:false → 0")

const insufficientStatus = { ...ctx, scoreStatus: "dataInsufficient" }
assert(computeMarketFitScore(insufficientStatus, "trend", base.scores) === 0, "scoreStatus → 0")
assert(buildMarketFitReasons(insufficientStatus, "trend", 19).length === 0, "scoreStatus → no reasons")

console.log("OK market adapter", {
  strategy: ctx.strategyLabel,
  cycle: ctx.cycleLabel,
  trendFit,
  dipFit,
  dcaFit,
  panicBuyFit,
  overFit,
  reason,
})
