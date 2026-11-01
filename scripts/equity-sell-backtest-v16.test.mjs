/**
 * node --test scripts/equity-sell-backtest-v16.test.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
import { atrPctAt } from "./lib/equity-sell-backtest-v8.mjs"
import {
  SELECTED_STRATEGY,
  assertBaseline,
  attachSplit,
  baselineLinks,
  judgeSplit,
  loadOhlcv,
  priorAtr,
  selectMildEvents,
} from "./lib/equity-sell-backtest-v16.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  return loadOhlcv(bars)
}

describe("equity sell backtest v16", () => {
  it("keeps the prior ATR window before the correction close", () => {
    assert.equal(SELECTED_STRATEGY, null)
    const closes = Array.from({ length: 120 }, (_, index) => 100 + (index % 5))
    const highs = closes.map((close) => close + 2)
    const lows = closes.map((close) => close - 1)
    const before = priorAtr(highs, lows, closes, 90, 60)
    assert.equal(before.n, 60)
    assert.ok(Math.abs(before.median + before.gap - atrPctAt(highs, lows, closes, 90)) < 1e-12)
    closes[100] = 180
    highs[100] = 190
    lows[100] = 170
    assert.deepEqual(priorAtr(highs, lows, closes, 90, 60), before)
    assert.equal(judgeSplit({
      n: 80, withinRho: 0.3, betweenRho: 0.2, eventRho: 0.4, lowT20: 0.2, hit10: -0.2, feCoef: 0.4,
      first: { n: 20, rho: 0.2 }, last: { n: 20, rho: 0.2 }, flips: [], periods: [{ n: 20, rho: 0.2 }, { n: 20, rho: 0.2 }, { n: 20, rho: 0.2 }],
    }).label, "A")
    assert.equal(judgeSplit({
      n: 80, withinRho: 0.02, betweenRho: 0.3, eventRho: 0.4, lowT20: 0.01, hit10: 0.1, feCoef: 0.01,
      first: { n: 20, rho: 0.01 }, last: { n: 20, rho: -0.02 }, flips: ["AAA"], periods: [{ n: 20, rho: 0.01 }, { n: 20, rho: -0.02 }, { n: 20, rho: 0.02 }],
    }).label, "B")
    assert.equal(judgeSplit({
      n: 80, withinRho: 0.2, betweenRho: 0.2, eventRho: 0.4, lowT20: 0.2, hit10: -0.2, feCoef: 0.2,
      first: { n: 20, rho: 0.2 }, last: { n: 20, rho: 0.2 }, flips: [], periods: [{ n: 20, rho: 0.2 }, { n: 20, rho: -0.1 }, { n: 20, rho: 0.2 }],
    }).label, "C")
    assert.equal(judgeSplit({
      n: 8, withinRho: 0.3, betweenRho: 0.2, eventRho: 0.4, lowT20: 0.2, hit10: -0.2, feCoef: 0.2,
      first: { n: 4, rho: 0.2 }, last: { n: 4, rho: 0.2 }, flips: [], periods: [{ n: 3, rho: 0.2 }],
    }).label, "D")
  })

  it("reproduces the stored 103-event ATR baseline before the within split", () => {
    const v6 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v6-result.json"), "utf8"))
    const selected = selectMildEvents(v6.events)
    const needed = [...new Set(selected.map((event) => event.ticker))]
    const series = new Map(needed.map((symbol) => [symbol, loadSeries(symbol)]))
    const events = attachSplit(selected, series, loadSeries("SPY"))
    assert.doesNotThrow(() => assertBaseline(events, baselineLinks(events)))
    const covered = events.filter((event) => Number.isFinite(event.predictors.withinAtr))
    assert.ok(covered.length >= 10)
    for (const event of covered) {
      assert.ok(Math.abs(event.predictors.atrPct - (event.predictors.betweenAtr + event.predictors.withinAtr)) < 1e-10)
    }
  })
})
