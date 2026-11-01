/**
 * Signal strength validation unit tests (new file only).
 * node --test scripts/daily-bottom-buy-signal-strength-validation.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  assignTertileGroups,
  computeSignalStrengthScore,
  indicatorNormalizedStrength,
  pearsonCorrelation,
} from "./lib/daily-bottom-buy-signal-strength-validation.mjs"

describe("indicatorNormalizedStrength", () => {
  it("is ~0 near RSI threshold and higher when deeper", () => {
    const near = indicatorNormalizedStrength("rsi", 35.5)
    const deep = indicatorNormalizedStrength("rsi", 25)
    assert.ok(near != null && near < 0.2)
    assert.ok(deep != null && deep >= 0.99)
    assert.equal(indicatorNormalizedStrength("rsi", 40), 0)
  })

  it("treats more negative MA20 as stronger", () => {
    const weak = indicatorNormalizedStrength("ma", -4.5)
    const strong = indicatorNormalizedStrength("ma", -8)
    assert.ok(weak != null && weak < 0.2)
    assert.ok(strong != null && strong >= 0.99)
  })
})

describe("computeSignalStrengthScore", () => {
  it("averages only fulfilled flags", () => {
    const r = computeSignalStrengthScore(
      { rsi14: 25, stochK: 14, bbPctB: 0.2, ma20DevPct: -4.5 },
      { rsi: true, stoch: true, bb: false, ma: true, count: 3 },
    )
    assert.equal(r.nContributing, 3)
    assert.ok(r.score != null && r.score > 0)
  })
})

describe("assignTertileGroups", () => {
  it("splits into Weak/Medium/Strong by score rank", () => {
    const items = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((score) => ({ score }))
    const labeled = assignTertileGroups(items)
    assert.equal(labeled.filter((x) => x.strengthGroup === "Weak").length, 3)
    assert.equal(labeled.filter((x) => x.strengthGroup === "Medium").length, 3)
    assert.equal(labeled.filter((x) => x.strengthGroup === "Strong").length, 3)
    assert.equal(labeled[0].strengthGroup, "Weak")
    assert.equal(labeled[8].strengthGroup, "Strong")
  })
})

describe("pearsonCorrelation", () => {
  it("returns ~1 for aligned series", () => {
    const xs = [1, 2, 3, 4, 5, 6]
    const ys = [2, 4, 6, 8, 10, 12]
    const r = pearsonCorrelation(xs, ys)
    assert.ok(Math.abs(r.r - 1) < 0.001)
  })
})
