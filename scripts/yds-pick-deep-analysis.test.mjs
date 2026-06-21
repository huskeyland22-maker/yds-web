import assert from "node:assert/strict"
import { buildComponentContributionReport } from "../vite-project/src/content/ydsPickComponentContribution.js"
import { buildPanicDeepAnalysisReport } from "../vite-project/src/content/ydsPickPanicDeepAnalysis.js"
import { buildMarketStateStrategyReport } from "../vite-project/src/content/ydsPickMarketStateStrategy.js"

function basePick(overrides = {}) {
  return {
    id: "1",
    ticker: "NVDA",
    name: "엔비디아",
    country: "US",
    rank: 1,
    isTop3: true,
    recommendedAt: "2026-05-01",
    recommendedPrice: 100,
    recommendedScore: 88,
    qualityGrade: "A",
    timingGrade: "A",
    marketFitGrade: "A",
    statusId: "trend",
    statusLabel: "—",
    currentPrice: null,
    returnPct: null,
    horizons: { d7: 10, d14: null, d30: null, d90: null, d180: null, d365: null },
    horizonPrices: { d7: 110, d14: null, d30: null, d90: null, d180: null, d365: null },
    priceLog: {},
    regimeId: "neutral",
    regimeLabel: "—",
    strategyLabel: "관심·분할",
    recommendSnapshot: {
      totalScore: 88,
      qualityGrade: "A",
      qualityScore: 62,
      timingGrade: "A",
      timingScore: 21,
      marketFitGrade: "A",
      marketFitScore: 12,
      marketStateLabel: "관심·분할",
      panicIntensity: 35,
      capturedAt: "2026-05-01",
      frozen: true,
    },
    recordedAt: 1,
    lastUpdatedAt: 1,
    ...overrides,
  }
}

const picks = [
  basePick(),
  basePick({
    id: "2",
    ticker: "SK",
    name: "SK하이닉스",
    horizons: { d7: -3, d14: null, d30: null, d90: null, d180: null, d365: null },
    recommendSnapshot: {
      ...basePick().recommendSnapshot,
      timingScore: 14,
      timingGrade: "C",
      panicIntensity: 65,
      marketStateLabel: "방어 모드",
    },
    strategyLabel: "방어 모드",
  }),
  basePick({
    id: "3",
    ticker: "LS",
    name: "LS ELECTRIC",
    horizons: { d7: 15, d14: null, d30: null, d90: null, d180: null, d365: null },
    recommendSnapshot: {
      ...basePick().recommendSnapshot,
      qualityScore: 48,
      qualityGrade: "B",
      panicIntensity: 82,
      marketStateLabel: "패닉·위축",
    },
    strategyLabel: "패닉·위축",
  }),
]

const contrib = buildComponentContributionReport(picks)
assert.equal(contrib.total, 3)
assert.ok(contrib.ranking.length >= 2)
assert.ok(contrib.components.find((c) => c.id === "timing"))

const panic = buildPanicDeepAnalysisReport(picks)
assert.equal(panic.zones.length, 5)
assert.ok(panic.zones.some((z) => z.count > 0))

const market = buildMarketStateStrategyReport(picks)
assert.ok(market.strategies.find((s) => s.id === "opportunity"))
assert.ok(market.strategies.find((s) => s.id === "defensive"))

console.log("yds-pick-deep-analysis.test.mjs OK")
