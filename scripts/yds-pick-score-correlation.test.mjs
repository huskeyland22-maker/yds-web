import assert from "node:assert/strict"
import {
  buildScoreCorrelationReport,
  pearsonCorrelation,
  scoreToBucketId,
} from "../vite-project/src/content/ydsPickScoreCorrelation.js"

assert.equal(scoreToBucketId(92), "g90")
assert.equal(scoreToBucketId(85), "g80")
assert.equal(scoreToBucketId(55), "gLow")

const r = pearsonCorrelation([60, 70, 80, 90], [1, 3, 5, 8])
assert.ok(r != null && r > 0.9)

function pick(score, ret) {
  return {
    id: String(score),
    ticker: `T${score}`,
    name: `T${score}`,
    country: "US",
    rank: 1,
    isTop3: false,
    recommendedAt: "2026-05-01",
    recommendedPrice: 100,
    recommendedScore: score,
    qualityGrade: "A",
    timingGrade: "A",
    marketFitGrade: "A",
    statusId: "trend",
    statusLabel: "—",
    currentPrice: null,
    returnPct: null,
    horizons: { d7: ret, d14: null, d30: null, d90: null, d180: null, d365: null },
    horizonPrices: { d7: 100 + ret, d14: null, d30: null, d90: null, d180: null, d365: null },
    priceLog: {},
    regimeId: "neutral",
    regimeLabel: "—",
    strategyLabel: "—",
    recommendSnapshot: { totalScore: score, frozen: true, capturedAt: "2026-05-01" },
    recordedAt: 1,
    lastUpdatedAt: 1,
  }
}

const report = buildScoreCorrelationReport([
  pick(92, 12),
  pick(91, 8),
  pick(85, 3),
  pick(84, -2),
  pick(72, 1),
  pick(55, -5),
])

assert.equal(report.total, 6)
assert.ok(report.correlation != null)
const g90 = report.buckets.find((b) => b.id === "g90")
assert.equal(g90?.count, 2)
assert.equal(g90?.winRate, 100)
assert.equal(g90?.avgReturn, 10)

console.log("yds-pick-score-correlation.test.mjs OK")
