/**
 * node --test scripts/etf-sell-backtest-v6.test.mjs
 */
import assert from "node:assert/strict"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
import { measurePullback } from "./lib/etf-sell-backtest-v3.mjs"
import {
  analyzeSymbolV6,
  classifyPath,
  describeCorrection,
  locateProfitCorrection,
  speedBucket,
  speedCuts,
  summarizeRows,
} from "./lib/etf-sell-backtest-v6.mjs"

const FAIL = { rsi14: 50, stochK: 50, bbPctB: 0.5, ma20DevPct: 0 }
const THREE = { rsi14: 30, stochK: 10, bbPctB: 0.5, ma20DevPct: -5 }

function row(i, close, flags = FAIL) {
  const date = new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10)
  return { date, close, ...flags }
}

function closesFrom(rows) {
  return rows.map((item) => item.close)
}

function flat(length = 80) {
  return Array.from({ length }, (_, i) => row(i, 100))
}

function hold(rows, from, to, close) {
  for (let i = from; i <= to; i++) rows[i].close = close
}

describe("etf sell backtest v6", () => {
  it("finds the same correction day as v5 and keeps horizons inside the window", () => {
    const rows = flat()
    hold(rows, 6, 9, 118)
    rows[10].close = 112
    rows[15].close = 119
    rows[30].close = 121
    const closes = closesFrom(rows)
    const located = locateProfitCorrection(closes, 1, 60, 0.1, 0.05)
    const prior = measurePullback(closes, 1, 60, 0.1, 0.05)
    assert.equal(located.event, true)
    assert.equal(located.t0, 10)
    assert.equal(prior.pullbackDays, 9)
    const described = describeCorrection(closes, located)
    assert.equal(described.speedDays, 10 - located.peakIdx)
    assert.equal(described.peakRecovered, true)
    assert.equal(described.daysToPeak, 5)
    assert.equal(described.horizons.t20.vsEntry > 0.2, true)
    assert.equal(described.horizons.t60, null)
    assert.notEqual(described.horizons.windowEnd, null)
    assert.equal(classifyPath(described), "NORMAL_CORRECTION")

    const late = flat()
    hold(late, 6, 49, 118)
    late[50].close = 112
    late[61].close = 130
    const lateHit = describeCorrection(closesFrom(late), locateProfitCorrection(closesFrom(late), 1, 60, 0.1, 0.05))
    assert.equal(lateHit.t0, 50)
    assert.equal(lateHit.horizons.t20, null)
    assert.equal(lateHit.horizons.t60, null)
    assert.equal(Math.round(lateHit.horizons.windowEnd.vsEntry * 100), 30)
  })

  it("separates a fast threshold, a rebound, and a trend break", () => {
    const cuts = speedCuts([1, 2, 3, 4, 8, 9, 10, 12, 14, 20])
    assert.equal(speedBucket(1, cuts), "FAST")
    assert.equal(speedBucket(20, cuts), "SLOW")
    assert.ok(["FAST", "NORMAL", "SLOW"].includes(speedBucket(8, cuts)))

    const rows = flat()
    hold(rows, 6, 8, 120)
    rows[9].close = 108
    rows[12].close = 100
    rows[16].close = 106
    const described = describeCorrection(closesFrom(rows), locateProfitCorrection(closesFrom(rows), 1, 60, 0.1, 0.1))
    assert.equal(described.event, true)
    assert.equal(described.reboundFollow.p5.happened, true)
    assert.equal(described.reboundFollow.p5.newLowAfter, false)
    assert.equal(described.newLow, true)

    const broken = flat()
    hold(broken, 6, 8, 112)
    broken[10].close = 100
    hold(broken, 11, 61, 90)
    const broke = describeCorrection(closesFrom(broken), locateProfitCorrection(closesFrom(broken), 1, 60, 0.1, 0.05))
    assert.equal(classifyPath(broke), "TREND_BREAK")
    assert.equal(broke.recoveredAfterBreak, false)

    const summary = summarizeRows([
      { event: true, speedDays: 2, additionalDrawdown: 0.01, reboundFromLow: 0.04, peakRecovered: true, newLow: false, aboveEntryAtT0: true, brokeEntry: false, recoveredEntryLater: true, recoveredAfterBreak: null, daysToEntry: 1, daysToPeak: 4, reclaim20Eligible: true, reclaimedWithin20: true, further5: false, further10: false, further15: false, maxDrawdownFromPeak: 0.05, t0VsEntry: 0.08, brokeStructure: false, horizons: { t20: { vsEntry: 0.12, vsT0: 0.03 }, windowEnd: { vsEntry: 0.1, vsT0: 0.02 }, t5: { vsEntry: 0.09, vsT0: 0.01 }, t60: null }, reboundFollow: { p5: { happened: true, entryAfter: true, peakAfter: true, newLowAfter: false } } },
      { event: false },
    ])
    assert.equal(summary.events, 1)
    assert.equal(summary.sampleNote, "sample_small")
    assert.equal(summary.t60.n, 0)
    assert.equal(summary.windowEnd.n, 1)
  })

  it("keeps the never-+10 group out of the profit corrections", () => {
    const missed = flat()
    missed[1] = row(1, 100, THREE)
    missed[8].close = 90
    const part = analyzeSymbolV6("BOTZ", missed)
    assert.equal(part.missed, 1)
    assert.equal(part.profit["p10-d5"][0].event, false)
    assert.equal(part.losses.loss10[0].event, true)
    assert.equal(Math.round(part.losses.loss10[0].t0VsEntry * 1000) / 10, -10)
  })
})
