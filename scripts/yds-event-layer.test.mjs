/**
 * Event Layer smoke test — node scripts/yds-event-layer.test.mjs
 */
import { resolveEventLayer } from "../vite-project/src/content/ydsEventLayer.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const history = [
  { date: "2026-05-28", fearGreed: 72, bofa: 6.8 },
  { date: "2026-05-30", fearGreed: 68, bofa: 6.7 },
  { date: "2026-06-02", fearGreed: 55, bofa: 6.3 },
]

const panic = { date: "2026-06-05", fearGreed: 42, bofa: 5.9 }

const view = resolveEventLayer(panic, history)

assert(view.hasEvents, "expected events")
const cnnEv = view.events.find((e) => e.metric === "cnn")
assert(cnnEv != null, "CNN exit event")
assert(cnnEv.level === "exit" || cnnEv.level === "strongExit", `level ${cnnEv.level}`)
assert(cnnEv.headline.includes("과열"), cnnEv.headline)

console.log("OK event layer", {
  level: view.level,
  headline: view.headline,
  events: view.events.map((e) => e.id),
})
