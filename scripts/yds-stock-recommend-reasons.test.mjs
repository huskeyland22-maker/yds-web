/**
 * Phase 2-4 recommend reasons — node scripts/yds-stock-recommend-reasons.test.mjs
 */
import { buildRecommendReasons } from "../vite-project/src/content/ydsStockRecommendReasons.js"
import { computeStockScores } from "../vite-project/src/content/ydsStockScoreEngine.js"
import { getStockSnapshot, toEngineSnapshot } from "../vite-project/src/content/stockPickSnapshotProvider.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const nvdaSnap = getStockSnapshot({ ticker: "NVDA", country: "US", status: "trend" })
const nvda = computeStockScores(toEngineSnapshot(nvdaSnap), { marketFitScore: 19 })
const reasons = buildRecommendReasons(nvda.scores, nvda.meta)

assert(reasons.length >= 2, "nvda reasons")
assert(reasons.some((r) => r.text === "강한 추세"), "strong trend reason")
assert(reasons.every((r) => r.emoji && r.text), "reason shape")

const lsSnap = getStockSnapshot({ ticker: "010120", country: "KR", status: "dip" })
const ls = computeStockScores(toEngineSnapshot(lsSnap), { marketFitScore: 16 })
const lsReasons = buildRecommendReasons(ls.scores, ls.meta)
assert(lsReasons.some((r) => r.text.includes("눌림") || r.text.includes("추세")), "ls reasons")

console.log("OK recommend reasons", {
  nvda: reasons.map((r) => r.text),
  ls: lsReasons.map((r) => r.text),
})
