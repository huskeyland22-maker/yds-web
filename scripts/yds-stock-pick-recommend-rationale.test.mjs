import assert from "node:assert/strict"
import {
  buildRecommendRationales,
  RATIONALE_MAX_ITEMS,
  serializeRationalesForSnapshot,
} from "../vite-project/src/content/ydsStockPickRecommendRationale.js"

const stock = {
  ticker: "NVDA",
  name: "엔비디아",
  rating: 5,
  scores: { trendScore: 32, volumeScore: 14, marketFitScore: 16 },
  scoreBreakdown: {
    performance: 28,
    industry: 20,
    sector: 16,
    marketEnv: 12,
    timing: 19,
    quality: 64,
    total: 83,
  },
  timingScore: { score: 19 },
  v4Score: { timingGrade: "B", qualityGrade: "A" },
}

const items = buildRecommendRationales(stock)
assert.ok(items.length > 0)
assert.ok(items.length <= RATIONALE_MAX_ITEMS)
for (const item of items) {
  assert.ok(item.text.length <= 20)
  assert.ok(item.source)
  assert.ok(item.category)
}

const snap = serializeRationalesForSnapshot(items)
assert.equal(snap[0].id, items[0].id)
assert.equal(snap[0].score, items[0].score)

const weak = buildRecommendRationales({
  rating: 2,
  scores: { trendScore: 8, volumeScore: 4, marketFitScore: 5 },
  scoreBreakdown: { performance: 8, industry: 6, sector: 5, marketEnv: 4, timing: 6 },
  timingScore: { score: 6 },
  v4Score: { timingGrade: "D" },
})
assert.ok(weak.length < items.length)

console.log("yds-stock-pick-recommend-rationale.test.mjs OK")
