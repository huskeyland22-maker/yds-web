import assert from "node:assert/strict"
import {
  buildPanicIntensityComparison,
  findNearestTradingDayRow,
  formatPanicCompareDelta,
  subtractCalendarDays,
} from "../vite-project/src/content/ydsPanicIntensityComparison.js"

const historyRows = [
  { date: "2026-06-10", vix: 18, fearGreed: 52, bofa: 5.2, putCall: 0.85, highYield: 4.1 },
  { date: "2026-06-13", vix: 19, fearGreed: 50, bofa: 5.1, putCall: 0.86, highYield: 4.1 },
  { date: "2026-06-16", vix: 20, fearGreed: 48, bofa: 5.0, putCall: 0.87, highYield: 4.2 },
  { date: "2026-06-19", vix: 21, fearGreed: 45, bofa: 4.9, putCall: 0.88, highYield: 4.2 },
  { date: "2026-06-20", vix: 22, fearGreed: 43, bofa: 4.8, putCall: 0.89, highYield: 4.3 },
]

const panicData = {
  vix: 24,
  fearGreed: 38,
  bofa: 4.5,
  putCall: 0.92,
  highYield: 4.4,
}

const report = buildPanicIntensityComparison(historyRows, panicData, "2026-06-22")
assert.equal(report.visible, true)
assert.equal(report.points.length, 3)
assert.equal(report.points[0].label, "오늘")
assert.equal(report.points[1].label, "3일전")
assert.equal(report.points[2].label, "5일전")
assert.ok(report.today != null)
assert.ok(report.days3Ago != null, "3-day score should resolve from fearGreed rows")
assert.ok(report.days5Ago != null, "5-day score should resolve from fearGreed rows")
assert.equal(report.delta3, report.today - report.days3Ago)
assert.equal(formatPanicCompareDelta(5), "(+5)")
assert.equal(formatPanicCompareDelta(-3), "(-3)")

const normalized = historyRows.map((r) => ({ date: r.date }))
const satRef = "2026-06-22"
const row5 = findNearestTradingDayRow(normalized, satRef, 5)
assert.equal(row5?.date, "2026-06-16")
assert.equal(subtractCalendarDays("2026-06-22", 5), "2026-06-17")

const legacyCnn = buildPanicIntensityComparison(
  [{ date: "2026-06-19", vix: 21, cnn: 45, bofa: 4.9, putCall: 0.88, highYield: 4.2 }],
  null,
  "2026-06-22",
)
assert.ok(legacyCnn.days3Ago != null, "cnn alias should work")

console.log("yds-panic-intensity-comparison.test.mjs OK", {
  today: report.today,
  d3: report.days3Ago,
  d5: report.days5Ago,
  delta3: report.delta3,
  delta5: report.delta5,
})
