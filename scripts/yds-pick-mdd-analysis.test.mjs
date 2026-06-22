import assert from "node:assert/strict"
import { addCalendarDays } from "../vite-project/src/content/ydsValidationEngine.js"
import { buildMddAnalysisReport } from "../vite-project/src/content/ydsPickMddAnalysis.js"
import { isMddAnalysisPanelVisible } from "../vite-project/src/content/ydsPickPerfPanelVisibility.js"

function basePick(overrides = {}) {
  return {
    id: "1",
    ticker: "SK",
    name: "SK하이닉스",
    recommendedAt: "2026-05-01",
    recommendedPrice: 100,
    horizons: { d7: null, d14: null, d30: null, d90: null, d180: null, d365: null },
    horizonPrices: { d7: null, d14: null, d30: null, d90: null, d180: null, d365: null },
    priceLog: {},
    ...overrides,
  }
}

const endD7 = addCalendarDays("2026-05-01", 7)

// 최대 수익 +28.6% · 최대 손실 -11.2% · 보유 중 -13.5% 낙폭 후 회복
const picks = [
  basePick({
    id: "gain",
    horizons: { d7: 28.6, d14: 20, d30: 15 },
    horizonPrices: { d7: 128.6, d14: 120, d30: 115 },
    priceLog: {
      "2026-05-01": 100,
      "2026-05-03": 110,
      [endD7]: 128.6,
    },
  }),
  basePick({
    id: "loss",
    name: "종목A",
    ticker: "AAA",
    horizons: { d7: -11.2, d14: -8, d30: -5 },
    horizonPrices: { d7: 88.8, d14: 92, d30: 95 },
    priceLog: {
      "2026-05-01": 100,
      "2026-05-04": 86.5,
      [endD7]: 88.8,
    },
  }),
  basePick({
    id: "mid",
    name: "LS ELECTRIC",
    ticker: "LS",
    horizons: { d7: 3, d14: 4, d30: 6 },
    horizonPrices: { d7: 103, d14: 104, d30: 106 },
    priceLog: { "2026-05-01": 100, [endD7]: 103 },
  }),
]

const report = buildMddAnalysisReport(picks)
assert.equal(report.visible, true)
assert.ok(isMddAnalysisPanelVisible(report))

const d7 = report.horizons.find((h) => h.key === "d7")
assert.ok(d7?.visible)
assert.equal(d7.maxGain?.name, "SK하이닉스")
assert.equal(d7.maxGain?.returnPct, 28.6)
assert.equal(d7.maxLoss?.name, "종목A")
assert.equal(d7.maxLoss?.returnPct, -11.2)
assert.ok(d7.mdd != null && d7.mdd <= -13.5)
assert.ok(report.interpretations.length > 0)

const d14 = report.horizons.find((h) => h.key === "d14")
assert.ok(d14?.visible)
assert.equal(d14.total, 3)

const empty = buildMddAnalysisReport([])
assert.equal(empty.visible, false)

console.log("yds-pick-mdd-analysis.test.mjs OK")
