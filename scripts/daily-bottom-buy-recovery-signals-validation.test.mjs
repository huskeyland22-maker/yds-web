/**
 * node --test scripts/daily-bottom-buy-recovery-signals-validation.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { TRAIN_RATIO } from "./lib/daily-bottom-buy-validation-core.mjs"
import {
  EQUITY_CANDIDATES,
  FROZEN_THRESHOLDS,
  assertNoEtfInStudyUniverse,
  atrBand,
  firstSignalIndex,
  forwardStats,
  judgeRecovery,
  signalTrue,
} from "./lib/daily-bottom-buy-recovery-signals-validation.mjs"

function bar(partial) {
  return {
    close: 100,
    low: 99,
    high: 101,
    volume: 100,
    rsi14: 30,
    stochK: 10,
    stochD: 12,
    ma20: 100,
    ...partial,
  }
}

describe("causal flags", () => {
  it("does not treat day 0 as the first signal and ignores a future low", () => {
    const bars = []
    for (let i = 0; i < 12; i++) bars.push(bar({ close: 100, low: 90 + i, rsi14: 40 }))
    bars[5].rsi14 = 30
    bars[6].rsi14 = 28
    bars[7].rsi14 = 33
    bars[11].low = 1
    assert.equal(signalTrue(bars, 5, "rsiUp"), false)
    assert.equal(firstSignalIndex(bars, 5, "rsiUp", 30), 7)
    assert.equal(signalTrue(bars, 10, "higherLow"), true)
    assert.equal(minOf(bars, 6, 10) > minOf(bars, 1, 5), true)
  })

  it("requires a completed stochastic cross and a 1.5 volume ratio", () => {
    const bars = [bar({ stochK: 10, stochD: 12 }), bar({ stochK: 14, stochD: 11 })]
    assert.equal(signalTrue(bars, 1, "stochCross"), true)
    bars[1].stochK = 11
    bars[1].stochD = 12
    assert.equal(signalTrue(bars, 1, "stochCross"), false)
    const vols = []
    for (let i = 0; i < 20; i++) vols.push(bar({ volume: 100 }))
    assert.equal(signalTrue(vols, 19, "volume15"), false)
    vols[19].volume = 1500
    assert.equal(signalTrue(vols, 19, "volume15"), true)
  })
})

function minOf(bars, a, b) {
  let v = Infinity
  for (let i = a; i <= b; i++) if (bars[i].low < v) v = bars[i].low
  return v
}

describe("judgment", () => {
  const row = (id, trainGap, testGap, extra = {}) => ({
    id,
    train: { n: 100, missN: 80, occ: 40, d20Gap: trainGap, d60Gap: trainGap, top3SharePct: 20, ...extra },
    test: { n: 80, missN: 40, occ: 45, d20Gap: testGap, d60Gap: testGap, top3SharePct: 25 },
  })
  it("passes only a repeated positive return gap", () => {
    assert.equal(judgeRecovery([row("rsiUp", 2, 2)]).code, "A")
    assert.equal(judgeRecovery([row("rsiUp", -2, -2)]).code, "B")
    assert.equal(judgeRecovery([row("rsiUp", 2, -2)]).code, "C")
    assert.equal(judgeRecovery([row("rsiUp", 0.2, 0.2)]).code, "C")
  })
})

describe("universe", () => {
  it("keeps the frozen 3/4 rule and the prior ATR cuts", () => {
    assertNoEtfInStudyUniverse()
    assert.equal(EQUITY_CANDIDATES.length, 48)
    assert.equal(FROZEN_THRESHOLDS.rsiMax, 36)
    assert.equal(FROZEN_THRESHOLDS.stochKMax, 15.4)
    assert.equal(TRAIN_RATIO, 0.7)
    assert.equal(atrBand(2.99), "lt3")
    assert.equal(atrBand(4), "ge4")
  })
})
