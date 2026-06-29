import assert from "node:assert/strict"
import {
  buildStockPickTrustReport,
  buildTodayRecommendBriefing,
  buildStockPickHubHistoryReport,
  computeAiConfidence,
  confidenceLabelFromScore,
} from "../vite-project/src/content/ydsStockPickTrustEngine.js"
import { computeRecommendEngineReport } from "../vite-project/src/content/ydsStockRecommendEngine.js"

const baseStock = {
  dataSource: "live",
  ticker: "NVDA",
  name: "NVIDIA",
  country: "US",
  sector: "semiconductor",
  sectorLabel: "반도체",
  rating: 4.5,
  rank: 3,
  score: 82,
  v4Score: {
    finalRankScore: 88,
    quality: 62,
    timing: 18,
    top5Eligible: true,
    recommendStatusId: "buy",
  },
  scoreBreakdown: {
    performance: 26,
    industry: 20,
    marketEnv: 12,
    timing: 18,
    quality: 62,
    total: 80,
  },
  scores: { trendScore: 32, volumeScore: 14, marketFitScore: 16 },
  snapshot: { price: 120, ma20: 115, close: 120 },
  recommendRationales: [{ text: "AI 수요 견조" }],
  technicalScore: {
    checks: [
      { id: "ma20", pass: true, label: "20일선 위" },
      { id: "volume", pass: true, label: "거래량 증가" },
    ],
  },
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
const trust = buildStockPickTrustReport(stock, null)

assert.equal(trust.topReasons.length, 3)
assert.ok(trust.aiConfidence.score >= 0 && trust.aiConfidence.score <= 100)
assert.equal(trust.excludeReason, null)
assert.equal(trust.scoreBars.length, 6)
assert.ok(trust.aiRisk.items.length <= 3)
assert.ok(trust.tradeStrategy.visible)
assert.ok(trust.aiTracking.milestones.length === 4)

const excluded = buildStockPickTrustReport(
  {
    ...stock,
    rank: 40,
    v4Score: { ...stock.v4Score, top5Eligible: false, recommendStatusId: "noChase" },
  },
  null,
)
assert.ok(excluded.excludeReason)

assert.equal(confidenceLabelFromScore(94), "매우 높음")
assert.equal(confidenceLabelFromScore(59), "낮음")
assert.ok(computeAiConfidence(stock, engine).label)

const briefing = buildTodayRecommendBriefing([stock, { ...stock, ticker: "AMD", sectorLabel: "반도체" }], {
  ready: true,
  marketPositionId: "boundary",
  unifiedMarketStateLabel: "기회대기",
})
assert.ok(briefing.visible)
assert.ok(briefing.lines.length <= 3)

const history = buildStockPickHubHistoryReport([stock])
assert.ok(typeof history.visible === "boolean")

console.log("yds-stock-pick-trust.test.mjs OK")
