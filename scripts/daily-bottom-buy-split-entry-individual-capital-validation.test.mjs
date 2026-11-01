/**
 * node --test scripts/daily-bottom-buy-split-entry-individual-capital-validation.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  CAPITAL_SCHEMES,
  EQUITY_CANDIDATES,
  FROZEN_THRESHOLDS,
  assertNoEtfInStudyUniverse,
  deployedFraction,
  simulateEpisode,
} from "./lib/daily-bottom-buy-split-entry-individual-capital-validation.mjs"

function flat(n, close = 100) {
  return Array.from({ length: n }, (_, i) => ({ close, low: close, date: `d${i}` }))
}

const scheme = (id) => CAPITAL_SCHEMES.find((s) => s.id === id)

describe("100% planned capital", () => {
  it("treats the unfilled half as a 0% cash balance", () => {
    const bars = flat(61)
    bars[60] = { close: 120, low: 120, date: "d60" }
    const base = scheme("BASE")
    const sim = simulateEpisode(bars, 0, base.weights, base.rule)
    assert.equal(sim.d60, 10)
    assert.equal(deployedFraction(base.weights, sim.fills), 0.5)
  })

  it("does not spend the second half on an intraday low", () => {
    const bars = flat(61)
    bars[4] = { close: 96, low: 80, date: "d4" }
    const a = scheme("A")
    const sim = simulateEpisode(bars, 0, a.weights, a.rule)
    assert.equal(sim.fills[1], null)
    assert.equal(deployedFraction(a.weights, sim.fills), 0.5)
  })

  it("fills D's -5% and -10% lines on the first closes that reach them", () => {
    const bars = flat(61)
    bars[3] = { close: 94, low: 94, date: "d3" }
    bars[8] = { close: 88, low: 70, date: "d8" }
    const d = scheme("D")
    const sim = simulateEpisode(bars, 0, d.weights, d.rule)
    assert.deepEqual(sim.fills, [0, 3, 8])
    assert.equal(bars[sim.fills[1]].close, 94)
    assert.equal(bars[sim.fills[2]].close, 88)
    assert.equal(deployedFraction(d.weights, sim.fills), 1)
  })

  it("leaves the last 25% in cash when -10% never closes", () => {
    const bars = flat(61)
    bars[4] = { close: 94, low: 80, date: "d4" }
    const d = scheme("D")
    const sim = simulateEpisode(bars, 0, d.weights, d.rule)
    assert.equal(sim.fills[1], 4)
    assert.equal(sim.fills[2], null)
    assert.equal(deployedFraction(d.weights, sim.fills), 0.75)
    assert.equal(sim.daysToFull, null)
    assert.equal(sim.d60, 1.6)
  })
})

describe("universe", () => {
  it("keeps the 48 names and the frozen thresholds", () => {
    assertNoEtfInStudyUniverse()
    assert.equal(EQUITY_CANDIDATES.length, 48)
    assert.equal(FROZEN_THRESHOLDS.rsiMax, 36)
    assert.equal(FROZEN_THRESHOLDS.ma20DevMax, -4.2)
    assert.deepEqual(CAPITAL_SCHEMES.map((s) => s.id), ["BASE", "A", "B", "C", "D"])
  })
})
