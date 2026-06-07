/**
 * Overheat allocation smoke test — node scripts/yds-overheat-allocation.test.mjs
 */
import { resolveTodayActions } from "../vite-project/src/content/ydsActionGuide.js"
import {
  resolveEffectiveMarketAllocation,
  resolveOverheatAllocationTier,
} from "../vite-project/src/content/ydsOverheatAllocation.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const entry = resolveOverheatAllocationTier(61, 5.8)
assert(entry?.id === "entry", entry?.id)
assert(entry?.cashPct === 50, entry?.cashPct)

const boundary = resolveOverheatAllocationTier(72, 7.2)
assert(boundary?.id === "boundary", boundary?.id)
assert(boundary?.cashPct === 60, boundary?.cashPct)

const extreme = resolveOverheatAllocationTier(82, 8.1)
assert(extreme?.id === "extreme", extreme?.id)
assert(extreme?.cashPct === 75, extreme?.cashPct)

const neutralPanic = { fearGreed: 50, bofa: 5.5, vix: 18, putCall: 0.9, highYield: 4.5 }
const neutralAlloc = resolveEffectiveMarketAllocation(neutralPanic)
assert(neutralAlloc?.cashPct === 40, `neutral cash ${neutralAlloc?.cashPct}`)

const overheatPanic = { fearGreed: 65, bofa: 6.2, vix: 14, putCall: 0.8, highYield: 4.2 }
const overheatAlloc = resolveEffectiveMarketAllocation(overheatPanic)
assert(overheatAlloc?.mode === "overheat", overheatAlloc?.mode)
assert(overheatAlloc?.cashPct === 50, overheatAlloc?.cashPct)

const actions = resolveTodayActions(38, null, overheatPanic)
assert(actions?.actions[0] === "일부 익절", actions?.actions[0])
assert(actions?.actions[2]?.includes("50%"), actions?.actions[2])

console.log("OK overheat allocation", {
  entry: entry.displayRatio,
  boundary: boundary.displayRatio,
  extreme: extreme.displayRatio,
})
