/**
 * node --test scripts/equity-sell-backtest-v17.test.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
import {
  MARKET_DROP,
  SELECTED_STRATEGY,
  assertBaseline,
  attachRegime,
  attachSplit,
  judgeRegime,
  loadOhlcv,
  selectMildEvents,
  spyFeatures,
} from "./lib/equity-sell-backtest-v17.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  return loadOhlcv(bars)
}

describe("equity sell backtest v17", () => {
  it("keeps SPY regime inputs on information through the correction close", () => {
    assert.equal(SELECTED_STRATEGY, null)
    assert.equal(MARKET_DROP, -0.05)
    const closes = Array.from({ length: 260 }, (_, index) => 100 + index * 0.1)
    const highs = closes.map((close) => close + 1)
    const lows = closes.map((close) => close - 1)
    const dates = closes.map((_, index) => `2020-${String(index).padStart(4, "0")}`)
    const series = { dates, highs, lows, closes }
    const before = spyFeatures(series, dates[220])
    assert.ok(before.spyRet20 > 0)
    assert.ok(before.spyDist200 > 0)
    closes[240] = 40
    highs[240] = 50
    lows[240] = 30
    assert.equal(spyFeatures(series, dates[220]).spyRet20, before.spyRet20)
    assert.equal(spyFeatures(series, dates[220]).spyAtr, before.spyAtr)
    assert.equal(spyFeatures(series, "2099-01-01"), null)
    assert.equal(judgeRegime({
      n: 100, t20n: 50, event20: 0.2, event20T20: 0.2, bullEvent: 0.4, bearEvent: 0.1,
      within20: 0.01, within20T20: 0.01, bullWithin: 0.1, bearWithin: 0.1,
      eventVol: 0.01, eventVolT20: 0.01, volHighEvent: 0.2, volLowEvent: 0.2,
      withinVol: 0.01, withinVolT20: 0.01, volHighWithin: 0.1, volLowWithin: 0.1,
      eventAfterVol: 0.3, withinAfterVol: 0.2,
    }).label, "A")
    assert.equal(judgeRegime({
      n: 100, t20n: 50, event20: 0.02, event20T20: -0.2, bullEvent: 0.2, bearEvent: 0.2,
      within20: 0.02, within20T20: 0.02, bullWithin: 0.1, bearWithin: 0.1,
      eventVol: 0.02, eventVolT20: 0.02, volHighEvent: 0.2, volLowEvent: 0.2,
      withinVol: -0.2, withinVolT20: 0.2, volHighWithin: 0.05, volLowWithin: 0.3,
      eventAfterVol: 0.02, withinAfterVol: 0.03,
    }).label, "C")
    assert.equal(judgeRegime({
      n: 100, t20n: 50, event20: 0.05, event20T20: 0.05, bullEvent: 0.2, bearEvent: 0.18,
      within20: -0.04, within20T20: 0.04, bullWithin: 0.1, bearWithin: 0.12,
      eventVol: 0.03, eventVolT20: 0.03, volHighEvent: 0.2, volLowEvent: 0.19,
      withinVol: 0.02, withinVolT20: 0.02, volHighWithin: 0.11, volLowWithin: 0.1,
      eventAfterVol: 0.29, withinAfterVol: 0.12,
    }).label, "B")
    assert.equal(judgeRegime({ n: 8 }).label, "D")
  })

  it("reproduces the stored ATR baseline and the v16 within split", () => {
    const v6 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v6-result.json"), "utf8"))
    const selected = selectMildEvents(v6.events)
    const needed = [...new Set(selected.map((event) => event.ticker))]
    const series = new Map(needed.map((symbol) => [symbol, loadSeries(symbol)]))
    const spy = loadSeries("SPY")
    const events = attachRegime(attachSplit(selected, series, spy), spy)
    assert.doesNotThrow(() => assertBaseline(events))
    assert.ok(events.filter((event) => Number.isFinite(event.predictors.spyRet20)).length >= 10)
  })
})
