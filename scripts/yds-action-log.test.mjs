/**
 * Phase 4-1~4-3 action log — node scripts/yds-action-log.test.mjs
 */
import { buildActionLogEntry } from "../vite-project/src/content/ydsActionLogEngine.js"
import { computeCompliance, computePeriodCompliance } from "../vite-project/src/content/ydsComplianceEngine.js"
import { computeReturnPct, computeReturnStats } from "../vite-project/src/content/ydsReturnEngine.js"
import { resolveMarketAdapterContext } from "../vite-project/src/content/ydsMarketAdapter.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const ctx = resolveMarketAdapterContext(
  { fearGreed: 58, bofa: 6.5, vix: 15, putCall: 0.8 },
  [],
)

const entry = buildActionLogEntry(ctx, {
  usPct: 40,
  krPct: 40,
  cashPct: 20,
  memo: "엔비디아 일부 익절",
  startAsset: 100_000_000,
  endAsset: 103_000_000,
})

assert(entry.recommended.usPct > 0, "recommended us")
assert(entry.actual.usPct === 40, "actual us")
assert(entry.gapPct >= 30, `gap ${entry.gapPct}`)
assert(entry.compliancePct <= 70, "low compliance for big gap")
assert(entry.returnPct === 3, `return ${entry.returnPct}`)
assert(entry.ydsState.strategyLabel.length > 0, "yds snapshot")
assert(entry.memo.includes("엔비디아"), "memo")

const good = computeCompliance(
  { usPct: 25, krPct: 15, cashPct: 60 },
  { usPct: 30, krPct: 10, cashPct: 60 },
)
assert(good.compliancePct >= 90, `good compliance ${good.compliancePct}`)
assert(good.usCompliance === 95, "us partial")

const period = computePeriodCompliance([entry], "all")
assert(period.overallCompliance != null, "period compliance")

const returns = computeReturnStats([entry], "all")
assert(returns.avgReturnPct === 3, "avg return")

console.log("OK action log", {
  gap: entry.gapPct,
  compliance: entry.compliancePct,
  goodCompliance: good.compliancePct,
  returnPct: entry.returnPct,
})
