#!/usr/bin/env node
import {
  buildCrashReservePlan,
  computeStageAmounts,
  computeSpyDrawdownFromPrices,
  isSpyDrawdownAvailableForStages,
  resolveCrashReserveStageState,
  SPY_STALE_MAX_AGE_DAYS,
} from "../src/content/ydsCrashReserveEngine.js"
import { resolveMarketStressReport } from "../src/content/ydsInvestmentStressResolver.js"

let passed = 0
let failed = 0

function assert(name, condition) {
  if (condition) {
    passed += 1
    console.log(`✅ ${name}`)
  } else {
    failed += 1
    console.log(`❌ ${name}`)
  }
}

const NOW = new Date("2026-08-18T12:00:00.000Z")

const freshSpy = {
  drawdownPct: -18,
  rollingHigh52w: 500,
  currentClose: 410,
  dataDate: "2026-08-15",
  symbol: "SPY",
  ageDays: 3,
  stale: false,
  freshness: "FRESH",
}

const staleSpy = {
  drawdownPct: -18,
  rollingHigh52w: 500,
  currentClose: 410,
  dataDate: "2026-06-05",
  symbol: "SPY",
  ageDays: 74,
  stale: true,
  freshness: "STALE",
}

const freshStress = {
  score: 78,
  level: { id: "CRASH", label: "CRASH" },
  dataQuality: { dataDate: "2026-08-15", ageDays: 3, stale: false },
}

const staleStressReport = resolveMarketStressReport({
  vix: 18.21,
  putCall: 0.96,
  fearGreed: 38,
  bofa: 9.6,
  highYield: 2.81,
  date: "2026-07-28",
})

const baseSettings = {
  targetAmount: 1_000_000,
  currentAmount: 0,
  stageCount: 5,
  stagePercentages: [20, 20, 20, 20, 20],
  stageStatuses: [false, false, false, false, false],
}

// 1. SPY fresh + Stress fresh + conditions met
const case1 = buildCrashReservePlan(baseSettings, {
  drawdown: freshSpy,
  stressReport: freshStress,
  now: NOW,
})
assert(
  "1 fresh+fresh+conditions → stage1 REVIEW_AVAILABLE",
  case1.stages[0].status === "REVIEW_AVAILABLE" && case1.stages[0].statusLabel === "투입 검토 가능",
)

// 2. SPY stale + Stress fresh + conditions met
const case2 = buildCrashReservePlan(baseSettings, {
  drawdown: staleSpy,
  stressReport: freshStress,
  now: NOW,
})
assert(
  "2 SPY stale + Stress fresh → WAITING (no review)",
  case2.stages.every((s) => s.status !== "REVIEW_AVAILABLE") &&
    case2.stages[0].statusLabel === "시장 데이터 확인 필요",
)

// 3. SPY fresh + Stress stale + conditions met
const case3 = buildCrashReservePlan(baseSettings, {
  drawdown: freshSpy,
  stressReport: staleStressReport,
  now: NOW,
})
assert(
  "3 SPY fresh + Stress stale → WAITING",
  case3.stages.every((s) => s.status !== "REVIEW_AVAILABLE") &&
    case3.stages[0].statusLabel === "시장 데이터 확인 필요",
)

// 4. SPY stale + Stress stale
const case4 = buildCrashReservePlan(baseSettings, {
  drawdown: staleSpy,
  stressReport: staleStressReport,
  now: NOW,
})
assert(
  "4 both stale → WAITING",
  case4.stages.every((s) => s.status !== "REVIEW_AVAILABLE") &&
    case4.stages.every((s) => s.statusLabel === "시장 데이터 확인 필요"),
)

// 5. SPY null
const case5 = buildCrashReservePlan(baseSettings, {
  drawdown: computeSpyDrawdownFromPrices(null, NOW),
  stressReport: freshStress,
  now: NOW,
})
assert(
  "5 SPY null → WAITING",
  case5.stages.every((s) => s.status !== "REVIEW_AVAILABLE"),
)

// 6. Stress null
const case6 = buildCrashReservePlan(baseSettings, {
  drawdown: freshSpy,
  stressReport: null,
  now: NOW,
})
assert(
  "6 Stress null → WAITING",
  case6.stages.every((s) => s.status !== "REVIEW_AVAILABLE"),
)

// 7. COMPLETED no rollback
const completedState = resolveCrashReserveStageState({
  completed: true,
  drawdownPct: -3,
  drawdownThreshold: -15,
  stressScore: 80,
  minStressScore: 60,
  spyAvailable: true,
  stressAvailable: true,
})
assert("7 COMPLETED stays completed", completedState.status === "COMPLETED")

// Amount tests
const oneM = buildCrashReservePlan({ ...baseSettings, targetAmount: 1_000_000 }, { now: NOW })
assert("1M → 200k each", oneM.stages.every((s) => s.amount === 200_000))
assert("rounding sum", computeStageAmounts(1_000_003, [20, 20, 20, 20, 20]).reduce((a, b) => a + b, 0) === 1_000_003)

// SPY quality from file-like stale date
const staleFileSpy = computeSpyDrawdownFromPrices({ "2026-06-05": 7383.74 }, NOW)
assert("SPY file last 2026-06-05 → stale", staleFileSpy.stale === true && staleFileSpy.ageDays === 74)
assert("stale SPY not stage-eligible", isSpyDrawdownAvailableForStages(staleFileSpy) === false)

const freshDateSpy = computeSpyDrawdownFromPrices({ "2026-08-15": 500, "2026-08-14": 510 }, NOW)
assert(
  "SPY age 3 → fresh boundary",
  freshDateSpy.ageDays === 3 && freshDateSpy.stale === false,
)

const staleBoundarySpy = computeSpyDrawdownFromPrices({ "2026-08-14": 500 }, NOW)
assert(
  "SPY age 4 → stale",
  staleBoundarySpy.ageDays === 4 && staleBoundarySpy.stale === true,
)

assert(`SPY_STALE_MAX_AGE_DAYS is 3`, SPY_STALE_MAX_AGE_DAYS === 3)

// Current real case simulation
const currentCase = buildCrashReservePlan(baseSettings, {
  drawdown: staleFileSpy,
  stressReport: staleStressReport,
  now: NOW,
})
assert(
  "current case → 0 REVIEW, all 시장 데이터 확인 필요",
  currentCase.stages.every((s) => s.status === "WAITING") &&
    currentCase.stages.every((s) => s.statusLabel === "시장 데이터 확인 필요") &&
    !currentCase.stages.some((s) => s.status === "REVIEW_AVAILABLE"),
)
assert("current drawdown still displayed", currentCase.drawdown.pct != null)

console.log(`\nCrash Reserve stale safety tests: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
