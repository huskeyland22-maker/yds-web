import assert from "node:assert/strict"
import {
  computeRecommendEngineReport,
  getRecommendEngineSortScore,
  RECOMMEND_ENGINE_LABELS,
} from "../vite-project/src/content/ydsStockRecommendEngine.js"

const report = computeRecommendEngineReport({
  ticker: "NVDA",
  sector: "ai",
  rating: 5,
  statusId: "trend",
  scores: { trendScore: 32, volumeScore: 14, positionScore: 16, marketFitScore: 18 },
  scoreMeta: { drawdownPct: 3 },
  technicalScore: {
    score: 8,
    checks: [
      { id: "ma20", pass: true },
      { id: "high52", pass: true },
      { id: "rsi", pass: true },
    ],
  },
  scoreBreakdown: { performance: 28, industry: 20, sector: 16 },
  timingScore: { score: 18 },
  engineSnapshot: {
    close: 950,
    high52w: 960,
    ma20: 900,
    ma60: 850,
    ma120: 800,
    volumeToday: 100,
    volumeAvg20: 80,
  },
  marketFitReasons: [{ text: "시장 상태와 적합" }],
})

assert.equal(Object.keys(RECOMMEND_ENGINE_LABELS).length, 6)
assert.ok(report.compositeScore >= 0 && report.compositeScore <= 100)
assert.ok(report.reasons.length >= 1)
assert.ok(report.rationales.every((r) => r.text && r.ratio > 0))
assert.ok(getRecommendEngineSortScore({ recommendEngine: report }) === report.compositeScore)

console.log("yds-stock-recommend-engine.test.mjs OK", {
  composite: report.compositeScore,
  reasons: report.reasons.map((r) => r.text),
})
