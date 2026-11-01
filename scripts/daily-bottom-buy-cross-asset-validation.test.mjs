/**
 * Cross-asset equity diagnostic unit tests.
 * node --test scripts/daily-bottom-buy-cross-asset-validation.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  BANNED_ANALYSIS_ETFS,
  EQUITY_CANDIDATES,
  FROZEN_THRESHOLDS,
  assertNoEtfInStudyUniverse,
  classifyVsLow,
  rollingDrawdownPct,
} from "./lib/daily-bottom-buy-cross-asset-validation.mjs"

describe("study universe", () => {
  it("contains no analysis ETFs and keeps frozen thresholds", () => {
    assertNoEtfInStudyUniverse()
    const symbols = new Set(EQUITY_CANDIDATES.map((x) => x.symbol))
    for (const etf of BANNED_ANALYSIS_ETFS) assert.equal(symbols.has(etf), false)
    assert.equal(FROZEN_THRESHOLDS.rsiMax, 36)
    assert.equal(FROZEN_THRESHOLDS.stochKMax, 15.4)
    assert.equal(FROZEN_THRESHOLDS.bbPctBMax, 0.01)
    assert.equal(FROZEN_THRESHOLDS.ma20DevMax, -4.2)
  })
})

describe("classifyVsLow", () => {
  it("does not count a post-low print as capture", () => {
    assert.equal(classifyVsLow(11, 10, 5), "late")
    assert.equal(classifyVsLow(10, 10, 1), "capture")
    assert.equal(classifyVsLow(6, 10, 3), "early")
    assert.equal(classifyVsLow(7, 10, 3), "capture")
    assert.equal(classifyVsLow(null, 10, 5), "absent")
  })
})

describe("rollingDrawdownPct", () => {
  it("uses only closes through i", () => {
    const closes = [10, 12, 9, 8, 11]
    const at3 = rollingDrawdownPct(closes, 3, 5)
    assert.ok(Math.abs(at3 - ((8 - 12) / 12) * 100) < 1e-9)
    const at1 = rollingDrawdownPct(closes, 1, 5)
    assert.equal(at1, 0)
  })
})
