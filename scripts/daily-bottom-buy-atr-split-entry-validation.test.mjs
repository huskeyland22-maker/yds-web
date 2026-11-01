/**
 * node --test scripts/daily-bottom-buy-atr-split-entry-validation.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { TRAIN_RATIO } from "./lib/daily-bottom-buy-validation-core.mjs"
import {
  EQUITY_CANDIDATES,
  FROZEN_THRESHOLDS,
  assertNoEtfInStudyUniverse,
  atrBand,
  firstCloseDrop,
  judgeAtrSplit,
  portfolioMae,
  portfolioReturn,
} from "./lib/daily-bottom-buy-atr-split-entry-validation.mjs"

function barsFrom(closes, lows = null) {
  return closes.map((close, i) => ({ close, low: lows ? lows[i] : close, date: `2020-01-${String(i + 1).padStart(2, "0")}` }))
}

describe("close drop", () => {
  it("ignores an intraday low that does not close through the line", () => {
    const bars = barsFrom([100, 96, 95], [100, 89, 94])
    assert.equal(firstCloseDrop(bars, 0, 10, 60), null)
    assert.equal(firstCloseDrop(bars, 0, 5, 60), 2)
  })
})

describe("fixed 50/50 book", () => {
  it("keeps the second half in cash when the drop is absent, including at day 20", () => {
    const closes = [100, 110, 120]
    const bars = barsFrom(closes)
    const half = portfolioReturn(bars, 0, null, 2, { w1: 0.5, w2: 0.5 })
    assert.equal(half, 10)
    const single = portfolioReturn(bars, 0, null, 2, { w1: 1, w2: 0 })
    assert.equal(single, 20)
  })

  it("fills the second half at the -10% close and leaves day-20 unchanged if the fill is later", () => {
    const closes = Array.from({ length: 25 }, () => 100)
    closes[0] = 100
    closes[10] = 90
    closes[20] = 100
    closes[24] = 110
    const bars = barsFrom(closes, closes.map((c) => c - 1))
    const fill = firstCloseDrop(bars, 0, 10, 60)
    assert.equal(fill, 10)
    const d20 = portfolioReturn(bars, 0, fill, 20, { w1: 0.5, w2: 0.5 })
    assert.equal(d20, 5.56)
    const before = portfolioReturn(bars, 0, 15, 10, { w1: 0.5, w2: 0.5 })
    assert.ok(Math.abs(before - (0.5 * (90 / 100 - 1) * 100)) < 1e-9)
  })

  it("does not charge the second tranche for the low on its fill day", () => {
    const bars = barsFrom([100, 90], [98, 80])
    const mae = portfolioMae(bars, 0, 1, 60, { w1: 0.5, w2: 0.5 })
    const cashDay = 1 - (0.5 * (80 / 100) + 0.5)
    assert.equal(mae, Math.round(cashDay * 10000) / 100)
  })
})

describe("judgment", () => {
  const single = { n: 80, maeMedian: 8, d60Median: 6, hit10Pct: 60 }
  it("marks a joint MAE drop without a D+60 give-up as A", () => {
    const better = { n: 80, maeMedian: 6, d60Median: 6, hit10Pct: 58 }
    assert.equal(judgeAtrSplit(single, better, single, better, single, better, single, better).code, "A")
  })
  it("marks a recovery give-up as C and a sign flip as D", () => {
    const worseRet = { n: 80, maeMedian: 6, d60Median: 3, hit10Pct: 60 }
    const flipped = { n: 80, maeMedian: 10, d60Median: 6, hit10Pct: 60 }
    const better = { n: 80, maeMedian: 6, d60Median: 6, hit10Pct: 58 }
    assert.equal(judgeAtrSplit(single, worseRet, single, worseRet, single, worseRet, single, worseRet).code, "C")
    assert.equal(judgeAtrSplit(single, better, single, flipped, single, better, single, better).code, "D")
  })
})

describe("universe", () => {
  it("keeps the frozen 3/4 thresholds and the prior ATR cuts", () => {
    assertNoEtfInStudyUniverse()
    assert.equal(EQUITY_CANDIDATES.length, 48)
    assert.equal(FROZEN_THRESHOLDS.rsiMax, 36)
    assert.equal(FROZEN_THRESHOLDS.bbPctBMax, 0.01)
    assert.equal(TRAIN_RATIO, 0.7)
    assert.equal(atrBand(2.99), "lt3")
    assert.equal(atrBand(3), "b3_4")
    assert.equal(atrBand(3.99), "b3_4")
    assert.equal(atrBand(4), "ge4")
  })
})
