import assert from "node:assert/strict"
import {
  buildDualLiquidityReport,
  buildLiquiditySynthesis,
  resolveLiquidityActionMode,
  resolveLiquidityBand,
} from "../vite-project/src/market-os/liquidityDualEngine.js"
import { buildPolicyLiquidityLane } from "../vite-project/src/market-os/policyLiquidityEngine.js"
import { buildMacroRiskSnapshot } from "../vite-project/src/macro-risk/engine.js"
import { buildDashboardActionGuideReport } from "../vite-project/src/content/ydsDashboardActionGuide.js"

assert.deepEqual(resolveLiquidityBand(74, "market"), {
  id: "favorable",
  label: "우호",
  tone: "favorable",
})
assert.deepEqual(resolveLiquidityBand(48, "policy"), {
  id: "neutral",
  label: "중립~긴축",
  tone: "neutral",
})

assert.equal(resolveLiquidityActionMode(74, 48), "short_term")
assert.equal(resolveLiquidityActionMode(48, 74), "medium_long")
assert.equal(resolveLiquidityActionMode(30, 28), "defense")
assert.equal(resolveLiquidityActionMode(72, 68), "aggressive")

const shortSynth = buildLiquiditySynthesis(74, 45)
assert.equal(shortSynth.headline, "시장 유동성 > 정책 유동성")
assert.ok(shortSynth.lines.some((l) => /자금 흐름이 강한/.test(l)))
assert.ok(shortSynth.leadSentence.includes("단기"))

const longSynth = buildLiquiditySynthesis(35, 70)
assert.equal(longSynth.headline, "정책 유동성 > 시장 유동성")
assert.ok(longSynth.lines.some((l) => /정책 완화/.test(l)))

const aggSynth = buildLiquiditySynthesis(72, 68)
assert.ok(aggSynth.lines.some((l) => /공격적/.test(l)))

const defSynth = buildLiquiditySynthesis(30, 28)
assert.ok(defSynth.lines.some((l) => /방어/.test(l)))

const policyOnly = buildPolicyLiquidityLane(buildMacroRiskSnapshot({}, { vix: 16 }))
assert.ok(policyOnly.score != null && policyOnly.score < 55)
assert.equal(policyOnly.contributions.length, 3)
assert.ok(policyOnly.environment.some((f) => f.detail && /→/.test(f.detail)))

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
assert.ok(report.market.environment.length >= 4)
assert.ok(report.policy.environment.length >= 3)
assert.ok(report.market.marketImpacts.length >= 3)
assert.ok(report.policy.marketImpacts.length >= 3)
assert.ok(report.market.investmentLines.length >= 1)
assert.ok(report.policy.investmentLines.length >= 1)
assert.ok(report.market.laneActions.length >= 3)
assert.ok(report.policy.laneActions.length >= 3)
assert.equal(report.market.contributions.length, 5)
assert.equal(report.policy.contributions.length, 3)
assert.equal(
  report.market.contributions.reduce((sum, row) => sum + row.contribution, 0),
  report.market.score,
)
assert.equal(
  report.policy.contributions.reduce((sum, row) => sum + row.contribution, 0),
  report.policy.score,
)
assert.ok(report.market.contributions.every((row) => row.tooltip && row.label))
assert.ok(report.policy.environment.some((f) => /CPI.*상승/.test(f.label)))
assert.ok(!report.policy.environment.some((f) => /물가 둔화/.test(f.label)))
assert.ok(report.policy.scoreExplain?.includes("정책 환경"))
assert.ok(report.synthesis?.headline)
assert.ok(report.synthesis.lines.length >= 2)
assert.ok(report.synthesis.leadSentence)

const panicData = { fearGreed: 62, vix: 16, bofa: 6.2, putCall: 0.72, highYield: 3.6, move: 92, dxy: 104 }
const guide = buildDashboardActionGuideReport(panicData, [{ date: "2026-06-21", fearGreed: 70, vix: 15, bofa: 6.5 }], report)
assert.equal(guide.visible, true)
assert.equal(guide.liquidityLead, report.synthesis.leadSentence)
assert.ok(guide.recommendedActions.some((l) => /단기|중장기|방어|공격/.test(l)))

console.log("yds-liquidity-dual.test.mjs OK")
