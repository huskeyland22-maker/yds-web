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
import {
  closeTickerPicker,
  equityResearchDisplayList,
  equityTickerLabel,
  initialTickerPickerState,
  toggleTickerPicker,
  equitySummaryRow,
  visibleResearchStocks,
} from "../vite-project/src/utils/equityResearchDisplay.js"

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

  it("starts collapsed and labels tickers without CORE or WATCH", () => {
    const shown = equityResearchDisplayList()
    const labels = shown.map((row) => equityTickerLabel(row))
    assert.equal(initialTickerPickerState().open, false)
    const opened = toggleTickerPicker(initialTickerPickerState())
    assert.equal(opened.open, true)
    assert.equal(closeTickerPicker().open, false)
    assert.equal(equityTickerLabel(shown.find((row) => row.symbol === "AMZN")), "AMZN · Amazon · 아마존")
    assert.equal(equityTickerLabel(shown.find((row) => row.symbol === "NVDA")), "NVDA · NVIDIA · 엔비디아")
    assert.equal(equityTickerLabel(shown.find((row) => row.symbol === "CRWD")), "CRWD · CrowdStrike · 크라우드스트라이크")
    assert.equal(labels.some((label) => label.includes("CORE") || label.includes("WATCH")), false)
    assert.deepEqual(visibleResearchStocks(shown, { query: "엔비디아" }).map((row) => row.symbol), ["NVDA"])
    assert.deepEqual(visibleResearchStocks(shown, { query: "NVIDIA" }).map((row) => row.symbol), ["NVDA"])
    assert.deepEqual(visibleResearchStocks(shown, { query: "NVDA" }).map((row) => row.symbol), ["NVDA"])
    assert.deepEqual(visibleResearchStocks(shown, { query: "크라우드스트라이크" }).map((row) => row.symbol), ["CRWD"])
  })

  it("keeps an unscored summary blank and shows a real zero", () => {
    assert.deepEqual(equitySummaryRow(null), { countText: "—", stageLabel: "—", stageClass: "wait" })
    assert.deepEqual(equitySummaryRow({ ok: false, score: null }), { countText: "—", stageLabel: "—", stageClass: "wait" })
    assert.equal(equitySummaryRow({ ok: true, score: 0, state: { id: "wait", label: "WAIT" } }).countText, "0/4")
    assert.equal(equitySummaryRow({ ok: true, score: 2, state: { id: "interest", label: "INTEREST" } }).stageLabel, "INTEREST")
    assert.equal(equitySummaryRow({ ok: true, score: 3, state: { id: "firstBuy", label: "FIRST BUY CANDIDATE" } }).stageClass, "primary")
    assert.equal(equitySummaryRow({ ok: true, score: 4, state: { id: "strongLow", label: "STRONG LOW CANDIDATE" } }).stageClass, "strong")
  })
})
