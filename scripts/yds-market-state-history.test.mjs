import assert from "node:assert/strict"
import {
  buildMarketStateHistoryReport,
  DASHBOARD_MARKET_STATE_LABELS,
} from "../vite-project/src/content/ydsMarketStateHistory.js"

assert.equal(DASHBOARD_MARKET_STATE_LABELS.fear, "공포")
assert.equal(DASHBOARD_MARKET_STATE_LABELS.boundary, "방어")
assert.equal(DASHBOARD_MARKET_STATE_LABELS.adjustment, "기대")
assert.equal(DASHBOARD_MARKET_STATE_LABELS.overheat, "탐욕")

const rows = [
  { date: "2026-06-05", fearGreed: 28, vix: 28, bofa: 3.2 },
  { date: "2026-06-06", fearGreed: 27, vix: 27, bofa: 3.1 },
  { date: "2026-06-09", fearGreed: 42, vix: 22, bofa: 4.8 },
  { date: "2026-06-10", fearGreed: 41, vix: 21, bofa: 4.9 },
  { date: "2026-06-11", fearGreed: 40, vix: 21, bofa: 5.0 },
  { date: "2026-06-12", fearGreed: 52, vix: 18, bofa: 5.5 },
  { date: "2026-06-16", fearGreed: 54, vix: 17, bofa: 5.6 },
  { date: "2026-06-17", fearGreed: 55, vix: 17, bofa: 5.7 },
  { date: "2026-06-18", fearGreed: 56, vix: 16, bofa: 5.8 },
]

const report = buildMarketStateHistoryReport(rows, 14)
assert.equal(report.visible, true)
assert.equal(report.entries.length, rows.length)
assert.ok(report.summaryLine.includes("→"))
assert.ok(report.summarySub.length > 0)

const empty = buildMarketStateHistoryReport([])
assert.equal(empty.visible, false)

console.log("yds-market-state-history.test.mjs OK")
