import assert from "node:assert/strict"
import { buildPickValidationDetailReport } from "../vite-project/src/content/ydsPickValidationDetailEngine.js"
import { buildRankingPageReport } from "../vite-project/src/content/ydsStockPickRankingEngine.js"
import { buildStockPickCompareReport, parseCompareTickers } from "../vite-project/src/content/ydsStockPickCompareEngine.js"
import { buildStockPickBacktestReport } from "../vite-project/src/content/ydsStockPickBacktestEngine.js"
import { computeRecommendEngineReport } from "../vite-project/src/content/ydsStockRecommendEngine.js"

const baseStock = {
  dataSource: "live",
  ticker: "NVDA",
  name: "NVIDIA",
  country: "US",
  sector: "semiconductor",
  rank: 2,
  rating: 4.5,
  v4Score: { finalRankScore: 88, quality: 62, timing: 18, recommendStatusId: "buy" },
  scoreBreakdown: { performance: 26, industry: 20, timing: 18, quality: 62, total: 80 },
  scores: { trendScore: 32, volumeScore: 14, marketFitScore: 16 },
  snapshot: { price: 120, close: 120 },
  technicalScore: { checks: [{ id: "ma20", pass: true }] },
}

const engine = computeRecommendEngineReport({
  ticker: "NVDA",
  sector: "semiconductor",
  rating: 4.5,
  scores: baseStock.scores,
  scoreBreakdown: baseStock.scoreBreakdown,
  technicalScore: baseStock.technicalScore,
  statusId: "trend",
})
const stock = { ...baseStock, recommendEngine: engine, trustReport: { aiConfidence: { score: 82 } } }

const pick = {
  id: "2026-01-01:US:NVDA",
  ticker: "NVDA",
  name: "NVIDIA",
  country: "US",
  recommendedAt: "2026-01-01",
  recommendedPrice: 100,
  recommendedScore: 80,
  currentPrice: 120,
  statusId: "buy",
  statusLabel: "매수",
  horizons: { d7: 5, d30: 12 },
  priceLog: { "2026-01-01": 100, "2026-01-15": 115, "2026-02-01": 120 },
  recommendSnapshot: { topReasons: ["AI 수요"] },
}

const detail = buildPickValidationDetailReport(pick, stock)
assert.equal(detail.visible, true)
assert.ok(detail.priceSeries.length >= 2)
assert.ok(detail.recommendReasons.length)

const ranking = buildRankingPageReport([stock, { ...stock, ticker: "AMD", name: "AMD", rank: 5 }], "aiScore", "desc")
assert.ok(ranking.rows.length === 2)

const tickers = parseCompareTickers("NVDA,AMD")
assert.equal(tickers.length, 2)
const compare = buildStockPickCompareReport(
  [stock, { ...stock, ticker: "AMD", name: "AMD" }],
  tickers,
)
assert.equal(compare.stocks.length, 2)
assert.ok(compare.radarData.length)

const backtest = buildStockPickBacktestReport([pick], 30)
assert.ok(backtest.title)

console.log("yds-stock-pick-suite-go82-86.test.mjs OK")
