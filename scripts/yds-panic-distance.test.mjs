/**
 * Panic Distance smoke test — node scripts/yds-panic-distance.test.mjs
 */
import { resolvePanicDistance, PANIC_DISTANCE_TIERS } from "../vite-project/src/content/ydsPanicDistance.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

assert(PANIC_DISTANCE_TIERS[0].threshold === 40, "interest threshold")
assert(PANIC_DISTANCE_TIERS[1].threshold === 60, "dca threshold")
assert(PANIC_DISTANCE_TIERS[2].threshold === 80, "life threshold")

const s38 = resolvePanicDistance(38)
assert(s38?.distanceToInterest === 2, `interest ${s38?.distanceToInterest}`)
assert(s38?.distanceToAccumulation === 22, `dca ${s38?.distanceToAccumulation}`)
assert(s38?.distanceToLifeOpportunity === 42, `life ${s38?.distanceToLifeOpportunity}`)
assert(s38.lines[0].text === "관심까지 +2", s38.lines[0].text)
assert(s38.lines[1].text === "분할매수까지 +22", s38.lines[1].text)
assert(s38.lines[2].text === "인생타점까지 +42", s38.lines[2].text)

const s62 = resolvePanicDistance(62)
assert(s62.lines[0].entered && s62.lines[0].text === "관심 진입", s62.lines[0].text)
assert(s62.lines[1].entered && s62.lines[1].text === "분할매수 진입", s62.lines[1].text)
assert(s62.lines[2].distance === 18 && s62.lines[2].text === "인생타점까지 +18", s62.lines[2].text)

const s85 = resolvePanicDistance(85)
assert(s85.lines.every((l) => l.entered), "all entered at 85")
assert(s85.lines[2].text === "인생타점 진입", s85.lines[2].text)

console.log("OK panic distance", {
  s38: s38.lines.map((l) => l.text),
  s62: s62.lines.map((l) => l.text),
  s85: s85.lines.map((l) => l.text),
})
