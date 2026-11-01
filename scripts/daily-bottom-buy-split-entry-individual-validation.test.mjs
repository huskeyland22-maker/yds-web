/**
 * node --test scripts/daily-bottom-buy-split-entry-individual-validation.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { TRAIN_RATIO } from "./lib/daily-bottom-buy-validation-core.mjs"
import {
  BASELINE,
  EQUITY_CANDIDATES,
  FROZEN_THRESHOLDS,
  SCHEMES,
  assertNoEtfInStudyUniverse,
  planFills,
  simulateEpisode,
} from "./lib/daily-bottom-buy-split-entry-individual-validation.mjs"

function barsFrom(closes, lows = null) {
  return closes.map((close, i) => ({
    close,
    low: lows ? lows[i] : close,
    date: `d${i}`,
  }))
}

function flat(n, close = 100, low = null) {
  return barsFrom(Array.from({ length: n }, () => close), low ? Array.from({ length: n }, () => low) : null)
}

describe("drop fills use the first close through each Day0 line", () => {
  it("does not fill on an intraday low", () => {
    const bars = flat(61)
    bars[4] = { close: 96, low: 80, date: "d4" }
    const fills = planFills(bars, 0, [0.5, 0.5], { kind: "drop", step: 10 })
    assert.deepEqual(fills, [0, null])
  })

  it("fills at the first closing cross, not at a later lower close", () => {
    const bars = flat(61)
    bars[2] = { close: 89, low: 89, date: "d2" }
    bars[9] = { close: 70, low: 70, date: "d9" }
    const fills = planFills(bars, 0, [0.5, 0.5], { kind: "drop", step: 10 })
    assert.deepEqual(fills, [0, 2])
    const sim = simulateEpisode(bars, 0, [0.5, 0.5], { kind: "drop", step: 10 })
    assert.equal(sim.fills[1], 2)
    assert.equal(bars[sim.fills[1]].close, 89)
  })

  it("puts every line that is already through on the same close", () => {
    const bars = flat(61)
    bars[3] = { close: 80, low: 80, date: "d3" }
    const fills = planFills(bars, 0, [0.4, 0.3, 0.3], { kind: "drop", step: 5 })
    assert.deepEqual(fills, [0, 3, 3])
  })

  it("does not look past the 60-session horizon", () => {
    const bars = flat(80)
    bars[61] = { close: 80, low: 80, date: "d61" }
    const fills = planFills(bars, 0, [0.5, 0.5], { kind: "drop", step: 10 })
    assert.equal(fills[1], null)
  })
})

describe("time and time-plus-drop", () => {
  it("buys the scheduled close even when price is higher", () => {
    const bars = flat(61, 100)
    bars[5] = { close: 110, low: 110, date: "d5" }
    bars[10] = { close: 120, low: 120, date: "d10" }
    const fills = planFills(bars, 0, [0.4, 0.3, 0.3], { kind: "time", days: 5 })
    assert.deepEqual(fills, [0, 5, 10])
  })

  it("waits for both the trading-day gate and the Day0 drop", () => {
    const bars = flat(61)
    bars[2] = { close: 90, low: 90, date: "d2" }
    bars[5] = { close: 99, low: 99, date: "d5" }
    bars[8] = { close: 94, low: 94, date: "d8" }
    const fills = planFills(bars, 0, [0.5, 0.5], { kind: "timeDrop", days: 5, step: 5 })
    assert.deepEqual(fills, [0, 8])
  })
})

describe("book", () => {
  it("keeps the unfilled half as cash", () => {
    const closes = Array.from({ length: 61 }, () => 120)
    closes[0] = 100
    const sim = simulateEpisode(barsFrom(closes), 0, BASELINE.weights, { kind: "drop", step: 5 })
    assert.equal(sim.addCount, 0)
    assert.equal(sim.daysToFull, null)
    assert.equal(sim.d60, 10)
  })

  it("marks the second close and leaves a same-day low out of that tranche", () => {
    const closes = Array.from({ length: 61 }, () => 100)
    closes[10] = 90
    const lows = closes.map((c) => c - 1)
    lows[10] = 70
    const sim = simulateEpisode(barsFrom(closes, lows), 0, [0.5, 0.5], { kind: "drop", step: 10 })
    assert.equal(sim.d60, 5.56)
    assert.equal(sim.mae, 15)
  })
})

describe("universe", () => {
  it("keeps the 48 names, frozen thresholds, and the four schedules", () => {
    assertNoEtfInStudyUniverse()
    assert.equal(EQUITY_CANDIDATES.length, 48)
    assert.equal(FROZEN_THRESHOLDS.rsiMax, 36)
    assert.equal(FROZEN_THRESHOLDS.stochKMax, 15.4)
    assert.equal(FROZEN_THRESHOLDS.bbPctBMax, 0.01)
    assert.equal(FROZEN_THRESHOLDS.ma20DevMax, -4.2)
    assert.equal(TRAIN_RATIO, 0.7)
    assert.deepEqual(SCHEMES.map((s) => s.id), ["A", "B", "C", "D"])
    for (const scheme of SCHEMES) {
      const sum = scheme.weights.reduce((a, b) => a + b, 0)
      assert.ok(Math.abs(sum - 1) < 1e-9)
    }
  })
})
