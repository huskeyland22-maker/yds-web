import assert from "node:assert/strict"
import {
  buildSuccessPatternReport,
  classifyOutcome,
  normalizeMarketStateBucket,
  panicBucketForIntensity,
  PATTERN_MIN_SAMPLE,
} from "../vite-project/src/content/ydsPickSuccessPatternEngine.js"

assert.equal(classifyOutcome(12), "success")
assert.equal(classifyOutcome(10), "success")
assert.equal(classifyOutcome(5), "normal")
assert.equal(classifyOutcome(0), "failure")
assert.equal(classifyOutcome(-3), "failure")

assert.equal(normalizeMarketStateBucket("경계 구간 진입").label, "경계진입")
assert.equal(normalizeMarketStateBucket("조정 구간 진입").label, "조정진입")
assert.equal(normalizeMarketStateBucket("회복 진행").label, "조정회복")
assert.equal(normalizeMarketStateBucket("상승초기").label, "상승초기")

assert.equal(panicBucketForIntensity(35)?.label, "20~40")
assert.equal(panicBucketForIntensity(55)?.label, "40~60")

/** @type {import("../vite-project/src/content/ydsValidationStorage.js").ValidationPickRecord[]} */
const picks = Array.from({ length: 12 }, (_, i) => ({
  id: `p-${i}`,
  ticker: `T${i}`,
  name: `T${i}`,
  country: "US",
  rank: i + 1,
  isTop3: i < 3,
  recommendedAt: "2026-05-01",
  recommendedPrice: 100,
  recommendedScore: 90,
  qualityGrade: "A",
  timingGrade: i % 2 === 0 ? "A" : "B",
  marketFitGrade: "A",
  statusId: "trend",
  statusLabel: "추세",
  currentPrice: null,
  returnPct: null,
  horizons: { d7: null, d14: null, d30: i < 8 ? 12 : 2, d90: null, d180: null, d365: null },
  horizonPrices: { d7: null, d14: null, d30: 112, d90: null, d180: null, d365: null },
  priceLog: {},
  regimeId: "neutral",
  regimeLabel: "중립",
  strategyLabel: "조정 구간 진입",
  recommendSnapshot: {
    name: `T${i}`,
    recommendedPrice: 100,
    totalScore: 90,
    qualityGrade: "A",
    qualityScore: 80,
    timingGrade: "A",
    timingScore: 70,
    marketFitGrade: "A",
    marketFitScore: 60,
    marketStateLabel: "조정 구간 진입",
    panicIntensity: 45,
    panicLabel: "관심",
    capturedAt: "2026-05-01",
    frozen: true,
  },
  recordedAt: 1,
  lastUpdatedAt: 1,
}))

const report = buildSuccessPatternReport(picks, "d30")
assert.equal(report.totalTracked, 12)
assert.ok(report.grades.quality.find((g) => g.label === "품질 A")?.sufficient)
assert.equal(report.grades.quality.find((g) => g.label === "품질 A")?.successRate, 66.7)
assert.equal(report.marketStates[0]?.label, "조정진입")
assert.ok(report.panicBands.find((b) => b.label === "패닉 40~60")?.sufficient)

assert.equal(PATTERN_MIN_SAMPLE, 10)

console.log("yds-pick-success-pattern.test.mjs OK")
