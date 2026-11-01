/**
 * node --test scripts/daily-bottom-buy-ma20-recovery-risk-validation.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { TRAIN_RATIO } from "./lib/daily-bottom-buy-validation-core.mjs"
import { signalTrue } from "./lib/daily-bottom-buy-recovery-signals-validation.mjs"
import {
  EQUITY_CANDIDATES,
  FROZEN_THRESHOLDS,
  assertNoEtfInStudyUniverse,
  atrBand,
  firstSignalIndex,
  judgeMa20Risk,
  lowTiming,
  pathFrom,
} from "./lib/daily-bottom-buy-ma20-recovery-risk-validation.mjs"

function bar(partial) {
  return { close: 100, low: 99, high: 101, volume: 100, ma20: 100, ...partial }
}

describe("ma20 rule", () => {
  it("keeps the prior three-day rise and skips day 0", () => {
    const bars = []
    for (let i = 0; i < 8; i++) bars.push(bar({ ma20: 100 }))
    bars[4].ma20 = 90
    bars[5].ma20 = 91
    bars[7].ma20 = 95
    assert.equal(signalTrue(bars, 5, "ma20Up"), false)
    assert.equal(signalTrue(bars, 7, "ma20Up"), true)
    assert.equal(firstSignalIndex(bars, 4, "ma20Up", 30), 7)
  })
})

describe("evaluation window", () => {
  it("does not put a low from before the signal into the later MAE", () => {
    const bars = []
    for (let i = 0; i < 12; i++) bars.push(bar({ close: 100, low: 98 }))
    bars[2].low = 70
    const later = pathFrom(bars, 6, 5)
    assert.ok(later.mae < 5)
    assert.equal(lowTiming(2, 6), "before")
    assert.equal(lowTiming(6, 6), "sameDay")
    assert.equal(lowTiming(8, 6), "after")
  })
})

describe("judgment", () => {
  const gap = (maeGap, tail10Gap, n = 100) => ({ n, maeGap, tail10Gap })
  const atr = { lt3: gap(3, 8), b3_4: gap(3, 8), ge4: gap(3, 8) }
  it("requires a repeated MAE and tail drop, and marks a 2022 reversal as D", () => {
    assert.equal(
      judgeMa20Risk({ train: gap(4, 10), test: gap(4, 10), testAtr: atr, bear2022: gap(2, 4), top3SharePct: 20 }).code,
      "A",
    )
    assert.equal(
      judgeMa20Risk({ train: gap(4, 10), test: gap(4, 10), testAtr: atr, bear2022: gap(-2, 4), top3SharePct: 20 }).code,
      "D",
    )
    assert.equal(
      judgeMa20Risk({ train: gap(0.2, 1), test: gap(0.4, 1), testAtr: atr, bear2022: gap(0.2, 1), top3SharePct: 10 }).code,
      "C",
    )
    assert.equal(
      judgeMa20Risk({ train: gap(3, 1), test: gap(3, 1), testAtr: atr, bear2022: gap(1, 1), top3SharePct: 10 }).code,
      "B",
    )
  })
})

describe("universe", () => {
  it("keeps 48 names, frozen thresholds, and ATR cuts", () => {
    assertNoEtfInStudyUniverse()
    assert.equal(EQUITY_CANDIDATES.length, 48)
    assert.equal(FROZEN_THRESHOLDS.rsiMax, 36)
    assert.equal(FROZEN_THRESHOLDS.ma20DevMax, -4.2)
    assert.equal(TRAIN_RATIO, 0.7)
    assert.equal(atrBand(3), "b3_4")
    assert.equal(atrBand(4), "ge4")
  })
})
