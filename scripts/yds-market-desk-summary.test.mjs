import assert from "node:assert/strict"
import { buildMarketDeskSummary } from "../vite-project/src/content/ydsMarketDeskSummary.js"
import {
  buildMarketCycleProgressReport,
  resolveCycleProgressIndex,
} from "../vite-project/src/content/ydsMarketCycleProgress.js"
import { buildMarketCycleFlowReport } from "../vite-project/src/content/ydsMarketCycleFlow.js"
import { buildDualLiquidityReport } from "../vite-project/src/market-os/liquidityDualEngine.js"
import { buildMacroRiskSnapshot } from "../vite-project/src/macro-risk/engine.js"

assert.equal(resolveCycleProgressIndex("조정회복"), 2)
assert.equal(resolveCycleProgressIndex("조정진입"), 0)
assert.equal(resolveCycleProgressIndex("상승확산"), 4)

const rows = [
  { date: "2026-05-28", fearGreed: 46, vix: 18, bofa: 5.2 },
  { date: "2026-05-29", fearGreed: 45, vix: 18, bofa: 5.1 },
  { date: "2026-06-02", fearGreed: 44, vix: 18, bofa: 5.0 },
  { date: "2026-06-03", fearGreed: 43, vix: 17, bofa: 4.9 },
]
const flow = buildMarketCycleFlowReport(rows, 30)
const progress = buildMarketCycleProgressReport(flow)
assert.equal(progress.visible, true)
assert.equal(progress.track.length, 5)
assert.ok(progress.track.some((s) => s.isCurrent))
assert.equal(progress.track.filter((s) => s.isCurrent).length, 1)

const panicData = { fearGreed: 44, vix: 18, bofa: 5.0, putCall: 0.87, highYield: 3.2 }
const snapshot = buildMacroRiskSnapshot({}, panicData)
const dual = buildDualLiquidityReport(snapshot, panicData)
const summary = buildMarketDeskSummary(panicData, dual, flow)
assert.ok(summary)
assert.ok(summary.lines[0].includes("패닉"))
assert.ok(summary.lines.some((l) => /자금 흐름 양호|유동성/.test(l)))
assert.ok(summary.lines.some((l) => /분할진입|관찰|조정/.test(l)))
assert.ok(!summary.lines.some((l) => /시장 상태 = 전략/.test(l)))

console.log("yds-market-desk-summary.test.mjs OK")
