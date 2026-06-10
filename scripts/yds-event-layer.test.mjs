/**
 * Event Layer V1.5 smoke test — node scripts/yds-event-layer.test.mjs
 */
import { resolveEventLayer } from "../vite-project/src/content/ydsEventLayer.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const exitHistory = [
  { date: "2026-05-28", fearGreed: 72, bofa: 7.2 },
  { date: "2026-05-30", fearGreed: 68, bofa: 6.9 },
  { date: "2026-06-02", fearGreed: 55, bofa: 6.3 },
]
const exitPanic = { date: "2026-06-05", fearGreed: 42, bofa: 5.9 }

const exitView = resolveEventLayer(exitPanic, exitHistory)
assert(exitView.hasEvents, "expected exit events")
const cnnExit = exitView.events.find((e) => e.id === "cnn-exit")
assert(cnnExit?.emoji === "🟠" && cnnExit.title === "CNN 과열권 이탈", cnnExit?.title)
assert(cnnExit?.summary === "낙관 심리가 약화되고 있습니다.", cnnExit?.summary)
const bofaExit = exitView.events.find((e) => e.id === "bofa-exit")
assert(bofaExit?.title === "BofA 과열권 이탈", bofaExit?.title)

const cnnEntryHistory = [
  { date: "2026-05-28", fearGreed: 52, bofa: 5.8 },
  { date: "2026-06-01", fearGreed: 58, bofa: 6.0 },
]
const cnnEntryPanic = { date: "2026-06-05", fearGreed: 74, bofa: 6.2 }
const cnnEntryView = resolveEventLayer(cnnEntryPanic, cnnEntryHistory)
const cnnEntry = cnnEntryView.events.find((e) => e.id === "cnn-entry")
assert(cnnEntry?.emoji === "🟡" && cnnEntry.title === "CNN 과열권 진입", cnnEntry?.title)

const bofaEntryHistory = [
  { date: "2026-05-28", fearGreed: 50, bofa: 5.5 },
  { date: "2026-06-01", fearGreed: 55, bofa: 5.9 },
]
const bofaEntryPanic = { date: "2026-06-05", fearGreed: 58, bofa: 7.2 }
const bofaEntryView = resolveEventLayer(bofaEntryPanic, bofaEntryHistory)
const bofaEntry = bofaEntryView.events.find((e) => e.id === "bofa-entry")
assert(bofaEntry?.emoji === "🟡" && bofaEntry.title === "BofA 과열권 진입", bofaEntry?.title)

const momHistory = [
  { date: "2026-05-20", fearGreed: 55, bofa: 6.5 },
  { date: "2026-06-01", fearGreed: 58, bofa: 6.2 },
  { date: "2026-06-03", fearGreed: 50, bofa: 6.1 },
]
const momPanic = { date: "2026-06-05", fearGreed: 42, bofa: 5.0 }
const momView = resolveEventLayer(momPanic, momHistory)
const cnnMom = momView.events.find((e) => e.id === "momentum-cnn-sharp")
const bofaMom = momView.events.find((e) => e.id === "momentum-bofa-weak")
assert(cnnMom?.title === "투자심리 급락", cnnMom?.title)
assert(bofaMom?.title === "Bull & Bear 악화", bofaMom?.title)

console.log("OK event layer v1.5", {
  exit: exitView.events.map((e) => e.id),
  cnnEntry: cnnEntry?.id,
  bofaEntry: bofaEntry?.id,
  momentum: [cnnMom?.id, bofaMom?.id],
})
