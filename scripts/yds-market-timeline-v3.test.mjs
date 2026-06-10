/**
 * Market Timeline V3 — node scripts/yds-market-timeline-v3.test.mjs
 */
import { scanTimelineEventsFromSeries, formatTimelineStreamLead } from "../vite-project/src/content/ydsMarketTimeline.js"
import { resolveCnnTimelineEventType } from "../vite-project/src/content/ydsCnnEventEngine.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const prodLike = [
  { date: "2026-05-26", fearGreed: 61, bofa: 6.6 },
  { date: "2026-05-27", fearGreed: 61, bofa: 6.6 },
  { date: "2026-05-29", fearGreed: 60, bofa: 6.6 },
  { date: "2026-06-02", fearGreed: 56, bofa: 6.6 },
  { date: "2026-06-04", fearGreed: 54, bofa: 6.6 },
  { date: "2026-06-05", fearGreed: 42, bofa: 6.6 },
  { date: "2026-06-08", fearGreed: 42.1, bofa: 6.6 },
  { date: "2026-06-09", fearGreed: 33, bofa: 6.6 },
]

const events = scanTimelineEventsFromSeries(prodLike)
const byDate = Object.fromEntries(events.map((e) => [e.date, e]))

assert(byDate["2026-06-05"]?.title === "투자심리 급변", byDate["2026-06-05"]?.title)
assert(formatTimelineStreamLead(byDate["2026-06-05"]) === "CNN 42")

assert(byDate["2026-06-09"]?.title === "투자심리 추가 악화", byDate["2026-06-09"]?.title)
assert(formatTimelineStreamLead(byDate["2026-06-09"]) === "CNN 33")

assert(byDate["2026-05-29"]?.title === "과열 해소" || byDate["2026-05-29"]?.title === "과열권 이탈")

const dates = events.map((e) => e.date)
assert(new Set(dates).size === dates.length, "one event per day")

assert(resolveCnnTimelineEventType(-9, -9) === "momentum-cnn-soft-fall")

console.log("OK timeline v3", events.slice(0, 6).map((e) => `${e.date} ${formatTimelineStreamLead(e)} ${e.title}`))
