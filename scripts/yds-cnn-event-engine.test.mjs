/**
 * CNN Event Engine V2 — node scripts/yds-cnn-event-engine.test.mjs
 */
import {
  computeCnnDeltas,
  resolveActiveCnnEventSpec,
  resolveCnnTimelineEventType,
} from "../vite-project/src/content/ydsCnnEventEngine.js"
import { scanTimelineEventsFromSeries } from "../vite-project/src/content/ydsMarketTimeline.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const prodLike = [
  { date: "2026-05-26", fearGreed: 61, bofa: 6.6 },
  { date: "2026-05-29", fearGreed: 60, bofa: 6.6 },
  { date: "2026-06-02", fearGreed: 56, bofa: 6.6 },
  { date: "2026-06-04", fearGreed: 54, bofa: 6.6 },
  { date: "2026-06-05", fearGreed: 42, bofa: 6.6 },
  { date: "2026-06-09", fearGreed: 33, bofa: 6.6 },
]

const scanned = scanTimelineEventsFromSeries(prodLike)
const shock = scanned.find((e) => e.type === "momentum-cnn-day-shock")
assert(shock?.date === "2026-06-05", `expected 06/05 shock got ${shock?.date}`)
assert(shock?.title === "투자심리 급변", shock?.title)

const exit = scanned.find((e) => e.date === "2026-05-29" && e.title === "과열권 이탈")
assert(exit != null, "expected 05/29 overheat exit")

const idx5 = prodLike.findIndex((r) => r.date === "2026-06-05")
const { delta3d, delta1d } = computeCnnDeltas(prodLike[idx5], prodLike.slice(0, idx5))
assert(delta1d === -12, `1d delta ${delta1d}`)
assert(delta3d === -14, `3d delta ${delta3d}`)

const type = resolveCnnTimelineEventType(delta3d, delta1d, "none", "none")
assert(type === "momentum-cnn-day-shock", type)

const active = resolveActiveCnnEventSpec(-14, -12)
assert(active?.title === "투자심리 급변", active?.title)

const surgeType = resolveCnnTimelineEventType(16, null, "none", "none")
assert(surgeType === "momentum-cnn-surge", surgeType)

console.log("OK cnn event engine v2", {
  prodEvents: scanned.slice(0, 5).map((e) => `${e.date} ${e.title}`),
})
