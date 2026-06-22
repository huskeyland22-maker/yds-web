import assert from "node:assert/strict"
import {
  computeMaxZoneHeights,
  SPICK_DUAL_ALIGN_ZONES,
} from "../vite-project/src/content/ydsStockPickDualColumnAlign.js"

const max = computeMaxZoneHeights(
  [
    { country: "US", summary: 120, hero: 640, why: 900 },
    { country: "KR", summary: 96, hero: 710, why: 880 },
  ],
  SPICK_DUAL_ALIGN_ZONES,
)

assert.equal(max.summary, 120)
assert.equal(max.hero, 710)
assert.equal(max.why, 900)

console.log("yds-stock-pick-dual-column-align.test.mjs OK")
