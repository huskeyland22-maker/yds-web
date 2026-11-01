/**
 * node --test scripts/etf-sell-backtest-v2.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildSellEvents } from "./lib/etf-sell-backtest.mjs"
import {
  SAME_DAY_ORDER,
  TRAIL_RULES,
  TRAIL_STRUCTURES,
  V2_SPECS,
  analyzeSymbolV2,
  decideSession,
  simulateTrailing,
} from "./lib/etf-sell-backtest-v2.mjs"

const FAIL = { rsi14: 50, stochK: 50, bbPctB: 0.5, ma20DevPct: 0, ma20: null }
const THREE = { rsi14: 30, stochK: 10, bbPctB: 0.5, ma20DevPct: -5, ma20: null }
const FOUR = { rsi14: 30, stochK: 10, bbPctB: 0, ma20DevPct: -5, ma20: null }

function row(i, close, flags = FAIL) {
  const date = new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10)
  return { date, close, open: close, high: close, low: close, volume: 1, ...flags }
}

function series(closes, flagAt = {}) {
  return closes.map((close, i) => row(i, close, flagAt[i] ?? FAIL))
}

function oneEpisode(length = 80) {
  const closes = Array.from({ length }, () => 100)
  const flagAt = { 1: THREE, 2: THREE, 3: THREE, 4: FOUR, 5: FAIL }
  return series(closes, flagAt)
}

const structure10 = TRAIL_STRUCTURES.find((row) => row.id === "10t")
const t1 = TRAIL_RULES.find((row) => row.id === "T1")
const t2 = TRAIL_RULES.find((row) => row.id === "T2")
const t4 = TRAIL_RULES.find((row) => row.id === "T4")
const t5 = TRAIL_RULES.find((row) => row.id === "T5")

describe("etf sell backtest v2", () => {
  it("defines five structures and six independent trail rules", () => {
    assert.equal(TRAIL_STRUCTURES.length, 5)
    assert.equal(TRAIL_RULES.length, 6)
    assert.equal(V2_SPECS.length, 30)
    assert.match(SAME_DAY_ORDER, /fixed targets/)
    for (const structure of TRAIL_STRUCTURES) {
      const weight = structure.legs.reduce((sum, leg) => sum + leg.weight, 0) + structure.trailWeight
      assert.ok(Math.abs(weight - 1) < 1e-9)
    }
  })

  it("uses the same episode events as v1", () => {
    const rows = oneEpisode()
    const v1 = buildSellEvents(rows)
    const v2 = analyzeSymbolV2("SMH", rows)
    assert.equal(v2.events.length, v1.events.length)
    assert.equal(v2.events[0].entryIdx, v1.events[0].entryIdx)
    assert.equal(v2.events[0].signalDate, v1.events[0].signalDate)
  })

  it("sells fixed weight at the first target close and trails only from the observed peak", () => {
    const rows = oneEpisode()
    rows[4] = { ...rows[4], close: 110 }
    rows[5] = { ...rows[5], close: 115 }
    rows[6] = { ...rows[6], close: 120 }
    rows[7] = { ...rows[7], close: 118 }
    rows[8] = { ...rows[8], close: 114 }
    rows[20] = { ...rows[20], close: 140 }
    const sold = simulateTrailing(rows, 1, 60, structure10, t1)
    assert.equal(sold.fills[0].role, "target")
    assert.equal(sold.fills[0].days, 3)
    assert.equal(sold.fills[0].price, 110)
    assert.equal(sold.fills[1].role, "trail")
    assert.equal(sold.fills[1].days, 7)
    assert.equal(sold.fills[1].price, 114)
    assert.equal(sold.completed, true)
    assert.equal(sold.sameDayFixedAndTrail, 0)
    assert.ok(Math.abs(sold.realized + sold.unrealized - sold.total) < 1e-12)
  })

  it("does not let a later peak change an earlier trail sale", () => {
    const base = oneEpisode()
    base[4] = { ...base[4], close: 110 }
    base[5] = { ...base[5], close: 110 }
    base[6] = { ...base[6], close: 110 }
    base[7] = { ...base[7], close: 110 }
    base[8] = { ...base[8], close: 104.5 }
    const highLater = base.map((row) => ({ ...row }))
    const lowLater = base.map((row) => ({ ...row }))
    highLater[30] = { ...highLater[30], close: 180 }
    lowLater[30] = { ...lowLater[30], close: 40 }
    const a = simulateTrailing(highLater, 1, 60, structure10, t1)
    const b = simulateTrailing(lowLater, 1, 60, structure10, t1)
    assert.deepEqual(
      a.fills.map((fill) => [fill.role, fill.idx, fill.price]),
      b.fills.map((fill) => [fill.role, fill.idx, fill.price]),
    )
    assert.equal(a.fills[1].idx, 8)
  })

  it("trails only the trailing sleeve when price falls before the target", () => {
    const rows = oneEpisode()
    rows[3] = { ...rows[3], close: 93 }
    const sold = simulateTrailing(rows, 1, 60, structure10, t2)
    assert.equal(sold.fills.length, 1)
    assert.equal(sold.fills[0].role, "trail")
    assert.equal(sold.fills[0].weight, 0.5)
    assert.equal(sold.completed, false)
    assert.equal(Math.round(sold.openWeight * 100), 50)
    assert.equal(Math.round(sold.realized * 1000) / 10, -3.5)
    assert.equal(sold.unrealized, 0)
    assert.equal(sold.total, sold.realized)
  })

  it("fills fixed sleeves before the trailing sleeve when both are true the same day", () => {
    const decision = decideSession({
      close: 110,
      entry: 100,
      peak: 130,
      ma20: 90,
      pendingLegs: [{ target: 0.1, weight: 0.5 }],
      trailWeight: 0.5,
      rule: t1,
    })
    assert.equal(decision.fixed.length, 1)
    assert.equal(decision.fixed[0].target, 0.1)
    assert.equal(decision.trail, true)
    assert.match(SAME_DAY_ORDER, /then sell the trailing sleeve/)
  })

  it("requires both drawdown and a close below MA20 for T5", () => {
    const rows = oneEpisode()
    rows[8] = { ...rows[8], close: 90, ma20: 80 }
    rows[12] = { ...rows[12], close: 90, ma20: 95 }
    const sold = simulateTrailing(rows, 1, 60, structure10, t5)
    assert.equal(sold.fills.filter((fill) => fill.role === "trail").length, 1)
    assert.equal(sold.fills.find((fill) => fill.role === "trail").days, 11)
  })

  it("sells the trailing sleeve on a close below MA20", () => {
    const rows = oneEpisode()
    rows[10] = { ...rows[10], close: 101, ma20: 102 }
    const sold = simulateTrailing(rows, 1, 60, structure10, t4)
    const trail = sold.fills.find((fill) => fill.role === "trail")
    assert.equal(trail.days, 9)
    assert.equal(trail.price, 101)
    assert.equal(sold.fills.some((fill) => fill.role === "target"), false)
  })
})
