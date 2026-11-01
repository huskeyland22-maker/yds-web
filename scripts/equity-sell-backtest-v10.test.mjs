/**
 * node --test scripts/equity-sell-backtest-v10.test.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
import { describeRebound } from "./lib/equity-sell-backtest-v6.mjs"
import { loadOhlcv, selectMildEvents } from "./lib/equity-sell-backtest-v7.mjs"
import { studyFactors } from "./lib/equity-sell-backtest-v9.mjs"
import {
  SELECTED_STRATEGY,
  attachDepth,
  depthBucket,
  judgeDepthPath,
  priceIdentity,
} from "./lib/equity-sell-backtest-v10.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  return loadOhlcv(bars)
}

function correctionSeries() {
  const closes = Array.from({ length: 100 }, () => 100)
  closes[30] = 120
  for (let index = 31; index <= 34; index++) closes[index] = 115
  closes[35] = 108
  return {
    highs: closes.map((close) => close + 1),
    lows: closes.map((close) => close - 1),
    closes,
    volumes: closes.map(() => 1000),
  }
}

describe("equity sell backtest v10", () => {
  it("keeps the price identity and the drawdown bucket edges", () => {
    assert.equal(SELECTED_STRATEGY, null)
    const identity = priceIdentity(-0.1, 0.2, 0.08)
    assert.equal(identity.matched, true)
    assert.equal(priceIdentity(-0.1, 0.2, 0.1).matched, false)
    assert.equal(depthBucket(0.049), "lt5")
    assert.equal(depthBucket(0.05), "m5")
    assert.equal(depthBucket(0.1), "m10")
    assert.equal(depthBucket(0.15), "ge15")
    assert.equal(judgeDepthPath({ depthRho: 0.4, reboundRho: 0.41, partialDepth: 0.05, partialAll: 0.04 }), "A")
    assert.equal(judgeDepthPath({ depthRho: 0.05, reboundRho: 0.41, partialDepth: 0.36, partialAll: 0.3 }), "B")
    assert.equal(judgeDepthPath({ depthRho: 0.25, reboundRho: 0.41, partialDepth: 0.22, partialAll: 0.18 }), "C")
  })

  it("keeps predictors fixed when a later close makes the low deeper", () => {
    const series = correctionSeries()
    const before = studyFactors(series, 20, 35)
    const described = describeRebound(series.closes, 20, 35, series.closes[20])
    series.closes[50] = 70
    const later = describeRebound(series.closes, 20, 35, series.closes[20])
    assert.ok(later.lowReturnFromEntry < described.lowReturnFromEntry)
    assert.deepEqual(studyFactors(series, 20, 35), before)
    assert.equal(priceIdentity(later.lowReturnFromEntry, later.lowToWindowReturn, later.fromEntry.windowEnd).matched, true)
  })

  it("matches the stored v9 events, ATR bands, and window returns", () => {
    const v6 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v6-result.json"), "utf8"))
    const v9 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v9-result.json"), "utf8"))
    const selected = selectMildEvents(v6.events)
    const needed = [...new Set(selected.map((event) => event.ticker))]
    const series = new Map(needed.map((symbol) => [symbol, loadSeries(symbol)]))
    const events = attachDepth(selected, series)
    assert.equal(events.length, 103)
    assert.equal(events.filter((event) => event.leadershipGroup === "HIGH").length, 15)
    assert.equal(events.filter((event) => event.leadershipGroup === "MID").length, 53)
    assert.equal(events.filter((event) => event.leadershipGroup === "LOW").length, 35)
    assert.equal(events.filter((event) => Number.isFinite(event.drawdown)).length, 102)
    assert.deepEqual(events.bandCounts, { LOW: 34, MID: 34, HIGH: 35 })
    for (let index = 0; index < events.length; index++) {
      const prior = v9.events[index]
      const event = events[index]
      assert.equal(event.eventId, prior.eventId)
      assert.equal(event.leadershipGroup, prior.leadershipGroup)
      assert.equal(event.atrBand, prior.atrBand)
      assert.ok(Math.abs(event.atrPct - prior.atrPct) <= 1e-10)
      assert.ok(Math.abs(event.entryToWindow - prior.entry.window) <= 1e-10)
      if (prior.low.window == null) assert.equal(event.lowToWindow, null)
      else assert.ok(Math.abs(event.lowToWindow - prior.low.window) <= 1e-10)
      if (Number.isFinite(event.lowReturn)) assert.equal(priceIdentity(event.lowReturn, event.lowToWindow, event.entryToWindow).matched, true)
    }
  })
})
