/**
 * Phase 4-4 compare + 5-1 ops — node scripts/yds-compare-ops.test.mjs
 */
import {
  buildCompareView,
  computeCompareFutureStats,
  MIN_COMPARE_SAMPLES,
} from "../vite-project/src/content/ydsCompareEngine.js"
import { buildOpsDashboard } from "../vite-project/src/content/ydsOpsDashboardEngine.js"
import { buildActionLogEntry } from "../vite-project/src/content/ydsActionLogEngine.js"
import { resolveMarketAdapterContext } from "../vite-project/src/content/ydsMarketAdapter.js"
import { computeRecommendedAssetAllocation } from "../vite-project/src/content/ydsPortfolioAllocationEngine.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const ctx = resolveMarketAdapterContext(
  { fearGreed: 58, bofa: 6.5, vix: 15, putCall: 0.8 },
  [],
)

/** @type {import("../vite-project/src/content/ydsActionLogStorage.js").YdsActionLogEntry[]} */
const entries = []
for (let i = 0; i < 5; i++) {
  entries.push(
    buildActionLogEntry(ctx, {
      usPct: 30 + i,
      krPct: 20,
      cashPct: 50 - i,
      memo: `log ${i}`,
      startAsset: 100_000_000,
      endAsset: 100_000_000 + (i % 2 === 0 ? 3_000_000 : 500_000),
    }),
  )
}

const viewFew = buildCompareView(entries)
assert(viewFew.statsReady === false, "not ready under 30")
assert(viewFew.returnEntryCount === 5, "5 returns")
assert(viewFew.futureStats === null, "no future stats")

const many = []
for (let i = 0; i < 35; i++) {
  many.push(
    buildActionLogEntry(ctx, {
      usPct: 25,
      krPct: 15,
      cashPct: 60,
      startAsset: 100,
      endAsset: i % 3 === 0 ? 112 : i % 3 === 1 ? 102 : 98,
    }),
  )
}
// tweak compliance on some
many[0].compliancePct = 92
many[1].compliancePct = 28

const viewMany = buildCompareView(many)
assert(viewMany.statsReady === true, "ready at 30+")
assert(viewMany.futureStats != null, "future stats")

const stats = computeCompareFutureStats(many)
assert(stats.highCompliance.count >= 1, "high bucket")

const rec = computeRecommendedAssetAllocation(ctx)
const ops = buildOpsDashboard(ctx, entries, rec)
assert(ops.recentLogs.length === 5, "recent 5")
assert(ops.market.strategyLabel.length > 0, "market")
assert(ops.compliance.d30.count >= 0, "compliance")
assert(ops.summary.strategyLabel.length > 0, "summary")

console.log("OK compare ops", {
  minSamples: MIN_COMPARE_SAMPLES,
  fewReady: viewFew.statsReady,
  manyReady: viewMany.statsReady,
  opsLogs: ops.recentLogs.length,
})
