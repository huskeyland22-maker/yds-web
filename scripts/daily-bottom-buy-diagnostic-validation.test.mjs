/**
 * Diagnostic validation unit tests (new file only).
 * node --test scripts/daily-bottom-buy-diagnostic-validation.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  analyzeReturnDistribution,
  findFurtherReviewCandidates,
} from "./lib/daily-bottom-buy-diagnostic-validation.mjs"

describe("analyzeReturnDistribution", () => {
  it("computes trimmed expectancy below full when top tail is large", () => {
    // nine +1 and one +100 → mean pulled by outlier
    const vals = [1, 1, 1, 1, 1, 1, 1, 1, 1, 100]
    const d = analyzeReturnDistribution(vals)
    assert.equal(d.n, 10)
    assert.ok(d.mean > d.median)
    assert.ok(d.variants.A_full.expectancy != null)
    assert.ok(d.variants.B_dropTop10pct.expectancy < d.variants.A_full.expectancy)
    assert.ok(d.variants.C_dropTop20pct.expectancy < d.variants.A_full.expectancy)
    assert.equal(d.percentiles.p50, d.median)
  })
})

describe("findFurtherReviewCandidates", () => {
  it("labels candidates as further review only", () => {
    const pooled = {
      d60Median: 9,
      d60Expectancy: 11,
      reachPlus5: 83,
      maeGe10Pct: 22,
    }
    const etfRows = [
      {
        symbol: "XLV",
        n: 13,
        smallSample: false,
        d60Median: 2.8,
        d60Expectancy: 3,
        reachPlus5: 46,
        maeGe10Pct: 0,
        after4WeakPct: 10,
        reached4Pct: 23,
        vsPool: { reachPlus5Delta: -37, maeGe10Delta: -22, d60ExpectancyDelta: -8 },
      },
      {
        symbol: "TINY",
        n: 5,
        smallSample: true,
        d60Median: -5,
        d60Expectancy: -5,
        reachPlus5: 10,
        maeGe10Pct: 80,
        after4WeakPct: 90,
        reached4Pct: 50,
        vsPool: { reachPlus5Delta: -70, maeGe10Delta: 50, d60ExpectancyDelta: -16 },
      },
    ]
    const r = findFurtherReviewCandidates(etfRows, pooled)
    assert.ok(r.A.some((x) => x.symbol === "XLV"))
    assert.ok(r.C.some((x) => x.symbol === "XLV"))
    assert.ok(r.A.every((x) => x.label === "추가 검증 우선 대상"))
    assert.ok(!r.A.some((x) => x.symbol === "TINY"), "small sample excluded from A")
  })
})
