/**
 * Market Timeline smoke test — node scripts/yds-market-timeline.test.mjs
 */
import {
  formatTimelineDateLabel,
  formatTurningPointMetrics,
  mergeTimelineEventHistory,
  resolveMarketTimeline,
  resolveOverheatTransitionCopy,
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

const cashPrep = scanned.find((e) => e.type === "overheat-cashPrep" || e.type === "overheat-partialCash")
assert(cashPrep != null, `expected overheat entry got ${scanned.map((e) => e.type).join(",")}`)
assert(cashPrep.title === "과열권 진입" || cashPrep.title === "과열권 강화", cashPrep.title)
assert(cashPrep.metrics.includes("CNN"), cashPrep.metrics)
assert(cashPrep.action.length > 0, "action required")

const exit = scanned.find((e) => e.type === "overheat-normal" || e.type === "cnn-exit")
assert(exit?.title === "과열권 이탈", exit?.title)
assert(exit?.action === "추격매수 금지" || exit?.action === "과열 해소 시작", exit?.action)

const momentumTypes = scanned.filter((e) => e.type === "momentum-cnn-sharp")
const momentumByDate = new Set(momentumTypes.map((e) => e.date))
assert(momentumTypes.length === momentumByDate.size, "momentum should not repeat same day")

const view = resolveMarketTimeline(series.slice(0, -1), series[series.length - 1], { limit: 8 })
assert(view.displayEvents.length >= 3, `display ${view.displayEvents.length}`)
assert(formatTimelineDateLabel("2026-06-07") === "06/07")

const merged = mergeTimelineEventHistory(
  [{ date: "2026-01-01", type: "cnn-entry", severity: "low", title: "test", metrics: "", action: "d", description: "d" }],
  scanned,
)
assert(merged.length >= scanned.length)

const doc = normalizeEventHistoryEvents({
  version: 1,
  events: [{
    date: "2026-06-07",
    type: "cnn-exit",
    severity: "medium",
    title: "과열권 이탈",
    metrics: "CNN 42",
    action: "추격매수 금지",
    description: "추격매수 금지",
  }],
})
assert(doc[0]?.type === "cnn-exit")
assert(doc[0]?.metrics === "CNN 42")
assert(doc[0]?.action === "추격매수 금지")
assert(timelineEventEmoji("cnn-exit") === "🟠")

const prepCopy = resolveOverheatTransitionCopy("normal", "cashPrep")
assert(prepCopy?.title === "과열권 진입", prepCopy?.title)
assert(prepCopy?.action === "현금 준비 시작", prepCopy?.action)

const metrics = formatTurningPointMetrics({ fearGreed: 61, bofa: 6.4 })
assert(metrics === "CNN 61 · BofA 6.4", metrics)

console.log("OK market timeline", {
  count: scanned.length,
  sample: view.displayEvents.slice(0, 3).map((e) => `${formatTimelineDateLabel(e.date)} ${e.title} · ${e.action}`),
})
