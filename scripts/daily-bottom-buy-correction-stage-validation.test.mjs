/**
 * Correction-stage unit tests.
 * node --test scripts/daily-bottom-buy-correction-stage-validation.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  EQUITY_CANDIDATES,
  FROZEN_THRESHOLDS,
  assertNoEtfInStudyUniverse,
  buildCorrectionEpisodes,
  firstLeadingIndex,
} from "./lib/daily-bottom-buy-correction-stage-validation.mjs"

function barsFromCloses(closes) {
  return closes.map((close, i) => ({
    date: `2020-${String(Math.floor(i / 28) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1000,
  }))
}

describe("buildCorrectionEpisodes", () => {
  it("opens on the -5% cross and orders deeper stages later", () => {
    const flat = Array(60).fill(100)
    const down = []
    for (let c = 94; c >= 70; c -= 2) down.push(c)
    const bars = barsFromCloses([...flat, ...down, ...Array(30).fill(99)])
    const episodes = buildCorrectionEpisodes(bars, 60)
    assert.ok(episodes.length >= 1)
    const ep = episodes[0]
    assert.ok(ep.stages[5])
    assert.ok(ep.stages[10])
    assert.ok(ep.stages[5].idx < ep.stages[10].idx)
    assert.notEqual(ep.startIdx, ep.evalLowIdx)
    assert.ok(ep.startIdx < ep.evalLowIdx)
  })
})

describe("firstLeadingIndex", () => {
  it("ignores prints after the evaluation low", () => {
    assert.equal(firstLeadingIndex([12, 14], 10), null)
    assert.equal(firstLeadingIndex([8, 12], 10), 8)
    assert.equal(firstLeadingIndex([10], 10), 10)
  })
})

describe("universe", () => {
  it("keeps 48 names and frozen thresholds", () => {
    assertNoEtfInStudyUniverse()
    assert.equal(EQUITY_CANDIDATES.length, 48)
    assert.equal(FROZEN_THRESHOLDS.rsiMax, 36)
    assert.equal(FROZEN_THRESHOLDS.ma20DevMax, -4.2)
  })
})
