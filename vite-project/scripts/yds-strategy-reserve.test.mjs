#!/usr/bin/env node
import {
  computeStrategyReservePlan,
  sanitizeStrategyKrw,
} from "../src/content/ydsStrategyReserveEngine.js"
import {
  defaultInvestmentHomeSettings,
  normalizeInvestmentHomeSettings,
  normalizeStrategyReserve,
} from "../src/content/ydsInvestmentHomeStorage.js"

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

function assertPlan(name, input, expected) {
  const plan = computeStrategyReservePlan(input)
  const ok = Object.keys(expected).every((key) => plan[key] === expected[key])
  if (!ok) {
    console.log("  got", plan)
    console.log("  expected", expected)
  }
  assert(name, ok)
}

assertPlan(
  "1단계 / Reserve 500000",
  { stage: 1, strategyReserve: 500_000 },
  {
    baseTotal: 300_000,
    multiplier: 1,
    targetTotal: 300_000,
    targetExtra: 0,
    strategyReserve: 500_000,
    actualExtra: 0,
    actualTotal: 300_000,
    reserveAfter: 500_000,
  },
)

assertPlan(
  "2단계 / Reserve 100000",
  { stage: 2, strategyReserve: 100_000 },
  {
    baseTotal: 300_000,
    multiplier: 1.25,
    targetTotal: 375_000,
    targetExtra: 75_000,
    strategyReserve: 100_000,
    actualExtra: 75_000,
    actualTotal: 375_000,
    reserveAfter: 25_000,
  },
)

assertPlan(
  "3단계 / Reserve 30000",
  { stage: 3, strategyReserve: 30_000 },
  {
    baseTotal: 300_000,
    multiplier: 1.5,
    targetTotal: 450_000,
    targetExtra: 150_000,
    strategyReserve: 30_000,
    actualExtra: 30_000,
    actualTotal: 330_000,
    reserveAfter: 0,
  },
)

assertPlan(
  "4단계 / Reserve 0",
  { stage: 4, strategyReserve: 0 },
  {
    baseTotal: 300_000,
    multiplier: 2,
    targetTotal: 600_000,
    targetExtra: 300_000,
    strategyReserve: 0,
    actualExtra: 0,
    actualTotal: 300_000,
    reserveAfter: 0,
  },
)

assertPlan(
  "4단계 / Reserve 500000",
  { stage: 4, strategyReserve: 500_000 },
  {
    baseTotal: 300_000,
    multiplier: 2,
    targetTotal: 600_000,
    targetExtra: 300_000,
    strategyReserve: 500_000,
    actualExtra: 300_000,
    actualTotal: 600_000,
    reserveAfter: 200_000,
  },
)

assertPlan(
  "Reserve 음수 → 0",
  { multiplier: 1.5, strategyReserve: -1000 },
  {
    strategyReserve: 0,
    actualExtra: 0,
    actualTotal: 300_000,
    reserveAfter: 0,
  },
)

assertPlan(
  "Reserve 문자열 '75000'",
  { multiplier: 1.25, strategyReserve: "75000" },
  {
    strategyReserve: 75_000,
    actualExtra: 75_000,
    actualTotal: 375_000,
    reserveAfter: 0,
  },
)

assertPlan(
  "Reserve NaN → 0",
  { multiplier: 2, strategyReserve: Number.NaN },
  { strategyReserve: 0, actualExtra: 0, actualTotal: 300_000, reserveAfter: 0 },
)

assertPlan(
  "Reserve Infinity → 0",
  { multiplier: 2, strategyReserve: Number.POSITIVE_INFINITY },
  { strategyReserve: 0, actualExtra: 0, actualTotal: 300_000, reserveAfter: 0 },
)

assertPlan(
  "Reserve 소수점 반올림",
  { multiplier: 1.25, strategyReserve: 75000.6 },
  {
    strategyReserve: 75_001,
    actualExtra: 75_000,
    actualTotal: 375_000,
    reserveAfter: 1,
  },
)

assert("sanitize negative", sanitizeStrategyKrw(-5) === 0)
assert("sanitize string bad", sanitizeStrategyKrw("abc") === 0)

const missing = normalizeInvestmentHomeSettings({
  crashReserve: {
    targetAmount: 1_000_000,
    currentAmount: 250_000,
    stageCount: 5,
    stagePercentages: [20, 20, 20, 20, 20],
    stageStatuses: [false, false, false, false, false],
  },
})
assert(
  "settings without strategyReserve → default 0",
  missing.strategyReserve?.currentAmount === 0,
)
assert(
  "Crash Reserve preserved independently",
  missing.crashReserve.currentAmount === 250_000 &&
    missing.crashReserve.targetAmount === 1_000_000,
)

const withBoth = normalizeInvestmentHomeSettings({
  crashReserve: { targetAmount: 999, currentAmount: 111, stageCount: 5 },
  strategyReserve: { currentAmount: 77_000 },
})
assert(
  "strategyReserve independent of crashReserve",
  withBoth.strategyReserve.currentAmount === 77_000 &&
    withBoth.crashReserve.currentAmount === 111 &&
    withBoth.crashReserve.targetAmount === 999,
)

assert(
  "normalizeStrategyReserve missing → 0",
  normalizeStrategyReserve(undefined).currentAmount === 0,
)
assert(
  "defaults include strategyReserve",
  defaultInvestmentHomeSettings().strategyReserve.currentAmount === 0,
)

assertPlan(
  "multiplier-only (no stage) 1.5",
  { multiplier: 1.5, strategyReserve: 30_000 },
  { multiplier: 1.5, actualExtra: 30_000, actualTotal: 330_000 },
)

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
