import assert from "node:assert/strict"
import {
  bucketPatternGrade,
  getPickPatternGrade,
  parseRawGrade,
} from "../vite-project/src/content/ydsPickPatternGrades.js"
import { buildSuccessPatternReport } from "../vite-project/src/content/ydsPickSuccessPatternEngine.js"

assert.equal(parseRawGrade("A+"), "A+")
assert.equal(parseRawGrade("기업품질 A+"), "A+")
assert.equal(parseRawGrade("타이밍 B"), "B")
assert.equal(bucketPatternGrade("quality", "A+"), "A")
assert.equal(bucketPatternGrade("quality", "A"), "A")
assert.equal(bucketPatternGrade("timing", "F"), "D")
assert.equal(bucketPatternGrade("marketFit", "D"), "C")

const pick = {
  id: "x",
  ticker: "NVDA",
  qualityGrade: "—",
  timingGrade: "B",
  marketFitGrade: "A",
  recommendSnapshot: {
    qualityGrade: "A+",
    timingGrade: "A",
    marketFitGrade: "B",
    capturedAt: "2026-05-01",
    frozen: true,
  },
}
assert.equal(getPickPatternGrade(pick, "quality"), "A")
assert.equal(getPickPatternGrade(pick, "timing"), "A")
assert.equal(getPickPatternGrade(pick, "marketFit"), "B")

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
  qualityGrade: i < 8 ? "A+" : "B",
  timingGrade: i % 2 === 0 ? "A" : "B",
  marketFitGrade: "A",
  statusId: "trend",
  statusLabel: "추세",
  currentPrice: null,
  returnPct: null,
  horizons: {
    d7: i < 6 ? (i < 4 ? 12 : 2) : null,
    d14: null,
    d30: i < 10 ? (i < 6 ? 12 : 2) : null,
    d90: null,
    d180: null,
    d365: null,
  },
  horizonPrices: { d7: null, d14: null, d30: 112, d90: null, d180: null, d365: null },
  priceLog: {},
  regimeId: "neutral",
  regimeLabel: "중립",
  strategyLabel: "조정 구간 진입",
  recommendSnapshot: {
    name: `T${i}`,
    recommendedPrice: 100,
    totalScore: 90,
    qualityGrade: i < 8 ? "A+" : "B",
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

const d7 = buildSuccessPatternReport(picks, "d7")
assert.ok(d7.grades.quality.find((g) => g.label === "품질 A")?.count > 0)
assert.equal(d7.horizonKey, "d7")

const d30 = buildSuccessPatternReport(picks, "d30")
const qualityA = d30.grades.quality.find((g) => g.label === "품질 A")
assert.ok(qualityA)
assert.equal(qualityA.count, 8)
assert.equal(qualityA.successRate, 75)

console.log("yds-pick-pattern-grades.test.mjs OK")
