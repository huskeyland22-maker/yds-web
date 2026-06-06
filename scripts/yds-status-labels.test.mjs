/**
 * Status labels smoke test — node scripts/yds-status-labels.test.mjs
 */
import { resolveCycleStatusLabel, resolvePanicStatusLabel } from "../vite-project/src/content/ydsStatusLabels.js"
import { resolveMomentumLayer } from "../vite-project/src/content/ydsMomentumLayer.js"
import { resolveMomentumStatusLabel } from "../vite-project/src/content/ydsStatusLabels.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const cycle68 = resolveCycleStatusLabel(32)
assert(cycle68?.score === 68 && cycle68.label === "중립 상단", `cycle68 ${cycle68?.label}`)

const panic38 = resolvePanicStatusLabel(38)
assert(panic38?.label === "공포 부족", panic38?.label)

const history = [
  { date: "2026-06-01", fearGreed: 58, bofa: 6.2 },
  { date: "2026-06-03", fearGreed: 50, bofa: 6.1 },
]
const mom = resolveMomentumLayer({ date: "2026-06-05", fearGreed: 42, bofa: 6.0 }, history)
const momStatus = resolveMomentumStatusLabel(mom)
assert(momStatus.label === "투자심리 급랭" || momStatus.label === "투자심리 둔화", momStatus.label)

console.log("OK status labels", {
  cycle: cycle68.label,
  panic: panic38.label,
  momentum: momStatus.label,
})
