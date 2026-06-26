import assert from "node:assert/strict"
import {
  addCalendarDaysLocal,
  formatCalendarMonthDay,
  localCalendarDateKey,
} from "../vite-project/src/utils/calendarDateUtils.js"
import { buildWeekEventStrip } from "../vite-project/src/content/ydsInvestmentCalendarEngine.js"

assert.equal(formatCalendarMonthDay("2026-06-25"), "06/25")
assert.equal(addCalendarDaysLocal("2026-06-25", 1), "2026-06-26")
assert.equal(addCalendarDaysLocal("2026-06-25", 0), "2026-06-25")

const localRef = new Date(2026, 5, 25, 9, 0, 0)
assert.equal(localCalendarDateKey(localRef), "2026-06-25")

const strip = buildWeekEventStrip(null, 20, new Date("2026-06-22T12:00:00"))
const pce = strip.stripItems.find((e) => e.briefLabel === "PCE")
const corePce = strip.stripItems.find((e) => e.briefLabel === "Core PCE")
const gdp = strip.stripItems.find((e) => e.briefLabel === "GDP")

assert.ok(pce, "PCE event missing")
assert.ok(corePce, "Core PCE event missing")
assert.ok(gdp, "GDP event missing")
assert.equal(pce.date, "2026-06-25")
assert.equal(corePce.date, "2026-06-25")
assert.equal(gdp.date, "2026-06-25")
assert.equal(formatCalendarMonthDay(pce.date), "06/25")

console.log("yds-calendar-date.test.mjs OK")
