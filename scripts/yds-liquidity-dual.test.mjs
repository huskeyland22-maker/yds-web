import assert from "node:assert/strict"
import {
  buildDualLiquidityReport,
  resolveLiquidityActionMode,
  resolveLiquidityBand,
} from "../vite-project/src/market-os/liquidityDualEngine.js"
import { buildMacroRiskSnapshot } from "../vite-project/src/macro-risk/engine.js"
import { buildDashboardActionGuideReport } from "../vite-project/src/content/ydsDashboardActionGuide.js"

assert.deepEqual(resolveLiquidityBand(74, "market"), {
  id: "favorable",
  label: "우호",
  tone: "favorable",
})
assert.deepEqual(resolveLiquidityBand(48, "policy"), {
  id: "neutral",
  label: "중립",
  tone: "neutral",
})

assert.equal(resolveLiquidityActionMode(74, 48), "short_term")
assert.equal(resolveLiquidityActionMode(48, 74), "medium_long")
assert.equal(resolveLiquidityActionMode(30, 28), "defense")
assert.equal(resolveLiquidityActionMode(72, 68), "aggressive")

const snapshot = buildMacroRiskSnapshot({}, { vix: 16, highYield: 3.6, move: 92, dxy: 104 })
const report = buildDualLiquidityReport(snapshot, {
  vix: 16,
  highYield: 3.6,
  move: 92,
  dxy: 104,
  fearGreed: 62,
  bofa: 5.8,
  putCall: 0.78,
})

assert.equal(report.visible, true)
assert.ok(report.market.score != null && report.market.score >= 0 && report.market.score <= 100)
assert.ok(report.policy.score != null && report.policy.score >= 0 && report.policy.score <= 100)
assert.equal(report.market.title, "시장 유동성")
assert.equal(report.policy.title, "정책 유동성")
assert.ok(report.market.factors.length >= 4)
assert.ok(report.policy.factors.length >= 4)
assert.equal(report.market.contributions.length, 5)
assert.equal(report.policy.contributions.length, 5)
assert.equal(
  report.market.contributions.reduce((sum, row) => sum + row.contribution, 0),
  report.market.score,
)
assert.equal(
  report.policy.contributions.reduce((sum, row) => sum + row.contribution, 0),
  report.policy.score,
)
assert.ok(report.market.contributions.every((row) => row.tooltip && row.label))

const panicData = { fearGreed: 62, vix: 16, bofa: 6.2, putCall: 0.72, highYield: 3.6, move: 92, dxy: 104 }
const guide = buildDashboardActionGuideReport(panicData, [{ date: "2026-06-21", fearGreed: 70, vix: 15, bofa: 6.5 }], report)
assert.equal(guide.visible, true)
assert.ok(guide.recommendedActions.some((l) => /단기|중장기|방어|공격/.test(l)))

console.log("yds-liquidity-dual.test.mjs OK")
