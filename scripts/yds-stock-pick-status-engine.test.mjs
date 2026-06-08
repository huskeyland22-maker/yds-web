/**
 * Status engine — node scripts/yds-stock-pick-status-engine.test.mjs
 */
import { buildStockPriceSnapshot } from "../vite-project/src/content/stockPickSnapshotProfiles.js"
import { deriveStatusFromSnapshot } from "../vite-project/src/content/ydsStockPickStatusEngine.js"
import { getStockPickByTicker } from "../vite-project/src/content/ydsStockPickModel.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const nvdaSnap = buildStockPriceSnapshot("NVDA", "interest")
assert(deriveStatusFromSnapshot(nvdaSnap) === "trend", "nvda trend")

const smciSnap = buildStockPriceSnapshot("SMCI", "interest")
assert(deriveStatusFromSnapshot(smciSnap) === "overheat", "smci overheat")

const crashed = {
  ...nvdaSnap,
  close: 80,
  ma20: 95,
  ma60: 89,
}
assert(deriveStatusFromSnapshot(crashed) === "interest", "crash below ma60")

const dip = {
  ...nvdaSnap,
  close: 92,
  ma20: 98,
  ma60: 88,
  recentHigh: 105,
}
assert(deriveStatusFromSnapshot(dip) === "dip", "pullback dip")

const nvdaView = getStockPickByTicker("NVDA")
assert(nvdaView?.stockStatus.id === "trend", "nvda view trend")
assert(nvdaView?.stockAction.id === "hold", "nvda hold")

console.log("OK stock pick status engine", {
  nvda: nvdaView?.stockStatus.label,
  smci: getStockPickByTicker("SMCI")?.stockStatus.label,
})
