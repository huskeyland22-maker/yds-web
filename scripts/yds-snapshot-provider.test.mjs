/**
 * Phase 2-6 snapshot provider — node scripts/yds-snapshot-provider.test.mjs
 */
import {
  getStockSnapshot,
  toEngineSnapshot,
  dummyProvider,
  yahooSnapshotProvider,
  naverSnapshotProvider,
} from "../vite-project/src/content/stockPickSnapshotProvider.js"
import { computeStockScores } from "../vite-project/src/content/ydsStockScoreEngine.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const us = getStockSnapshot({ ticker: "NVDA", country: "US", status: "trend" })
assert(us.ticker === "NVDA", "ticker")
assert(us.country === "US", "country")
assert(Number.isFinite(us.price) && Number.isFinite(us.ma20), "price fields")
assert(Number.isFinite(us.volume) && Number.isFinite(us.avgVolume20), "volume fields")

const kr = getStockSnapshot({ ticker: "257720", country: "KR", status: "trend" })
assert(kr.country === "KR", "kr country")

const engineInput = toEngineSnapshot(us)
const scored = computeStockScores(engineInput, { marketFitScore: 19 })
assert(scored.scores.totalScore >= 80, `total ${scored.scores.totalScore}`)

assert(dummyProvider.id === "dummy", "dummy id")
assert(yahooSnapshotProvider.getSnapshot({ ticker: "AAPL", country: "US" }).country === "US", "yahoo stub")
assert(naverSnapshotProvider.getSnapshot({ ticker: "005930", country: "KR" }).country === "KR", "naver stub")

console.log("OK snapshot provider", {
  usPrice: us.price,
  total: scored.scores.totalScore,
})
