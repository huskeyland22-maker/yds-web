/**
 * Entry-outcome analysis unit tests
 * node --test scripts/daily-bottom-entry-outcome-analysis.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  analyzePricePathFromEntry,
  summarizeTargetReach,
  summarizeWithHitRate,
} from "./lib/daily-bottom-entry-outcome-analysis.mjs"

function path(closes) {
  return closes.map((c, i) => ({
    date: `2020-01-${String(i + 1).padStart(2, "0")}`,
    close: c,
  }))
}

describe("analyzePricePathFromEntry", () => {
  it("measures days-to-target, forward returns, and MAE from entry close", () => {
    // entry 100; day1=95 (-5%); day2=103 (+3%); … day5=110
    const bars = path([100, 95, 103, 104, 105, 110, 112, 115])
    const r = analyzePricePathFromEntry(bars, 0, 100, 60)
    assert.equal(r.hitTarget[3], true)
    assert.equal(r.daysToTarget[3], 2)
    assert.equal(r.hitTarget[5], true)
    assert.equal(r.daysToTarget[5], 4)
    assert.equal(r.maePct, 5)
    assert.equal(r.maeDays, 1)
    assert.equal(r.forwardRet[5], 10)
    assert.equal(r.forwardAvailable[5], true)
    assert.equal(r.forwardAvailable[60], false)
  })

  it("marks truncated horizon when data ends early", () => {
    const bars = path([100, 101, 102])
    const r = analyzePricePathFromEntry(bars, 0, 100, 60)
    assert.equal(r.fullHorizon60, false)
    assert.equal(r.forwardAvailable[5], false)
    assert.equal(r.hitTarget[10], false)
  })
})

describe("summaries", () => {
  it("positiveRate counts strictly positive returns", () => {
    const s = summarizeWithHitRate([1, -2, 0, 3])
    assert.equal(s.n, 4)
    assert.equal(s.positiveRate, 50)
  })

  it("target reach separates hit vs full miss vs truncated", () => {
    const paths = [
      {
        availableForwardDays: 60,
        fullHorizon60: true,
        hitTarget: { 5: true },
        daysToTarget: { 5: 8 },
      },
      {
        availableForwardDays: 60,
        fullHorizon60: true,
        hitTarget: { 5: false },
        daysToTarget: { 5: null },
      },
      {
        availableForwardDays: 10,
        fullHorizon60: false,
        hitTarget: { 5: false },
        daysToTarget: { 5: null },
      },
    ]
    const t = summarizeTargetReach(paths, 5)
    assert.equal(t.nEligible, 3)
    assert.equal(t.nHit, 1)
    assert.equal(t.reachRate, 33.33)
    assert.equal(t.nFullHorizonMiss, 1)
    assert.equal(t.nTruncatedWithoutHit, 1)
    assert.equal(t.daysAmongHits.median, 8)
  })
})
