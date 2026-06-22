import assert from "node:assert/strict"
import { buildPerfInsightReport } from "../vite-project/src/content/ydsPickPerfInsight.js"
import { buildTopSuccessReport } from "../vite-project/src/content/ydsPickTopSuccessReport.js"

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
    recommendedScore: 48,
    qualityGrade: "A",
    timingGrade: "C",
    marketFitGrade: "A",
    statusId: "trend",
    statusLabel: "—",
    currentPrice: null,
    returnPct: null,
    horizons: { d7: 15.5, d14: null, d30: null, d90: null, d180: null, d365: null },
    horizonPrices: { d7: 115.5, d14: null, d30: null, d90: null, d180: null, d365: null },
    priceLog: {},
    regimeId: "neutral",
    regimeLabel: "—",
    strategyLabel: "관심·분할",
    recommendSnapshot: {
      totalScore: 48,
      qualityGrade: "A",
      qualityScore: 62,
      timingGrade: "C",
      timingScore: 14,
      marketFitGrade: "A",
      marketFitScore: 12,
      marketStateLabel: "관심·분할",
      panicIntensity: 37,
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
    horizons: { d7: -4, d14: null, d30: null, d90: null, d180: null, d365: null },
    recommendSnapshot: {
      ...basePick().recommendSnapshot,
      totalScore: 52,
      timingGrade: "B",
      panicIntensity: 28,
    },
  }),
  basePick({
    id: "3",
    ticker: "LS",
    name: "LS ELECTRIC",
    horizons: { d7: 2, d14: null, d30: null, d90: null, d180: null, d365: null },
    recommendSnapshot: {
      ...basePick().recommendSnapshot,
      totalScore: 50,
      marketFitGrade: "B",
      panicIntensity: 35,
    },
  }),
  basePick({
    id: "4",
    ticker: "MSFT",
    name: "마이크로소프트",
    horizons: { d7: -1, d14: null, d30: null, d90: null, d180: null, d365: null },
    recommendSnapshot: {
      ...basePick().recommendSnapshot,
      totalScore: 47,
      panicIntensity: 22,
    },
  }),
]

const insight = buildPerfInsightReport(picks)
assert.equal(insight.visible, true)
assert.equal(insight.total, 4)
assert.ok(insight.insights.length >= 3 && insight.insights.length <= 5)
assert.ok(insight.insights.some((l) => l.includes("승률") || l.includes("수익") || l.includes("전략")))

const emptyInsight = buildPerfInsightReport([])
assert.equal(emptyInsight.visible, false)

const topReport = buildTopSuccessReport(picks)
assert.equal(topReport.visible, true)
assert.equal(topReport.cases.length, 1)
assert.equal(topReport.cases[0].name, "엔비디아")
assert.equal(topReport.cases[0].returnPct, 15.5)
assert.equal(topReport.cases[0].totalScore, 48)
assert.equal(topReport.cases[0].marketFitGrade, "A")
assert.ok(topReport.commonTraits.length > 0)

const noSuccess = buildTopSuccessReport([
  basePick({ horizons: { d7: 2, d14: null, d30: null, d90: null, d180: null, d365: null } }),
])
assert.equal(noSuccess.visible, false)

console.log("yds-pick-perf-insight-top-success.test.mjs OK")
