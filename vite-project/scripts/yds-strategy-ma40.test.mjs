#!/usr/bin/env node
import {
  STRATEGY_BASE_MONTHLY_KRW,
  buildCompletedWeeklyBars,
  buildStrategyMa40Judgment,
  computeMa40,
  computeMa40Deviation,
  computeTargetMonthlyKrw,
  fridayOfWeek,
  resolveStrategyStage,
} from "../src/content/ydsStrategyMa40Engine.js"

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

assert("friday Mon→Fri", fridayOfWeek("2026-08-10") === "2026-08-14")
assert("friday Fri→Fri", fridayOfWeek("2026-08-14") === "2026-08-14")

// Incomplete week: asOf mid-week must not use upcoming Friday
const midWeekPrices = {
  "2026-08-10": 100, // Mon of week ending 2026-08-14
  "2026-08-11": 101,
  "2026-08-12": 102,
  "2026-07-31": 99, // prior week Fri week ending 2026-07-31
  "2026-07-30": 98,
}
const midBars = buildCompletedWeeklyBars(midWeekPrices, "2026-08-12")
assert(
  "exclude future Friday week when asOf=Wed",
  midBars.every((b) => b.weekEnd <= "2026-08-12") && !midBars.some((b) => b.weekEnd === "2026-08-14"),
)

assert("-4.9% → 1.0x", resolveStrategyStage(-0.049)?.multiplier === 1.0)
assert("-5.0% → 1.25x", resolveStrategyStage(-0.05)?.multiplier === 1.25)
assert("-9.9% → 1.25x", resolveStrategyStage(-0.099)?.multiplier === 1.25)
assert("-10.0% → 1.5x", resolveStrategyStage(-0.1)?.multiplier === 1.5)
assert("-19.9% → 1.5x", resolveStrategyStage(-0.199)?.multiplier === 1.5)
assert("-20.0% → 2.0x", resolveStrategyStage(-0.2)?.multiplier === 2.0)
assert("+2% → 1.0x", resolveStrategyStage(0.02)?.multiplier === 1.0)

assert("target 1.0", computeTargetMonthlyKrw(1.0) === 300_000)
assert("target 1.25", computeTargetMonthlyKrw(1.25) === 375_000)
assert("target 1.5", computeTargetMonthlyKrw(1.5) === 450_000)
assert("target 2.0", computeTargetMonthlyKrw(2.0) === 600_000)
assert("base constant", STRATEGY_BASE_MONTHLY_KRW === 300_000)

// 45 Fridays: first 40 @ 100, last 5 @ 88 (−12% vs prior flat → MA≈98.5, stage 3)
/** @type {Record<string, number>} */
const longPrices = {}
const firstFriday = new Date(Date.UTC(2025, 0, 3, 12)) // 2025-01-03 Fri
for (let w = 0; w < 45; w += 1) {
  const fri = new Date(firstFriday)
  fri.setUTCDate(firstFriday.getUTCDate() + w * 7)
  const iso = fri.toISOString().slice(0, 10)
  longPrices[iso] = w < 40 ? 100 : 88
}
const asOf = Object.keys(longPrices).sort().at(-1)
const weekly = buildCompletedWeeklyBars(longPrices, asOf)
assert("enough weekly bars", weekly.length >= 40)
const ma = computeMa40(weekly)
assert("ma40 finite", ma != null && Number.isFinite(ma))
const latest = weekly[weekly.length - 1]
const dev = computeMa40Deviation(latest.close, ma)
assert("deviation near -11%", dev != null && Math.abs(dev - (88 - ma) / ma) < 1e-9)

const judgment = buildStrategyMa40Judgment(longPrices, { asOf })
assert("judgment ok", judgment.ok === true)
assert("judgment stage 3", judgment.stage === 3 && judgment.multiplier === 1.5)
assert("judgment target 450k", judgment.targetMonthlyKrw === 450_000)

const empty = buildStrategyMa40Judgment(null, { asOf: "2026-08-18" })
assert("null prices → not ok", empty.ok === false && empty.targetMonthlyKrw == null && empty.multiplier == null)

const short = buildStrategyMa40Judgment({ "2026-08-14": 100 }, { asOf: "2026-08-14" })
assert("too few weeks → not ok", short.ok === false && short.multiplier == null)

const stale = buildStrategyMa40Judgment(longPrices, { asOf: "2026-09-14" })
assert(
  "stale weeks → not ok no fake 1.0x",
  stale.ok === false && stale.multiplier == null && stale.targetMonthlyKrw == null,
)

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
