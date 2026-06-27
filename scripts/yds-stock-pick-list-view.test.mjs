import assert from "node:assert/strict"
import {
  buildStockPickListRow,
  confidenceDisplayTier,
  sortStockPickList,
} from "../vite-project/src/content/ydsStockPickListView.js"

const stock = {
  ticker: "NVDA",
  name: "NVIDIA",
  country: "US",
  sector: "semiconductor",
  sectorLabel: "반도체",
  rank: 1,
  score: 85,
  snapshot: { price: 130, close: 130 },
  v4Score: {
    finalRankScore: 88,
    quality: 62,
    timing: 18,
    qualityGrade: "A",
    qualityDisplayGrade: "A+",
    timingGrade: "B",
  },
  recommendEngine: { compositeScore: 84 },
  trustReport: { aiConfidence: { score: 92, label: "매우 높음" }, recommendScore: 84 },
}

const row = buildStockPickListRow(stock)
assert.equal(row.aiScore, 84)
assert.ok(row.recommendGrade.includes("A+"))
assert.equal(confidenceDisplayTier(92).label, "매우 높음")
assert.equal(confidenceDisplayTier(65).label, "주의")

const sorted = sortStockPickList(
  [stock, { ...stock, ticker: "AMD", rank: 2, recommendEngine: { compositeScore: 70 } }],
  "aiScore",
  "desc",
)
assert.equal(sorted[0].ticker, "NVDA")

console.log("yds-stock-pick-list-view.test.mjs OK")
