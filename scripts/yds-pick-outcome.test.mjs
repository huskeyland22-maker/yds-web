import assert from "node:assert/strict"
import {
  buildOutcomeSummaryReport,
  classifyPickOutcome,
  DEFAULT_OUTCOME_CRITERIA,
  resolvePickOutcomeView,
} from "../vite-project/src/content/ydsPickOutcomeEngine.js"

assert.equal(classifyPickOutcome(12), "success")
assert.equal(classifyPickOutcome(10), "success")
assert.equal(classifyPickOutcome(5), "normal")
assert.equal(classifyPickOutcome(0), "failure")
assert.equal(classifyPickOutcome(-2), "failure")
assert.equal(classifyPickOutcome(null), null)

assert.equal(resolvePickOutcomeView(12)?.emoji, "🟢")
assert.equal(resolvePickOutcomeView(5)?.emoji, "🟡")
assert.equal(resolvePickOutcomeView(-1)?.emoji, "🔴")

/** @type {import("../vite-project/src/content/ydsValidationStorage.js").ValidationPickRecord[]} */
const picks = [
  { id: "1", horizons: { d30: 12, d7: null, d14: null, d90: null, d180: null, d365: null } },
  { id: "2", horizons: { d30: 8, d7: null, d14: null, d90: null, d180: null, d365: null } },
  { id: "3", horizons: { d30: -3, d7: null, d14: null, d90: null, d180: null, d365: null } },
  { id: "4", horizons: { d30: 15, d7: null, d14: null, d90: null, d180: null, d365: null } },
].map((p, i) => ({
  ...p,
  ticker: `T${i}`,
  name: `T${i}`,
  country: "US",
  rank: 1,
  isTop3: false,
  recommendedAt: "2026-06-01",
  recommendedPrice: 100,
  recommendedScore: 90,
  qualityGrade: "A",
  timingGrade: "A",
  marketFitGrade: "A",
  statusId: "trend",
  statusLabel: "—",
  currentPrice: null,
  returnPct: null,
  horizonPrices: { d7: null, d14: null, d30: 100, d90: null, d180: null, d365: null },
  priceLog: {},
  regimeId: "neutral",
  regimeLabel: "—",
  strategyLabel: "—",
  recommendSnapshot: null,
  recordedAt: 1,
  lastUpdatedAt: 1,
}))

const summary = buildOutcomeSummaryReport(picks, "d30", DEFAULT_OUTCOME_CRITERIA)
assert.equal(summary.total, 4)
assert.equal(summary.successCount, 2)
assert.equal(summary.normalCount, 1)
assert.equal(summary.failureCount, 1)
assert.equal(summary.successRate, 50)
assert.equal(summary.avgReturn, 8)

console.log("yds-pick-outcome.test.mjs OK")
