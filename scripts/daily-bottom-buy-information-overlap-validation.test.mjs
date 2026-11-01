/**
 * node --test scripts/daily-bottom-buy-information-overlap-validation.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  EQUITY_CANDIDATES,
  FROZEN_THRESHOLDS,
  assertNoEtfInStudyUniverse,
  infoLevelFromGaps,
  pearson,
  spearman,
} from "./lib/daily-bottom-buy-information-overlap-validation.mjs"

describe("correlations", () => {
  it("ranks a perfect line at 1 and its reverse at -1", () => {
    const xs = [1, 2, 3, 4, 5, 6]
    const ys = [2, 4, 6, 8, 10, 12]
    assert.ok(Math.abs(pearson(xs, ys).r - 1) < 1e-6)
    assert.ok(Math.abs(spearman(xs, ys).r - 1) < 1e-6)
    assert.ok(Math.abs(spearman(xs, ys.map((v) => -v)).r + 1) < 1e-6)
  })
})

describe("infoLevelFromGaps", () => {
  it("marks a repeated MAE gap as A and a flat gap as C", () => {
    const wide = infoLevelFromGaps([
      { nLow: 40, nHigh: 40, maeLow: 7, maeHigh: 12 },
      { nLow: 40, nHigh: 40, maeLow: 8, maeHigh: 13 },
    ])
    const flat = infoLevelFromGaps([
      { nLow: 40, nHigh: 40, maeLow: 8, maeHigh: 8.5 },
      { nLow: 40, nHigh: 40, maeLow: 9, maeHigh: 9.4 },
    ])
    assert.equal(wide.level, "A")
    assert.equal(flat.level, "C")
  })
})

describe("universe", () => {
  it("keeps 48 names and frozen thresholds", () => {
    assertNoEtfInStudyUniverse()
    assert.equal(EQUITY_CANDIDATES.length, 48)
    assert.equal(FROZEN_THRESHOLDS.rsiMax, 36)
    assert.equal(FROZEN_THRESHOLDS.bbPctBMax, 0.01)
  })
})
