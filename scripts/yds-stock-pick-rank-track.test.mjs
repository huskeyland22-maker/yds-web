import assert from "node:assert/strict"
import { computeRankTrack } from "../vite-project/src/content/ydsStockPickRankTrack.js"

function daysBefore(dateStr, daysAgo) {
  const d = new Date(`${dateStr}T12:00:00`)
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

const today = new Date().toISOString().slice(0, 10)
const yesterday = daysBefore(today, 1)

const history = {
  NVDA: [{ date: yesterday, rank: 8, total: 70 }],
}

const up = computeRankTrack({ ticker: "NVDA", rank: 3, dataSource: "live" }, history)
assert.equal(up?.currentRank, 3)
assert.equal(up?.delta, 5)
assert.equal(up?.deltaDisplay, "▲ +5")
assert.equal(up?.badge.label, "급상승")

const downHistory = {
  SK: [{ date: yesterday, rank: 5, total: 72 }],
}
const down = computeRankTrack({ ticker: "SK", rank: 8, dataSource: "live" }, downHistory)
assert.equal(down?.delta, -3)
assert.equal(down?.deltaDisplay, "▼ -3")
assert.equal(down?.badge.label, "하락중")

console.log("yds-stock-pick-rank-track.test.mjs OK")
