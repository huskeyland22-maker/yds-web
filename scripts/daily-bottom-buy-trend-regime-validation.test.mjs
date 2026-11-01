/**
 * node --test scripts/daily-bottom-buy-trend-regime-validation.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  EQUITY_CANDIDATES,
  FROZEN_THRESHOLDS,
  assertNoEtfInStudyUniverse,
  classifyTrendRegime,
} from "./lib/daily-bottom-buy-trend-regime-validation.mjs"

describe("classifyTrendRegime", () => {
  it("requires all three up conditions", () => {
    assert.equal(
      classifyTrendRegime({ aboveMa200: true, ma200Slope: 1, ma50AboveMa200: true }),
      "up",
    )
    assert.equal(
      classifyTrendRegime({ aboveMa200: true, ma200Slope: 1, ma50AboveMa200: false }),
      "neutral",
    )
  })

  it("labels full down separately from a partial break", () => {
    assert.equal(
      classifyTrendRegime({ aboveMa200: false, ma200Slope: -0.4, ma50AboveMa200: false }),
      "down",
    )
    assert.equal(
      classifyTrendRegime({ aboveMa200: false, ma200Slope: 0.2, ma50AboveMa200: false }),
      "neutral",
    )
  })

  it("does not invent a label when MA200 is unavailable", () => {
    assert.equal(
      classifyTrendRegime({ aboveMa200: null, ma200Slope: null, ma50AboveMa200: null }),
      "unknown",
    )
  })
})

describe("universe", () => {
  it("stays on the 48 names and frozen thresholds", () => {
    assertNoEtfInStudyUniverse()
    assert.equal(EQUITY_CANDIDATES.length, 48)
    assert.equal(FROZEN_THRESHOLDS.rsiMax, 36)
    assert.equal(FROZEN_THRESHOLDS.ma20DevMax, -4.2)
  })
})
