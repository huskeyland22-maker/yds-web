/**
 * node --test scripts/equity-sell-backtest-v14.test.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
import { priceStateBlock, volatilityBlock } from "./lib/equity-sell-backtest-v7.mjs"
import { entryLocation } from "./lib/equity-sell-backtest-v12.mjs"
import {
  SELECTED_STRATEGY,
  assertBaseline,
  attachMeaning,
  baselineLinks,
  betaHeld,
  extendedReturns,
  judgeStructure,
  loadOhlcv,
  marketAt,
  selectMildEvents,
} from "./lib/equity-sell-backtest-v14.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  return loadOhlcv(bars)
}

describe("equity sell backtest v14", () => {
  it("keeps pre-entry inputs fixed when a later bar changes", () => {
    assert.equal(SELECTED_STRATEGY, null)
    const closes = Array.from({ length: 180 }, (_, index) => 100 + index)
    const before = priceStateBlock(closes, 150)
    const longer = extendedReturns(closes, 150)
    const place = entryLocation(closes, 150)
    closes[160] = 40
    assert.equal(priceStateBlock(closes, 150).ret20, before.ret20)
    assert.equal(extendedReturns(closes, 150).ret120, longer.ret120)
    assert.equal(entryLocation(closes, 150).pos60, place.pos60)
    const highs = closes.map((close) => close + 1)
    const lows = closes.map((close) => close - 1)
    const dates = closes.map((_, index) => `2020-06-${String(index + 1).padStart(4, "0")}`)
    const series = { dates, highs, lows, closes }
    const market = marketAt(series, dates[150])
    closes[160] = 20
    highs[160] = 30
    lows[160] = 10
    assert.equal(marketAt(series, dates[150]).spyAtr, market.spyAtr)
    assert.equal(marketAt(series, "2099-01-01"), null)
    assert.equal(betaHeld(0.4, 0.3), true)
    assert.equal(betaHeld(0.4, 0.15), false)
    assert.equal(judgeStructure({ marketN: 100, h1: "지지", h4: "지지", h5: "약화" }).label, "B")
    assert.equal(judgeStructure({ marketN: 100, h1: "약화", h4: "지지", h5: "약화" }).label, "C")
    assert.equal(judgeStructure({ marketN: 100, h1: "지지", h4: "반대", h5: "지지" }).label, "C")
    assert.equal(judgeStructure({ marketN: 100, h1: "지지", h4: "지지", h5: "지지" }).label, "A")
    assert.equal(judgeStructure({ marketN: 4, h1: "지지", h4: "지지", h5: "지지" }).label, "D")
    const block = volatilityBlock(highs, lows, closes, 150)
    assert.ok(block.atrPct > 0)
  })

  it("reproduces the stored 103-event ATR baseline on the same correction dates", () => {
    const v6 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v6-result.json"), "utf8"))
    const selected = selectMildEvents(v6.events)
    const needed = [...new Set(selected.map((event) => event.ticker))]
    const series = new Map(needed.map((symbol) => [symbol, loadSeries(symbol)]))
    const events = attachMeaning(selected, series, loadSeries("SPY"))
    const links = baselineLinks(events)
    assert.doesNotThrow(() => assertBaseline(events, links))
    const dated = events.filter((event) => Number.isFinite(event.predictors.relativeAtr))
    assert.ok(dated.length >= 10)
    for (const event of dated) {
      assert.ok(Math.abs(event.predictors.relativeAtr - event.predictors.atrPct / event.predictors.spyAtr) < 1e-12)
    }
  })
})
