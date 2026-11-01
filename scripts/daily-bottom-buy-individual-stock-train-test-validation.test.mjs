/**
 * node --test scripts/daily-bottom-buy-individual-stock-train-test-validation.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { timeSplitBars, TRAIN_RATIO } from "./lib/daily-bottom-buy-validation-core.mjs"
import {
  EQUITY_CANDIDATES,
  FROZEN_THRESHOLDS,
  assertNoEtfInStudyUniverse,
  atrBand,
  classifyStudyRegime,
  depthBand,
  judgeReplacement,
  rsBand,
} from "./lib/daily-bottom-buy-individual-stock-train-test-validation.mjs"

describe("chronological split", () => {
  it("puts earlier indexes in train and does not shuffle", () => {
    const bars = Array.from({ length: 10 }, (_, i) => ({ date: `2020-01-${String(i + 1).padStart(2, "0")}` }))
    const split = timeSplitBars(bars, TRAIN_RATIO)
    assert.equal(split.splitIdx, 7)
    assert.equal(split.trainLastDate, "2020-01-07")
    assert.equal(split.testFirstDate, "2020-01-08")
    assert.ok(split.splitIdx > 1)
  })
})

describe("fixed bands", () => {
  it("partitions drawdown without a searched cut", () => {
    assert.equal(depthBand(-9.99), "lt10")
    assert.equal(depthBand(-10), "m10_15")
    assert.equal(depthBand(-15), "m15_20")
    assert.equal(depthBand(-20), "m20_25")
    assert.equal(depthBand(-25), "m25_30")
    assert.equal(depthBand(-30), "le30")
    assert.equal(atrBand(2.99), "lt3")
    assert.equal(atrBand(3), "b3_4")
    assert.equal(atrBand(4), "ge4")
    assert.equal(rsBand(0), "ge0")
    assert.equal(rsBand(-0.01), "lt0")
  })

  it("keeps a flat MA200 slope out of DOWN", () => {
    assert.equal(
      classifyStudyRegime({ close: 90, ma200: 100, slope: 0, ma50Above: false }),
      "neutral",
    )
    assert.equal(
      classifyStudyRegime({ close: 90, ma200: 100, slope: -0.2, ma50Above: false }),
      "down",
    )
    assert.equal(
      classifyStudyRegime({ close: 110, ma200: 100, slope: 0.2, ma50Above: true }),
      "up",
    )
  })
})

describe("judgment", () => {
  const base = { n: 80, maeMedian: 8, d60Median: 5, tail10Pct: 40, tail20Pct: 12 }
  it("labels a repeated MAE drop as A and a test reversal as C", () => {
    const better = { n: 80, maeMedian: 6, d60Median: 6, tail10Pct: 35, tail20Pct: 10 }
    const reversed = { n: 80, maeMedian: 8.2, d60Median: 5, tail10Pct: 41, tail20Pct: 13 }
    assert.equal(judgeReplacement(base, better, base, better).code, "A")
    assert.equal(judgeReplacement(base, better, base, reversed).code, "C")
  })

  it("labels a larger test tail as D and a flat gap as B", () => {
    const fatterTail = { n: 80, maeMedian: 7.5, d60Median: 7, tail10Pct: 48, tail20Pct: 20 }
    const flat = { n: 80, maeMedian: 7.6, d60Median: 5.2, tail10Pct: 41, tail20Pct: 13 }
    assert.equal(judgeReplacement(base, fatterTail, base, fatterTail).code, "D")
    assert.equal(judgeReplacement(base, flat, base, flat).code, "B")
  })
})

describe("universe", () => {
  it("keeps 48 names and the frozen thresholds", () => {
    assertNoEtfInStudyUniverse()
    assert.equal(EQUITY_CANDIDATES.length, 48)
    assert.equal(FROZEN_THRESHOLDS.rsiMax, 36)
    assert.equal(FROZEN_THRESHOLDS.stochKMax, 15.4)
    assert.equal(FROZEN_THRESHOLDS.bbPctBMax, 0.01)
    assert.equal(FROZEN_THRESHOLDS.ma20DevMax, -4.2)
    assert.equal(TRAIN_RATIO, 0.7)
  })
})
