import assert from "node:assert/strict"
import { applyRecoveryConfirmationGate } from "../vite-project/src/content/ydsMarketCycleRecoveryGate.js"
import { buildMarketCycleFlowReport, finalizeMarketCycleFlow } from "../vite-project/src/content/ydsMarketCycleFlow.js"
import { buildMarketJudgmentRationale } from "../vite-project/src/content/ydsMarketJudgmentRationale.js"

const qqqPrices = {
  "2026-06-20": 100,
  "2026-06-23": 99,
  "2026-06-24": 100,
  "2026-06-25": 98,
  "2026-06-26": 96.5,
}

const spyPrices = {
  "2026-06-18": 100,
  "2026-06-19": 99.2,
  "2026-06-20": 97.8,
  "2026-06-23": 97,
  "2026-06-24": 96.8,
  "2026-06-25": 97,
  "2026-06-26": 97.1,
}

const gate = applyRecoveryConfirmationGate("조정회복", {
  qqqPrices,
  spyPrices,
  soxxPrices: {},
  asOfDate: "2026-06-26",
})

assert.equal(gate.applied, true)
assert.equal(gate.label, "조정안정")
assert.ok(gate.reason?.includes("NASDAQ"))

const rows = [
  { date: "2026-06-18", fearGreed: 44, vix: 18, bofa: 5.0 },
  { date: "2026-06-19", fearGreed: 44, vix: 18, bofa: 5.0 },
  { date: "2026-06-20", fearGreed: 43, vix: 19, bofa: 4.9 },
  { date: "2026-06-23", fearGreed: 43, vix: 19, bofa: 4.9 },
  { date: "2026-06-24", fearGreed: 42, vix: 20, bofa: 4.8 },
  { date: "2026-06-25", fearGreed: 42, vix: 20, bofa: 4.8 },
  { date: "2026-06-26", fearGreed: 42, vix: 20, bofa: 4.8 },
]

const base = buildMarketCycleFlowReport(rows, 30)
const flow = finalizeMarketCycleFlow(base, {
  qqqPrices,
  spyPrices,
  soxxPrices: {},
  asOfDate: "2026-06-26",
})

if (base.currentCycleLabel.includes("회복")) {
  assert.ok(flow.currentCycleLabel === "조정안정" || flow.currentCycleLabel.includes("경고"))
}

const judgment = buildMarketJudgmentRationale({
  panicData: { vix: 20, highYield: 4.2, fearGreed: 42, bofa: 4.8 },
  cycleFlow: flow,
  dualLiquidity: { marketScore: 62, policyScore: 38 },
  etfContext: { qqqPrices, spyPrices, asOfDate: "2026-06-26" },
})
assert.ok(judgment.visible)
assert.ok(judgment.factors.length >= 3)

console.log("yds-market-recovery-gate.test.mjs OK")
