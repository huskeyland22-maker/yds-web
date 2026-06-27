import assert from "node:assert/strict"
import {
  getRecommendStatusTheme,
  isBuyPossibleStatus,
} from "../vite-project/src/content/ydsStockPickRecommendColors.js"
import {
  applyStockPickFilters,
  DEFAULT_STOCK_PICK_FILTERS,
} from "../vite-project/src/content/ydsStockPickFilterEngine.js"
import {
  buildStockPickInvestDashboard,
  estimateHoldPeriodLabel,
} from "../vite-project/src/content/ydsStockPickDashboardEngine.js"

assert.equal(getRecommendStatusTheme("aggressiveBuy").label, "적극매수")
assert.equal(getRecommendStatusTheme("noChase").tone, "exclude")
assert.ok(isBuyPossibleStatus("buy"))

const stock = {
  dataSource: "live",
  ticker: "NVDA",
  name: "NVIDIA",
  country: "US",
  sector: "semiconductor",
  rank: 1,
  score: 85,
  snapshot: { price: 130 },
  v4Score: {
    recommendStatusId: "buy",
    qualityDisplayGrade: "A+",
    timingGrade: "B",
    finalRankScore: 88,
  },
  recommendEngine: { compositeScore: 84 },
  trustReport: { aiConfidence: { score: 92 } },
}

const filtered = applyStockPickFilters(
  [stock, { ...stock, ticker: "X", v4Score: { ...stock.v4Score, recommendStatusId: "noChase" } }],
  { ...DEFAULT_STOCK_PICK_FILTERS, buyPossibleOnly: true },
)
assert.equal(filtered.length, 1)

const dash = buildStockPickInvestDashboard([stock])
assert.ok(dash.visible)
assert.equal(dash.recommendCount, 1)

assert.equal(estimateHoldPeriodLabel("buy"), "3~6주")

console.log("yds-stock-pick-density.test.mjs OK")
