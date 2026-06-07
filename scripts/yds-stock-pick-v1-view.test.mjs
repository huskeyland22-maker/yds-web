/**
 * Stock pick V1 UI smoke test — node scripts/yds-stock-pick-v1-view.test.mjs
 */
import {
  resolveStockPickV1View,
  STOCK_PICK_V1_STATUS,
  STOCK_PICK_SECTOR_GROUPS,
} from "../vite-project/src/content/ydsStockPickV1View.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const view = resolveStockPickV1View()
assert(view != null, "view required")
assert(view.starGroups.length === 3, `star groups ${view.starGroups.length}`)
assert(view.sectorGroups.length === STOCK_PICK_SECTOR_GROUPS.length, "sectors")

const tier5 = view.starGroups.find((g) => g.tier === 5)
assert(tier5?.picks.length === 3, "tier5 count")
assert(tier5.picks.every((p) => p.stars === "★★★★★"), "tier5 stars")
assert(tier5.picks[0].status.label.length > 0, "status label")

assert(STOCK_PICK_V1_STATUS.trend.label === "추세", "short trend label")
assert(view.sectorGroups.some((s) => s.label === "전력"), "power sector")

console.log("OK stock pick v1 ui", {
  tiers: view.starGroups.map((g) => `${g.stars} ${g.picks.map((p) => p.name).join(", ")}`),
  sectors: view.sectorGroups.map((s) => `${s.label}(${s.picks.length})`),
})
