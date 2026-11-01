/**
 * node --test scripts/equity-sell-backtest-v13.test.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
import { volatilityBlock } from "./lib/equity-sell-backtest-v7.mjs"
import {
  SELECTED_STRATEGY,
  assertBaseline,
  attachProfile,
  baselineLinks,
  bootstrapSpearman,
  extremeLinks,
  judgeRobustness,
  loadOhlcv,
  mulberry32,
  periodOf,
  selectMildEvents,
  tailBands,
} from "./lib/equity-sell-backtest-v13.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  return loadOhlcv(bars)
}

function fake(id, atr, ticker = "AAA") {
  return { eventId: id, ticker, predictors: { atrPct: atr }, lowDay: 1, lowToWindow: atr, fromLow: { t20: atr }, hits: { "10": { days: 1, reached: true } }, entryPath: { window: atr } }
}

describe("equity sell backtest v13", () => {
  it("keeps the fixed cuts, periods, and robustness labels", () => {
    assert.equal(SELECTED_STRATEGY, null)
    const events = Array.from({ length: 100 }, (_, index) => fake(`E${String(index).padStart(3, "0")}`, index + 1))
    const tagged = tailBands(events, 0.25)
    assert.equal(tagged.filter((event) => event.tail === "LOW").length, 25)
    assert.equal(tagged.filter((event) => event.tail === "HIGH").length, 25)
    assert.equal(periodOf("2018-06-01"), "A")
    assert.equal(periodOf("2022-01-03"), "B")
    assert.equal(periodOf("2024-02-01"), "C")
    assert.equal(periodOf("2015-12-31"), "outside")
    const dropped = extremeLinks(events.map((event) => ({ ...event, t0Date: "2020-01-01" })))
    assert.equal(dropped.dropHigh1.n, 99)
    assert.equal(judgeRobustness([
      { id: "tail25", lowWindow: { rho: 0.3, n: 40 }, lowT20: { rho: 0.3, n: 40 }, hit10: { rho: -0.2, n: 40 } },
      { id: "first", lowWindow: { rho: 0.25, n: 20 }, lowT20: { rho: 0.2, n: 20 }, hit10: { rho: -0.2, n: 20 } },
    ]).label, "견고")
    assert.equal(judgeRobustness([
      { id: "tail25", lowWindow: { rho: -0.1, n: 40 }, lowT20: { rho: 0.2, n: 40 }, hit10: { rho: -0.2, n: 40 } },
      { id: "first", lowWindow: { rho: 0.3, n: 20 }, lowT20: { rho: 0.2, n: 20 }, hit10: { rho: -0.2, n: 20 } },
    ]).label, "불안정")
    assert.equal(judgeRobustness([
      { id: "tail25", lowWindow: { rho: 0.05, n: 40 }, lowT20: { rho: 0.2, n: 40 }, hit10: { rho: -0.2, n: 40 } },
      { id: "first", lowWindow: { rho: 0.3, n: 20 }, lowT20: { rho: 0.2, n: 20 }, hit10: { rho: -0.2, n: 20 } },
    ]).label, "부분적으로 견고")
    assert.equal(judgeRobustness([
      { id: "periodC", lowWindow: { rho: null, n: 4 }, lowT20: { rho: null, n: 4 }, hit10: { rho: null, n: 4 } },
      { id: "first", lowWindow: { rho: 0.3, n: 4 }, lowT20: { rho: 0.2, n: 4 }, hit10: { rho: -0.2, n: 4 } },
    ]).label, "표본 부족")
    const pairs = [1, 2, 3, 4, 5].map((value) => ({ x: value, y: value }))
    const rng = mulberry32(7)
    const once = bootstrapSpearman(pairs, 30, rng)
    assert.equal(once.reps, 30)
    assert.ok(once.p2_5 <= once.p97_5)
  })

  it("keeps the correction-day ATR fixed when a later bar changes", () => {
    const closes = Array.from({ length: 40 }, () => 100)
    const highs = closes.map((close) => close + 1)
    const lows = closes.map((close) => close - 1)
    const before = volatilityBlock(highs, lows, closes, 20)
    closes[30] = 140
    highs[30] = 150
    lows[30] = 130
    const after = volatilityBlock(highs, lows, closes, 20)
    assert.equal(after.atrPct, before.atrPct)
  })

  it("reproduces the stored 103-event ATR baseline", () => {
    const v6 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v6-result.json"), "utf8"))
    const selected = selectMildEvents(v6.events)
    const needed = [...new Set(selected.map((event) => event.ticker))]
    const series = new Map(needed.map((symbol) => [symbol, loadSeries(symbol)]))
    const events = attachProfile(selected, series)
    const links = baselineLinks(events)
    assert.doesNotThrow(() => assertBaseline(events, links))
    assert.equal(events.filter((event) => event.leadershipGroup === "HIGH").length, 15)
    assert.equal(events.filter((event) => event.leadershipGroup === "MID").length, 53)
    assert.equal(events.filter((event) => event.leadershipGroup === "LOW").length, 35)
  })
})
