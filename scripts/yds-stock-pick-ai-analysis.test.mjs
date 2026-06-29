import assert from "node:assert/strict"
import { computeRecommendEngineReport } from "../vite-project/src/content/ydsStockRecommendEngine.js"
import {
  buildStockPickAiAnalysisReport,
  buildAiComprehensiveOpinion,
  buildAiRationaleProgressBars,
} from "../vite-project/src/content/ydsStockPickAiAnalysisEngine.js"
import { getRecommendScoreDelta } from "../vite-project/src/content/ydsStockPickScoreHistory.js"

const baseStock = {
  dataSource: "live",
  ticker: "GEV",
  name: "GE Vernova",
  country: "US",
  sector: "power",
  sectorLabel: "전력",
  rating: 4.2,
  rank: 2,
  v4Score: { finalRankScore: 89, quality: 58, timing: 22, recommendStatusId: "buy" },
  scoreBreakdown: { performance: 24, industry: 22, sector: 18, timing: 22, quality: 58, total: 84 },
  scores: { trendScore: 30, volumeScore: 16, positionScore: 14, marketFitScore: 18 },
  snapshot: { price: 180, close: 180, ma20: 172 },
  technicalScore: {
    checks: [
      { id: "ma20", pass: true },
      { id: "volume", pass: true },
    ],
  },
  actionGuide: { summary: "분할 매수 검토" },
}

const engine = computeRecommendEngineReport({
  ticker: baseStock.ticker,
  sector: baseStock.sector,
  rating: baseStock.rating,
  scores: baseStock.scores,
  scoreBreakdown: baseStock.scoreBreakdown,
  technicalScore: baseStock.technicalScore,
  statusId: "trend",
  marketFitReasons: ["시장상태 적합"],
})

const stock = { ...baseStock, recommendEngine: engine }

const opinion = buildAiComprehensiveOpinion(stock, {
  unifiedMarketStateLabel: "추세장",
  ydsScore: 42,
  liquidityScore: 68,
})
assert.ok(opinion.paragraphs.length >= 3)
assert.ok(opinion.text.length > 40)
assert.ok(!opinion.text.includes("AI 수요"))

const bars = buildAiRationaleProgressBars(stock)
assert.equal(bars.length, 6)
assert.ok(bars.find((b) => b.id === "supply"))
assert.ok(bars.find((b) => b.id === "momentum"))

const report = buildStockPickAiAnalysisReport(stock, {
  unifiedMarketStateLabel: "추세장",
  ydsScore: 42,
})
assert.equal(report.visible, true)
assert.ok(report.comprehensiveOpinion)
assert.ok(report.investmentScenarios.scenarios.length === 3)
assert.equal(
  report.investmentScenarios.scenarios.reduce((s, x) => s + x.probability, 0),
  100,
)

const today = new Date().toISOString().slice(0, 10)
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
const mockHistory = {
  GEV: [
    { date: yesterday, recommendScore: 84, total: 84 },
    { date: today, recommendScore: engine.compositeScore, total: 89 },
  ],
}
const delta = getRecommendScoreDelta(stock.ticker, mockHistory)
assert.ok(delta)
assert.equal(delta.previous, 84)
assert.ok(delta.delta !== 0 || delta.current === engine.compositeScore)

console.log("yds-stock-pick-ai-analysis.test.mjs OK")
