import assert from "node:assert/strict"
import {
  buildAllocationCompareReport,
  classifyAllocationDelta,
  formatAllocationDelta,
  scoreFromAllocationGap,
} from "../vite-project/src/content/ydsPortfolioAllocationCompare.js"

const report = buildAllocationCompareReport({
  actualStockPct: 75,
  actualCashPct: 25,
  recommendedStockPct: 40,
  recommendedCashPct: 60,
})

assert.equal(report.stock.currentPct, 75)
assert.equal(report.stock.recommendedPct, 40)
assert.equal(report.stock.deltaLabel, "+35%")
assert.equal(report.stock.status, "excess")
assert.equal(report.cash.deltaLabel, "-35%")
assert.equal(report.cash.status, "short")
assert.equal(report.postureId, "aggressive")
assert.equal(report.maxGapPct, 35)

const ok = classifyAllocationDelta(5)
assert.equal(ok.status, "ok")
assert.equal(ok.badge, "🟢")

const warn = classifyAllocationDelta(15)
assert.equal(warn.status, "warn")

assert.equal(formatAllocationDelta(-12), "-12%")
assert.ok(scoreFromAllocationGap(35, 30) < scoreFromAllocationGap(5, 30))

console.log("yds-portfolio-allocation-compare.test.mjs OK")
