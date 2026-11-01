/**
 * node --test scripts/equity-sell-research-universe.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { ACTIVE_UNIVERSE, CORE_UNIVERSE, WATCH_UNIVERSE } from "./lib/equity-daily-bottom-buy-universe.mjs"
import { equityUniverse } from "./lib/equity-daily-bottom-buy.mjs"
import {
  EQUITY_SELL_RESEARCH_ADDED,
  EQUITY_SELL_RESEARCH_ORIGINAL,
  EQUITY_SELL_RESEARCH_SELECTED_STRATEGY,
  EQUITY_SELL_RESEARCH_UNIVERSE,
} from "./lib/equity-sell-research-universe.mjs"

const ORIGINAL = [
  "AMZN", "AAPL", "AMAT", "ASML", "AVGO", "CEG", "ETN", "FCX", "FTNT", "GOOGL",
  "LRCX", "LLY", "MU", "NVDA", "ORCL", "PANW", "PLTR", "TSLA", "TSM", "VST",
]
const ADDED = ["KLAC", "ANET", "VRT", "PWR", "V", "MSFT", "GEV", "ISRG", "SNPS", "AMD", "CRWD"]

describe("equity sell research universe", () => {
  it("locks 31 names, Fortinet as FTNT, and no duplicate ticker", () => {
    const symbols = EQUITY_SELL_RESEARCH_UNIVERSE.map((row) => row.symbol)
    assert.equal(EQUITY_SELL_RESEARCH_SELECTED_STRATEGY, null)
    assert.equal(symbols.length, 31)
    assert.equal(new Set(symbols).size, 31)
    assert.equal(symbols.includes("FNTN"), false)
    assert.deepEqual(symbols.slice(0, 20), ORIGINAL)
    assert.deepEqual(symbols.slice(20), ADDED)
    assert.equal(EQUITY_SELL_RESEARCH_UNIVERSE.find((row) => row.symbol === "FTNT").name, "Fortinet")
    assert.equal(EQUITY_SELL_RESEARCH_UNIVERSE.find((row) => row.symbol === "CRWD").role, "CORE")
  })

  it("keeps the original core and watch roles and marks the 11 additions as core", () => {
    for (const row of EQUITY_SELL_RESEARCH_ORIGINAL) {
      const expected = CORE_UNIVERSE.includes(row.symbol) ? "CORE" : "WATCH"
      assert.equal(WATCH_UNIVERSE.includes(row.symbol) || CORE_UNIVERSE.includes(row.symbol), true)
      assert.equal(row.role, expected)
    }
    assert.deepEqual(EQUITY_SELL_RESEARCH_ADDED.map((row) => row.role), ADDED.map(() => "CORE"))
  })

  it("does not change the 20-name screen scan", () => {
    assert.deepEqual(ACTIVE_UNIVERSE, ORIGINAL)
    assert.equal(CORE_UNIVERSE.length, 10)
    assert.equal(WATCH_UNIVERSE.length, 10)
    assert.deepEqual(equityUniverse().map((row) => row.symbol), ORIGINAL)
    assert.equal(equityUniverse().some((row) => ADDED.includes(row.symbol)), false)
  })
})
