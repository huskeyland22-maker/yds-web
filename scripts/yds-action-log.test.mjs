/**
 * Phase 4-1~4-3 action log — node scripts/yds-action-log.test.mjs
 */
import {
  buildActionLogEntry,
  deriveActualFromPortfolioHoldings,
  resolveActionLogAllocation,
} from "../vite-project/src/content/ydsActionLogEngine.js"
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
  useExplicitAllocation: true,
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

const quick = buildActionLogEntry(ctx, {
  quickAction: "watch",
  ticker: "NVDA",
  memo: "관망 유지",
  holdings: { stockPct: 70, cashPct: 30 },
})
assert(quick.quickAction === "watch", "quick action")
assert(quick.ticker === "NVDA", "ticker")
assert(quick.actual.usPct === quick.recommended.usPct, "watch uses recommended")
assert(quick.compliancePct === 100, `watch compliance ${quick.compliancePct}`)

const derived = deriveActualFromPortfolioHoldings(
  { usPct: 40, krPct: 20, cashPct: 40, stockPct: 60, note: "" },
  { stockPct: 80, cashPct: 20 },
)
assert(derived.usPct + derived.krPct === 80, "derived stock total")
assert(derived.cashPct === 20, "derived cash")

const buyAlloc = resolveActionLogAllocation(
  { quickAction: "buy", holdings: { stockPct: 80, cashPct: 20 } },
  { usPct: 50, krPct: 10, cashPct: 40, stockPct: 60, note: "" },
)
assert(buyAlloc.cashPct === 20, "buy uses holdings cash")

console.log("OK action log", {
  gap: entry.gapPct,
  compliance: entry.compliancePct,
  goodCompliance: good.compliancePct,
  returnPct: entry.returnPct,
})
