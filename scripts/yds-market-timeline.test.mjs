/**
 * Market Timeline smoke test — node scripts/yds-market-timeline.test.mjs
 */
import {
  formatTimelineDateLabel,
  mergeTimelineEventHistory,
  resolveMarketTimeline,
  scanTimelineEventsFromSeries,
  timelineEventEmoji,
} from "../vite-project/src/content/ydsMarketTimeline.js"
import { normalizeEventHistoryEvents } from "../vite-project/src/content/ydsMarketEventHistoryStorage.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const series = [
  { date: "2026-04-09", vix: 22, putCall: 1.0, fearGreed: 40, bofa: 5.2, highYield: 4.5 },
  { date: "2026-05-20", fearGreed: 52, bofa: 5.8 },
  { date: "2026-05-28", fearGreed: 72, bofa: 7.2 },
  { date: "2026-06-05", fearGreed: 74, bofa: 7.3 },
  { date: "2026-06-07", fearGreed: 42, bofa: 5.9 },
]

const scanned = scanTimelineEventsFromSeries(series)
assert(scanned.length > 0, "expected timeline events")

const cnnEntry = scanned.find((e) => e.type === "cnn-entry")
assert(cnnEntry?.title === "CNN 과열권 진입", cnnEntry?.title)

const cashPrep = scanned.find((e) => e.type === "overheat-cashPrep" || e.type === "overheat-partialCash")
assert(cashPrep != null, `expected overheat entry got ${scanned.map((e) => e.type).join(",")}`)

const view = resolveMarketTimeline(series.slice(0, -1), series[series.length - 1], { limit: 8 })
assert(view.displayEvents.length >= 5, `display ${view.displayEvents.length}`)
assert(formatTimelineDateLabel("2026-06-07") === "06/07")

const merged = mergeTimelineEventHistory(
  [{ date: "2026-01-01", type: "cnn-entry", severity: "low", title: "test", description: "d" }],
  scanned,
)
assert(merged.length >= scanned.length)

const doc = normalizeEventHistoryEvents({
  version: 1,
  events: [{ date: "2026-06-07", type: "cnn-exit", severity: "medium", title: "CNN 과열권 이탈", description: "x" }],
})
assert(doc[0]?.type === "cnn-exit")
assert(timelineEventEmoji("cnn-exit") === "🟠")

console.log("OK market timeline", {
  count: scanned.length,
  sample: view.displayEvents.slice(0, 3).map((e) => `${formatTimelineDateLabel(e.date)} ${e.title}`),
})
