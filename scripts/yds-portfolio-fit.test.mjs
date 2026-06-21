import assert from "node:assert/strict"
import { buildPortfolioFitDetail, FIT_SCORE_COMPONENTS } from "../vite-project/src/content/ydsPortfolioFitEngine.js"

const maxTotal = FIT_SCORE_COMPONENTS.reduce((s, c) => s + c.max, 0)
assert.equal(maxTotal, 100)

const detail = buildPortfolioFitDetail({
  actualStockPct: 85,
  actualCashPct: 15,
  recommendedStockPct: 60,
  recommendedCashPct: 40,
  sectors: [{ sector: "반도체", weightPct: 45 }],
  themes: [{ theme: "AI", weightPct: 50 }],
  marketContext: { ready: true, strategyLabel: "방어", panicLabel: "공포", isDefensive: true },
})

assert.equal(detail.components.length, 5)
assert.equal(detail.total, detail.components.reduce((s, c) => s + c.score, 0))
assert.ok(detail.total < 75)
assert.equal(detail.grade, detail.total >= 55 ? "C" : detail.grade)
assert.ok(detail.deductions.length > 0)
assert.ok(detail.improvements.length > 0)

const perfect = buildPortfolioFitDetail({
  actualStockPct: 60,
  actualCashPct: 40,
  recommendedStockPct: 60,
  recommendedCashPct: 40,
  sectors: [
    { sector: "반도체", weightPct: 20 },
    { sector: "금융", weightPct: 18 },
  ],
  themes: [
    { theme: "AI", weightPct: 22 },
    { theme: "배당", weightPct: 20 },
  ],
  marketContext: { ready: true, strategyLabel: "균형", panicLabel: "중립" },
})

assert.ok(perfect.total >= 85)
assert.equal(perfect.grade, "A")

console.log("yds-portfolio-fit.test.mjs OK")
