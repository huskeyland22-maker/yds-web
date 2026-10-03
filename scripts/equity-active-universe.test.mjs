/**
 * node --test scripts/equity-active-universe.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { EQUITY_CANDIDATES } from "./lib/daily-bottom-buy-cross-asset-validation.mjs"
import {
  ACTIVE_UNIVERSE,
  CORE_UNIVERSE,
  FUTURE_WATCH_UNIVERSE,
  LEGACY_UNIVERSE,
  RESEARCH_UNIVERSE,
  WATCH_UNIVERSE,
  equityUniverse,
  findEquityCandidate,
} from "./lib/equity-daily-bottom-buy.mjs"

const ACTIVE = [
  "AMZN", "AAPL", "AMAT", "ASML", "AVGO", "CEG", "ETN", "FCX", "FTNT", "GOOGL",
  "LRCX", "LLY", "MU", "NVDA", "ORCL", "PANW", "PLTR", "TSLA", "TSM", "VST",
]

function unique(list) {
  return new Set(list).size === list.length
}

describe("equity operating universe", () => {
  it("keeps active, core, and watch counts and the scan order", () => {
    assert.equal(ACTIVE_UNIVERSE.length, 20)
    assert.equal(CORE_UNIVERSE.length, 10)
    assert.equal(WATCH_UNIVERSE.length, 10)
    assert.deepEqual(ACTIVE_UNIVERSE, ACTIVE)
    assert.deepEqual(equityUniverse().map((row) => row.symbol), ACTIVE)
  })

  it("partitions active into core and watch with no overlap", () => {
    const core = new Set(CORE_UNIVERSE)
    const watch = new Set(WATCH_UNIVERSE)
    assert.deepEqual([...core].filter((symbol) => watch.has(symbol)), [])
    assert.deepEqual([...ACTIVE_UNIVERSE].sort(), [...core, ...watch].sort())
    for (const row of equityUniverse()) {
      assert.equal(row.priority, core.has(row.symbol) ? "CORE" : "WATCH")
    }
  })

  it("keeps future watch off the scan list and preserves the 48-name research universe", () => {
    const active = new Set(ACTIVE_UNIVERSE)
    assert.equal(unique(FUTURE_WATCH_UNIVERSE), true)
    assert.deepEqual(FUTURE_WATCH_UNIVERSE.filter((symbol) => active.has(symbol)), [])
    assert.equal(unique(ACTIVE_UNIVERSE), true)
    assert.equal(LEGACY_UNIVERSE, EQUITY_CANDIDATES)
    assert.equal(RESEARCH_UNIVERSE, EQUITY_CANDIDATES)
    assert.equal(EQUITY_CANDIDATES.length, 48)
    assert.equal(findEquityCandidate("CRWD")?.priority, null)
    assert.equal(findEquityCandidate("GEV")?.symbol, "GEV")
    assert.equal(findEquityCandidate("MSFT"), null)
    assert.equal(EQUITY_CANDIDATES.some((row) => row.symbol === "MSFT"), true)
    assert.equal(equityUniverse().some((row) => row.symbol === "GEV"), false)
  })
})
