/**
 * node --test scripts/equity-research-display.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { equityUniverse } from "./lib/equity-daily-bottom-buy.mjs"
import {
  EQUITY_SELL_RESEARCH_SELECTED_STRATEGY,
  EQUITY_SELL_RESEARCH_UNIVERSE,
} from "./lib/equity-sell-research-universe.mjs"
import { equityResearchDisplayList, visibleResearchStocks } from "../vite-project/src/utils/equityResearchDisplay.js"

const EXPECTED = [
  "AMZN", "AAPL", "AMAT", "ASML", "AVGO", "CEG", "ETN", "FCX", "FTNT", "GOOGL",
  "LRCX", "LLY", "MU", "NVDA", "ORCL", "PANW", "PLTR", "TSLA", "TSM", "VST",
  "KLAC", "ANET", "VRT", "PWR", "V", "MSFT", "GEV", "ISRG", "SNPS", "AMD", "CRWD",
]

describe("equity research display", () => {
  it("shows all 31 research names and leaves the 20-name scan in place", () => {
    assert.equal(EQUITY_SELL_RESEARCH_SELECTED_STRATEGY, null)
    const shown = equityResearchDisplayList()
    const tickers = shown.map((row) => row.symbol)
    assert.equal(tickers.length, 31)
    assert.equal(new Set(tickers).size, 31)
    assert.deepEqual(tickers, EXPECTED)
    assert.deepEqual(tickers, EQUITY_SELL_RESEARCH_UNIVERSE.map((row) => row.symbol))
    assert.equal(visibleResearchStocks(shown).length, 31)
    assert.deepEqual(visibleResearchStocks(shown).map((row) => row.symbol), EXPECTED)
    assert.equal(equityUniverse().length, 20)
    assert.equal(equityUniverse().some((row) => row.symbol === "CRWD"), false)
    assert.equal(equityUniverse().some((row) => row.symbol === "AMD"), false)
  })
})
