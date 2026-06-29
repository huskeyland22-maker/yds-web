import assert from "node:assert/strict"
import { buildRecommendPerfBriefing } from "../vite-project/src/content/ydsRecommendPerfBriefingEngine.js"
import {
  filterHubHistoryByPeriod,
  groupHubHistoryByTicker,
  resolveHubHistoryStatusShort,
} from "../vite-project/src/content/ydsStockPickHubHistoryGroupEngine.js"

const briefing = buildRecommendPerfBriefing(
  {
    avgReturn: -3.5,
    alpha: -1.2,
    holdingCount: 14,
    successCount: 0,
    failureCount: 13,
  },
  30,
)
assert.ok(briefing.includes("30일"))
assert.ok(briefing.includes("-3.5%"))
assert.ok(briefing.includes("14개"))

assert.equal(resolveHubHistoryStatusShort("active"), "현재 보유")
assert.equal(resolveHubHistoryStatusShort("targetHit"), "성공")

const rows = [
  { ticker: "AMD", name: "AMD", recommendedAt: "2026-06-29", returnPct: 5, maxReturnPct: 18.2, lifecycleId: "active", statusTone: "active" },
  { ticker: "AMD", name: "AMD", recommendedAt: "2026-06-03", returnPct: 2, maxReturnPct: 10, lifecycleId: "active", statusTone: "active" },
]

const groups = groupHubHistoryByTicker(rows)
assert.equal(groups[0].count, 2)
assert.equal(groups[0].firstAtLabel, "06-03")
assert.equal(groups[0].latestAtLabel, "06-29")
assert.equal(groups[0].statusShort, "현재 보유")
assert.ok(groups[0].maxReturnLabel.includes("18"))

console.log("yds-recommend-perf-briefing.test.mjs OK")
