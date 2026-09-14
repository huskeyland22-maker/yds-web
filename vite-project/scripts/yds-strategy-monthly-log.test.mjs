#!/usr/bin/env node
/**
 * YDS 3.0 Strategy monthly investment log tests (Node + localStorage mock)
 */
import {
  STRATEGY_MONTHLY_LOG_KEY,
  cancelStrategyMonthlyInvestment,
  completeStrategyMonthlyInvestment,
  createEmptyStrategyMonthlyLog,
  getStrategyMonthlyEntry,
  listStrategyMonthlyEntries,
  loadStrategyMonthlyLog,
  normalizeStrategyMonthlyLog,
  saveStrategyMonthlyLog,
  updateStrategyMonthlyInvestment,
} from "../src/content/ydsStrategyMonthlyLog.js"
import {
  INVESTMENT_HOME_SETTINGS_KEY,
  defaultInvestmentHomeSettings,
  loadInvestmentHomeSettings,
  saveInvestmentHomeSettings,
} from "../src/content/ydsInvestmentHomeStorage.js"

/** @type {Map<string, string>} */
const mem = new Map()
globalThis.localStorage = {
  getItem: (k) => mem.get(k) ?? null,
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
}

let passed = 0
let failed = 0

function assert(name, condition) {
  if (condition) {
    passed += 1
    console.log(`OK ${name}`)
  } else {
    failed += 1
    console.log(`FAIL ${name}`)
  }
}

function reset(reserveAmount = 100_000) {
  mem.clear()
  const settings = defaultInvestmentHomeSettings()
  settings.strategyReserve.currentAmount = reserveAmount
  settings.crashReserve.currentAmount = 250_000
  settings.crashReserve.targetAmount = 1_000_000
  saveInvestmentHomeSettings(settings)
}

function completeInput(overrides = {}) {
  return {
    monthKey: "2026-09",
    completedAt: "2026-09-14",
    stage: 3,
    multiplier: 1.5,
    baseTotal: 300_000,
    targetTotal: 450_000,
    targetExtra: 150_000,
    actualExtra: 75_000,
    ...overrides,
  }
}

// 1. empty load
reset()
{
  const log = loadStrategyMonthlyLog()
  assert(
    "1 empty load",
    log.version === 1 && Array.isArray(log.entries) && log.entries.length === 0,
  )
}

// 2. save / load
reset()
{
  const saved = saveStrategyMonthlyLog({
    version: 1,
    entries: [
      {
        monthKey: "2026-01",
        status: "completed",
        completedAt: "2026-01-10",
        stage: 1,
        multiplier: 1,
        baseTotal: 300_000,
        targetTotal: 300_000,
        targetExtra: 0,
        actualExtra: 0,
        actualTotal: 300_000,
        reserveBefore: 50_000,
        reserveAfter: 50_000,
      },
    ],
  })
  const loaded = loadStrategyMonthlyLog()
  assert(
    "2 save/load",
    saved.entries.length === 1 &&
      loaded.entries[0]?.monthKey === "2026-01" &&
      loaded.entries[0]?.actualTotal === 300_000,
  )
}

// 3. bad JSON
reset()
{
  mem.set(STRATEGY_MONTHLY_LOG_KEY, "{not-json")
  const log = loadStrategyMonthlyLog()
  assert("3 bad JSON", log.entries.length === 0 && log.version === 1)
}

// 4. entries not array
reset()
{
  const log = normalizeStrategyMonthlyLog({ version: 1, entries: { a: 1 } })
  assert("4 entries not array", log.entries.length === 0)
}

// 5. bad monthKey
reset()
{
  const log = normalizeStrategyMonthlyLog({
    version: 1,
    entries: [
      {
        monthKey: "2026/09",
        completedAt: "x",
        stage: 1,
        multiplier: 1,
        baseTotal: 300_000,
        targetTotal: 300_000,
        targetExtra: 0,
        actualExtra: 0,
        actualTotal: 300_000,
        reserveBefore: 0,
        reserveAfter: 0,
      },
      {
        monthKey: "2026-13",
        completedAt: "x",
        stage: 1,
        multiplier: 1,
        baseTotal: 300_000,
        targetTotal: 300_000,
        targetExtra: 0,
        actualExtra: 0,
        actualTotal: 300_000,
        reserveBefore: 0,
        reserveAfter: 0,
      },
    ],
  })
  assert("5 bad monthKey dropped", log.entries.length === 0)
}

// 6. normal complete
reset(100_000)
{
  const result = completeStrategyMonthlyInvestment(completeInput())
  assert(
    "6 complete ok",
    result.ok === true &&
      result.entry.monthKey === "2026-09" &&
      result.entry.actualExtra === 75_000 &&
      result.entry.actualTotal === 375_000 &&
      result.entry.reserveBefore === 100_000 &&
      result.entry.reserveAfter === 25_000,
  )
}

// 7. duplicate complete blocked
{
  const again = completeStrategyMonthlyInvestment(completeInput({ actualExtra: 10_000 }))
  assert("7 duplicate blocked", again.ok === false && again.error === "already_completed")
}

// 8. reserve deducted
{
  const reserve = loadInvestmentHomeSettings().strategyReserve.currentAmount
  assert("8 reserve deducted", reserve === 25_000)
}

// 9. actualExtra > reserve blocked
reset(30_000)
{
  const result = completeStrategyMonthlyInvestment(
    completeInput({ monthKey: "2026-10", actualExtra: 50_000, targetExtra: 150_000 }),
  )
  assert(
    "9 extra > reserve blocked",
    result.ok === false && result.error === "actual_extra_exceeds_reserve",
  )
  assert(
    "9b reserve unchanged",
    loadInvestmentHomeSettings().strategyReserve.currentAmount === 30_000,
  )
}

// 10. actualExtra > targetExtra blocked
reset(500_000)
{
  const result = completeStrategyMonthlyInvestment(
    completeInput({ monthKey: "2026-11", actualExtra: 200_000, targetExtra: 150_000 }),
  )
  assert(
    "10 extra > target blocked",
    result.ok === false && result.error === "actual_extra_exceeds_target",
  )
}

// 11. actualTotal = base + extra
reset(100_000)
{
  const result = completeStrategyMonthlyInvestment(
    completeInput({
      monthKey: "2026-03",
      stage: 2,
      multiplier: 1.25,
      targetTotal: 375_000,
      targetExtra: 75_000,
      actualExtra: 75_000,
      actualTotal: 999_999,
    }),
  )
  assert(
    "11 actualTotal recomputed",
    result.ok === true && result.entry.actualTotal === 375_000,
  )
}

// 12. other months ok
{
  const result = completeStrategyMonthlyInvestment(
    completeInput({
      monthKey: "2026-04",
      stage: 1,
      multiplier: 1,
      targetTotal: 300_000,
      targetExtra: 0,
      actualExtra: 0,
    }),
  )
  assert("12 other month ok", result.ok === true && getStrategyMonthlyEntry("2026-03") != null)
}

// 13–14. update actualExtra + reserve restore/reapply
reset(100_000)
{
  completeStrategyMonthlyInvestment(completeInput({ monthKey: "2026-05", actualExtra: 75_000 }))
  const updated = updateStrategyMonthlyInvestment("2026-05", {
    actualExtra: 50_000,
    completedAt: "2026-05-20",
  })
  assert(
    "13 update ok",
    updated.ok === true &&
      updated.entry.actualExtra === 50_000 &&
      updated.entry.actualTotal === 350_000 &&
      updated.entry.completedAt === "2026-05-20" &&
      updated.entry.reserveBefore === 100_000 &&
      updated.entry.reserveAfter === 50_000,
  )
  assert(
    "14 update reserve restore/reapply",
    loadInvestmentHomeSettings().strategyReserve.currentAmount === 50_000,
  )
}

// 15–16. cancel + reserve restore
reset(100_000)
{
  completeStrategyMonthlyInvestment(completeInput({ monthKey: "2026-06", actualExtra: 75_000 }))
  const cancelled = cancelStrategyMonthlyInvestment("2026-06")
  assert(
    "15 cancel ok",
    cancelled.ok === true &&
      cancelled.entry.status === "cancelled" &&
      getStrategyMonthlyEntry("2026-06") == null,
  )
  assert(
    "16 cancel restores reserve",
    loadInvestmentHomeSettings().strategyReserve.currentAmount === 100_000,
  )
}

// 17. re-complete after cancel
{
  const again = completeStrategyMonthlyInvestment(
    completeInput({ monthKey: "2026-06", actualExtra: 40_000 }),
  )
  assert(
    "17 re-complete after cancel",
    again.ok === true &&
      again.entry.actualExtra === 40_000 &&
      loadInvestmentHomeSettings().strategyReserve.currentAmount === 60_000,
  )
  const all = listStrategyMonthlyEntries({ includeCancelled: true })
  assert(
    "17b cancelled history kept",
    all.filter((e) => e.monthKey === "2026-06").length === 2,
  )
}

// 18. Crash Reserve independent
{
  const crash = loadInvestmentHomeSettings().crashReserve
  assert(
    "18 crash reserve untouched",
    crash.currentAmount === 250_000 && crash.targetAmount === 1_000_000,
  )
}

// 19. Ledger / Track Record keys independent
{
  const ledgerKeys = [
    "yds-validation-picks-v2",
    "yds-recommend-ledger-v1",
    "yds-portfolio-cash-ledger-v1",
  ]
  for (const k of ledgerKeys) mem.set(k, JSON.stringify({ marker: "untouched", key: k }))
  completeStrategyMonthlyInvestment(
    completeInput({
      monthKey: "2026-07",
      actualExtra: 10_000,
      targetExtra: 150_000,
    }),
  )
  const untouched = ledgerKeys.every((k) => {
    try {
      return JSON.parse(mem.get(k) || "{}").marker === "untouched"
    } catch {
      return false
    }
  })
  assert("19 ledger/track/portfolio keys independent", untouched)
  assert(
    "19b monthly log key used",
    mem.has(STRATEGY_MONTHLY_LOG_KEY) && mem.has(INVESTMENT_HOME_SETTINGS_KEY),
  )
}

// 20. many months
reset(500_000)
{
  let ok = true
  for (let i = 0; i < 24; i += 1) {
    const year = 2024 + Math.floor(i / 12)
    const month = (i % 12) + 1
    const monthKey = `${year}-${String(month).padStart(2, "0")}`
    const result = completeStrategyMonthlyInvestment(
      completeInput({
        monthKey,
        stage: 1,
        multiplier: 1,
        targetTotal: 300_000,
        targetExtra: 0,
        actualExtra: 0,
        completedAt: `${monthKey}-15`,
      }),
    )
    if (!result.ok) ok = false
  }
  const completed = listStrategyMonthlyEntries()
  assert(
    "20 multi-month store/load",
    ok &&
      completed.length === 24 &&
      getStrategyMonthlyEntry("2025-12")?.monthKey === "2025-12" &&
      loadStrategyMonthlyLog().entries.length >= 24,
  )
}

// bonus: save dedupes duplicate completed monthKeys
{
  const deduped = saveStrategyMonthlyLog({
    version: 1,
    entries: [
      {
        monthKey: "2024-01",
        status: "completed",
        completedAt: "a",
        stage: 1,
        multiplier: 1,
        baseTotal: 300_000,
        targetTotal: 300_000,
        targetExtra: 0,
        actualExtra: 0,
        actualTotal: 300_000,
        reserveBefore: 0,
        reserveAfter: 0,
      },
      {
        monthKey: "2024-01",
        status: "completed",
        completedAt: "b",
        stage: 2,
        multiplier: 1.25,
        baseTotal: 300_000,
        targetTotal: 375_000,
        targetExtra: 75_000,
        actualExtra: 0,
        actualTotal: 300_000,
        reserveBefore: 0,
        reserveAfter: 0,
      },
    ],
  })
  assert(
    "bonus save dedupe completed monthKey",
    deduped.entries.filter((e) => e.monthKey === "2024-01" && e.status === "completed").length ===
      1 && deduped.entries[0]?.completedAt === "a",
  )
}

// empty factory
assert(
  "bonus empty factory",
  createEmptyStrategyMonthlyLog().entries.length === 0,
)

console.log(`\nMonthly log tests: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
