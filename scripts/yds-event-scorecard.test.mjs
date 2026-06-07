/**
 * Event Scorecard smoke test — node scripts/yds-event-scorecard.test.mjs
 */
import {
  buildEventScorecard,
  isEventWin,
  normalizeSpyPriceSeries,
  resolveScorecardGrade,
} from "../vite-project/src/content/ydsEventScorecard.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

assert(isEventWin(2.5, "up") === true, "up win")
assert(isEventWin(-1, "down") === true, "down win")

const gradeA = resolveScorecardGrade(0.72, 10)
assert(gradeA.label === "A", gradeA.label)

const gradeBPlus = resolveScorecardGrade(0.67, 8)
assert(gradeBPlus.label === "B+", gradeBPlus.label)

const gradeD = resolveScorecardGrade(0.8, 2)
assert(gradeD.insufficient === true, "insufficient")

/** 14 거래일 forward return 계산에 충분한 연속 거래일 */
const prices = {}
let p = 100
for (let d = 20; d <= 30; d += 1) {
  prices[`2026-05-${String(d).padStart(2, "0")}`] = p
  p += 1
}
for (let d = 1; d <= 25; d += 1) {
  prices[`2026-06-${String(d).padStart(2, "0")}`] = p
  p += 1
}

const series = [
  { date: "2026-05-20", fearGreed: 52, bofa: 5.8 },
  { date: "2026-05-28", fearGreed: 72, bofa: 7.2 },
  { date: "2026-06-05", fearGreed: 74, bofa: 7.3 },
  { date: "2026-06-07", fearGreed: 42, bofa: 5.9 },
]

const { sortedDates } = normalizeSpyPriceSeries(prices)
assert(sortedDates.length >= 10, "price series")

const result = buildEventScorecard(series, series[series.length - 1], prices)
assert(result.rows.length >= 1, `rows ${result.rows.length}`)

const cnnEntry = result.byType["cnn-entry"]
if (cnnEntry && cnnEntry.eventCount > 0) {
  assert(cnnEntry.winRate != null, "winRate")
}

console.log("OK event scorecard", {
  types: result.rows.map((r) => `${r.title}:${r.eventCount}:${r.gradeLabel}`),
})
