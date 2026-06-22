import assert from "node:assert/strict"
import { buildExpectedValueAnalysisReport } from "../vite-project/src/content/ydsPickExpectedValueAnalysis.js"
import { isExpectedValuePanelVisible } from "../vite-project/src/content/ydsPickPerfPanelVisibility.js"

function basePick(overrides = {}) {
  return {
    id: "1",
    ticker: "NVDA",
    name: "엔비디아",
    horizons: { d7: null, d14: null, d30: null, d90: null, d180: null, d365: null },
    ...overrides,
  }
}

// 홈런형: 낮은 승률 · 큰 평균수익 · 작은 평균손실
const homeRunPicks = [
  basePick({ id: "w1", horizons: { d7: 14.2 } }),
  basePick({ id: "w2", horizons: { d7: 14.2 } }),
  basePick({ id: "w3", horizons: { d7: 14.2 } }),
  ...Array.from({ length: 8 }, (_, i) =>
    basePick({ id: `l${i}`, horizons: { d7: -4.7 } }),
  ),
]

const homeRun = buildExpectedValueAnalysisReport(homeRunPicks)
const d7 = homeRun.horizons.find((h) => h.key === "d7")
assert.ok(d7?.visible)
assert.equal(d7.total, 11)
assert.equal(d7.winRate, 27.3)
assert.equal(d7.avgWin, 14.2)
assert.equal(d7.avgLoss, -4.7)
assert.ok(d7.expectedValue > 0)
assert.ok(homeRun.interpretations.some((l) => l.includes("홈런형")))
assert.ok(isExpectedValuePanelVisible(homeRun))

const mixed = buildExpectedValueAnalysisReport([
  basePick({ id: "a", horizons: { d7: 15.5, d14: 10, d30: 5 } }),
  basePick({ id: "b", horizons: { d7: -4, d14: -2, d30: -1 } }),
  basePick({ id: "c", horizons: { d7: 2, d14: 3, d30: 4 } }),
  basePick({ id: "d", horizons: { d7: -1, d14: 1, d30: 2 } }),
])
assert.equal(mixed.visible, true)
assert.equal(mixed.horizons.filter((h) => h.visible).length, 3)

const d7mixed = mixed.horizons.find((h) => h.key === "d7")
assert.equal(d7mixed.winRate, 50)
assert.equal(d7mixed.avgWin, 8.8)
assert.equal(d7mixed.avgLoss, -2.5)
assert.equal(d7mixed.expectedValue, 3.2)

const empty = buildExpectedValueAnalysisReport([])
assert.equal(empty.visible, false)
assert.equal(isExpectedValuePanelVisible(empty), false)

console.log("yds-pick-expected-value.test.mjs OK")
