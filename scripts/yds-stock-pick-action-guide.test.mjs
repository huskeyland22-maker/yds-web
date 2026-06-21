import assert from "node:assert/strict"
import {
  ACTION_GUIDE_LABELS,
  ACTION_GUIDE_MAX_ITEMS,
  buildActionGuide,
  serializeActionGuideForSnapshot,
} from "../vite-project/src/content/ydsStockPickActionGuide.js"

const base = {
  ticker: "NVDA",
  dataSource: "live",
  v4Score: {
    timingGrade: "A",
    recommendStatusId: "aggressiveBuy",
    top5Eligible: true,
  },
}

const entryGuide = buildActionGuide(base)
assert.equal(entryGuide.primaryId, "entry")
assert.ok(entryGuide.summary.includes(ACTION_GUIDE_LABELS.entry))

const timingB = buildActionGuide({
  ...base,
  v4Score: { timingGrade: "B", recommendStatusId: "buy", top5Eligible: true },
})
assert.equal(timingB.primaryId, "scaleIn")
assert.ok(timingB.summary.includes(ACTION_GUIDE_LABELS.scaleIn))

const timingC = buildActionGuide({
  ...base,
  v4Score: { timingGrade: "C", recommendStatusId: "watch", top5Eligible: true },
})
assert.equal(timingC.primaryId, "watch")
assert.ok(timingC.summary.includes(ACTION_GUIDE_LABELS.watch))

const noChase = buildActionGuide({
  ...base,
  v4Score: { timingGrade: "F", recommendStatusId: "noChase", top5Eligible: true },
})
assert.equal(noChase.primaryId, "noChase")
assert.ok(noChase.summary.includes(ACTION_GUIDE_LABELS.noChase))

const overheat = buildActionGuide({
  ...base,
  stockStatus: { id: "overheat" },
  timingScore: { checks: [{ id: "rsi", pass: false }] },
})
assert.ok(
  overheat.items.some((i) => i.id === "noChase") || overheat.primaryId === "noChase",
  "overheat should surface noChase guard",
)

const ineligible = buildActionGuide({
  ...base,
  v4Score: { timingGrade: "A", recommendStatusId: "buy", top5Eligible: false },
})
assert.equal(ineligible.primaryId, "watch")

assert.ok(entryGuide.items.length <= ACTION_GUIDE_MAX_ITEMS)

const snap = serializeActionGuideForSnapshot(entryGuide)
assert.equal(snap?.primaryId, "entry")
assert.equal(snap?.items.length, entryGuide.items.length)

console.log("yds-stock-pick-action-guide.test.mjs OK")
