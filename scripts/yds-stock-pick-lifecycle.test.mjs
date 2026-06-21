import assert from "node:assert/strict"
import { resolveStockLifecycle, LIFECYCLE_VIEWS } from "../vite-project/src/content/ydsStockPickLifecycle.js"

const excluded = resolveStockLifecycle({
  dataSource: "live",
  ticker: "X",
  v4Score: { top5Eligible: false },
})
assert.equal(excluded.id, "excluded")

const early = resolveStockLifecycle({
  dataSource: "live",
  ticker: "LS",
  v4Score: { top5Eligible: true, recommendStatusId: "buy" },
  pickMeta: { positionState: { id: "earlyRise" } },
})
assert.equal(early.label, "상승초기")
assert.equal(early.hint, "진입 가능")

const rising = resolveStockLifecycle({
  dataSource: "live",
  ticker: "SK",
  v4Score: { top5Eligible: true, recommendStatusId: "buy" },
  pickMeta: { positionState: { id: "rising" } },
})
assert.equal(rising.label, "상승진행")

const overheat = resolveStockLifecycle({
  dataSource: "live",
  ticker: "T",
  v4Score: { top5Eligible: true, recommendStatusId: "noChase" },
  pickMeta: { positionState: { id: "overheat" } },
})
assert.equal(overheat.label, "과열")

assert.ok(LIFECYCLE_VIEWS.weakening.hint === "관찰")

console.log("yds-stock-pick-lifecycle.test.mjs OK")
