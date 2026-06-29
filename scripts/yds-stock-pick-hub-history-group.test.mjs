import assert from "node:assert/strict"
import {
  filterHubHistoryByPeriod,
  groupHubHistoryByTicker,
} from "../vite-project/src/content/ydsStockPickHubHistoryGroupEngine.js"

const rows = [
  { ticker: "AMD", name: "AMD", recommendedAt: "2026-06-29" },
  { ticker: "AMD", name: "AMD", recommendedAt: "2026-06-22" },
  { ticker: "AMD", name: "AMD", recommendedAt: "2026-06-11" },
  { ticker: "NVDA", name: "NVIDIA", recommendedAt: "2026-06-20" },
]

const todayOnly = filterHubHistoryByPeriod(rows, "today", "2026-06-29")
assert.equal(todayOnly.length, 1)
assert.equal(todayOnly[0].ticker, "AMD")

const week = filterHubHistoryByPeriod(rows, "week", "2026-06-29")
assert.equal(week.length, 1)

const month = filterHubHistoryByPeriod(rows, "month", "2026-06-29")
assert.equal(month.length, 4)

const groups = groupHubHistoryByTicker(rows)
assert.equal(groups.length, 2)
assert.equal(groups[0].ticker, "AMD")
assert.equal(groups[0].count, 3)
assert.equal(groups[0].rows[0].recommendedAt, "2026-06-29")
assert.equal(groups[0].rows[2].recommendedAt, "2026-06-11")

console.log("yds-stock-pick-hub-history-group.test.mjs OK")
