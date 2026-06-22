import assert from "node:assert/strict"
import { buildComponentContributionReport } from "../vite-project/src/content/ydsPickComponentContribution.js"
import { buildOutcomeSummaryReport } from "../vite-project/src/content/ydsPickOutcomeEngine.js"
import { buildPanicDeepAnalysisReport } from "../vite-project/src/content/ydsPickPanicDeepAnalysis.js"
import { PATTERN_MIN_SAMPLE } from "../vite-project/src/content/ydsPickSuccessPatternEngine.js"
import {
  buildHorizonAvailability,
  hasAnyPositiveCount,
  hasDisplayablePatternBuckets,
  isComponentContributionPanelVisible,
  isHorizonTabEnabled,
  isMonthlySeriesVisible,
  isOutcomePanelVisible,
  isPanicDeepPanelVisible,
  isScoreCorrelationPanelVisible,
  isSuccessPatternPanelVisible,
  resolveDefaultHorizon,
} from "../vite-project/src/content/ydsPickPerfPanelVisibility.js"
import { buildScoreCorrelationReport } from "../vite-project/src/content/ydsPickScoreCorrelation.js"
import { buildSuccessPatternReport } from "../vite-project/src/content/ydsPickSuccessPatternEngine.js"

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

const emptyPicks = []
const d7Only = [basePick()]

assert.equal(hasAnyPositiveCount([]), false)
assert.equal(hasAnyPositiveCount([{ count: 0 }, { count: 0 }]), false)
assert.equal(hasAnyPositiveCount([{ count: 3 }]), true)

const availEmpty = buildHorizonAvailability(emptyPicks)
assert.deepEqual(availEmpty, { d7: 0, d14: 0, d30: 0 })
assert.equal(isHorizonTabEnabled(availEmpty, "d14"), false)
assert.equal(resolveDefaultHorizon(availEmpty, "d30"), "d7")

const availD7 = buildHorizonAvailability(d7Only)
assert.equal(availD7.d7, 1)
assert.equal(isHorizonTabEnabled(availD7, "d7"), true)
assert.equal(isHorizonTabEnabled(availD7, "d14"), false)
assert.equal(resolveDefaultHorizon(availD7, "d30"), "d7")

assert.equal(isOutcomePanelVisible(buildOutcomeSummaryReport(emptyPicks, "d7")), false)
assert.equal(isOutcomePanelVisible(buildOutcomeSummaryReport(d7Only, "d7")), true)

assert.equal(isSuccessPatternPanelVisible(buildSuccessPatternReport(emptyPicks, "d7")), false)
assert.equal(isSuccessPatternPanelVisible(buildSuccessPatternReport(d7Only, "d7")), false)
assert.equal(
  hasDisplayablePatternBuckets(buildSuccessPatternReport(d7Only, "d7")),
  false,
)

const manyPicks = Array.from({ length: PATTERN_MIN_SAMPLE }, (_, i) =>
  basePick({
    id: String(i + 1),
    recommendedAt: `2026-05-${String(i + 1).padStart(2, "0")}`,
  }),
)
assert.equal(isSuccessPatternPanelVisible(buildSuccessPatternReport(manyPicks, "d7")), true)

assert.equal(isScoreCorrelationPanelVisible(buildScoreCorrelationReport(emptyPicks)), false)
assert.equal(isScoreCorrelationPanelVisible(buildScoreCorrelationReport(d7Only)), true)

assert.equal(isComponentContributionPanelVisible(buildComponentContributionReport(emptyPicks)), false)
assert.equal(isComponentContributionPanelVisible(buildComponentContributionReport(d7Only)), true)

assert.equal(isPanicDeepPanelVisible(buildPanicDeepAnalysisReport(emptyPicks)), false)
assert.equal(isPanicDeepPanelVisible(buildPanicDeepAnalysisReport(d7Only)), true)

assert.equal(isMonthlySeriesVisible([]), false)
assert.equal(isMonthlySeriesVisible([{ count: 0 }]), false)
assert.equal(isMonthlySeriesVisible([{ count: 2 }]), true)

console.log("yds-pick-perf-panel-visibility.test.mjs OK")
