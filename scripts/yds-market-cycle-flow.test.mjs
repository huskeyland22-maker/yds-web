import assert from "node:assert/strict"
import {
  buildMarketCycleFlowReport,
  cycleCompositeLabel,
  MARKET_CYCLE_FLOW_DAYS,
} from "../vite-project/src/content/ydsMarketCycleFlow.js"

assert.equal(MARKET_CYCLE_FLOW_DAYS, 30)
assert.equal(cycleCompositeLabel("boundary", "진입"), "경계진입")
assert.equal(cycleCompositeLabel("adjustment", "안정화"), "조정안정")
assert.equal(cycleCompositeLabel("adjustment", "회복중"), "조정회복")

const rows = [
  { date: "2026-05-20", fearGreed: 68, vix: 14, bofa: 7.2 },
  { date: "2026-05-21", fearGreed: 67, vix: 14, bofa: 7.1 },
  { date: "2026-05-22", fearGreed: 58, vix: 17, bofa: 6.2 },
  { date: "2026-05-23", fearGreed: 57, vix: 17, bofa: 6.1 },
  { date: "2026-05-26", fearGreed: 48, vix: 19, bofa: 5.4 },
  { date: "2026-05-27", fearGreed: 47, vix: 19, bofa: 5.3 },
  { date: "2026-05-28", fearGreed: 46, vix: 18, bofa: 5.2 },
  { date: "2026-05-29", fearGreed: 45, vix: 18, bofa: 5.1 },
  { date: "2026-06-02", fearGreed: 44, vix: 18, bofa: 5.0 },
  { date: "2026-06-03", fearGreed: 43, vix: 17, bofa: 4.9 },
]

const report = buildMarketCycleFlowReport(rows, 30)
assert.equal(report.visible, true)
assert.equal(report.windowDays, 30)
assert.ok(report.steps.length >= 2)
assert.ok(report.transitionCount >= 0)
assert.ok(report.currentCycleLabel.length > 0)
assert.ok(report.currentDurationDays >= 1)
assert.ok(report.longestHeldState.length > 0)
assert.ok(report.steps.every((s) => s.label))
assert.equal(report.steps[report.steps.length - 1].isCurrent, true)
assert.ok(report.steps.slice(1).every((s) => s.daysGap != null && s.daysGap >= 0))

const empty = buildMarketCycleFlowReport([])
assert.equal(empty.visible, false)

console.log("yds-market-cycle-flow.test.mjs OK")
