/**
 * YDS V1.6.1 data reliability — node scripts/yds-data-reliability.test.mjs
 */
import {
  validatePanicHistoryPayload,
  diagnoseZeroHistoryRows,
  resolveDataSourceBadge,
  buildCycleDataReliability,
} from "../vite-project/src/utils/ydsDataReliability.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const valid = validatePanicHistoryPayload({
  ok: true,
  rows: [{ date: "2026-06-01", vix: 18 }],
  cycleRows: [],
})
assert(valid.ok && valid.rows.length === 1, "valid payload")

const empty = validatePanicHistoryPayload({ ok: true, rows: [], warning: "fetch_failed" })
assert(empty.invalidReason === "api_warning_empty", `empty invalid ${empty.invalidReason}`)
assert(empty.schemaIssues.includes("empty_rows"), "empty_rows issue")

const badDate = validatePanicHistoryPayload({
  ok: true,
  rows: [{ date: "invalid", vix: 1 }, { date: "2026-06-02", vix: 2 }],
})
assert(badDate.rows.length === 1, "drops bad dates")

const diag = diagnoseZeroHistoryRows({
  dbRows: 10,
  apiRows: 0,
  hubRows: 0,
  mappedCycleRows: 0,
  localCycleRows: 5,
  invalidReason: "empty_rows",
})
assert(diag.causes.includes("api_returned_zero_rows"), "api zero")
assert(diag.causes.includes("will_use_localStorage_fallback"), "ls fallback hint")

const live = resolveDataSourceBadge({
  source: "supabase-index-history",
  realtime: true,
  clientRows: 50,
})
assert(live.key === "live" && live.emoji === "🟢", live.label)

const cached = resolveDataSourceBadge({
  source: "static-json",
  realtime: false,
  clientRows: 30,
})
assert(cached.key === "cached" && cached.emoji === "🟡", cached.label)

const fallback = resolveDataSourceBadge({
  source: "localStorage",
  fallbackUsed: true,
  clientRows: 10,
})
assert(fallback.key === "local-fallback" && fallback.emoji === "🔴", fallback.label)

const reliability = buildCycleDataReliability(
  { dbRows: 100, apiRows: 100, clientRows: 100 },
  { source: "supabase-index-history", realtime: true },
)
assert(reliability.badge === "live", reliability.badge)

console.log("yds-data-reliability.test.mjs OK")
