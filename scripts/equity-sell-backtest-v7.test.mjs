/**
 * node --test scripts/equity-sell-backtest-v7.test.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import { describeRebound } from "./lib/equity-sell-backtest-v6.mjs"
import {
  SELECTED_STRATEGY,
  correctionBlock,
  fitModel,
  leaveOneCorrelation,
  loadOhlcv,
  postEntryVolume,
  predictorBlock,
  sampleStdev,
  selectMildEvents,
  stockWeightedPredictors,
  volatilityBlock,
  volumeBlock,
} from "./lib/equity-sell-backtest-v7.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function barsFrom(closes, volumeAt = () => 100) {
  return closes.map((close, index) => ({
    date: `2020-01-${String(index + 1).padStart(2, "0")}`,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: volumeAt(index),
  }))
}

describe("equity sell backtest v7", () => {
  it("keeps predictors on entry-time volume, ATR, and volatility", () => {
    assert.equal(SELECTED_STRATEGY, null)
    assert.equal(EQUITY_SELL_RESEARCH_UNIVERSE.length, 31)
    const volumes = [1, 1, 1, 1, 1, 10, 999999]
    const block = volumeBlock(volumes, 5)
    assert.equal(block.entryVolume, 10)
    assert.equal(block.avgVolume5, 1)
    assert.equal(block.volumeRatio5, 10)
    assert.equal(volumeBlock(volumes, 3).avgVolume20, null)
    const changed = volumeBlock(volumes.map((value, index) => (index > 5 ? 1 : value)), 5)
    assert.equal(changed.volumeRatio5, block.volumeRatio5)
    const flat = Array.from({ length: 20 }, () => 100)
    const atr = volatilityBlock(flat.map((close) => close + 1), flat.map((close) => close - 1), flat, 19)
    assert.equal(atr.atr14, 2)
    assert.ok(Math.abs(atr.atrPct - 0.02) < 1e-12)
    const wave = [100, 110, 100, 110, 100, 110]
    const returns = []
    for (let index = 1; index <= 5; index++) returns.push(wave[index] / wave[index - 1] - 1)
    const vol = volatilityBlock(wave.map((close) => close + 1), wave.map((close) => close - 1), wave, 5)
    assert.ok(Math.abs(vol.vol5 - sampleStdev(returns) * Math.sqrt(252)) < 1e-9)
  })

  it("counts peak-to-entry sessions and leaves a missed field empty", () => {
    const closes = Array.from({ length: 80 }, () => 100)
    closes[10] = 120
    for (let index = 11; index <= 14; index++) closes[index] = 115
    closes[15] = 108
    const volumes = Array.from({ length: 80 }, () => 1000)
    const correction = correctionBlock(closes, volumes, 0, 15)
    assert.equal(correction.matched, true)
    assert.equal(correction.correctionDuration, 5)
    assert.ok(Math.abs(correction.peakToEntry + 0.1) < 1e-12)
    assert.equal(correctionBlock(closes, volumes, 0, 14).matched, false)
    const series = loadOhlcv(barsFrom(closes, (index) => (index > 15 ? 500000 : 1000)))
    const before = predictorBlock(series, 0, 15)
    series.volumes[16] = 1
    const after = predictorBlock(series, 0, 15)
    assert.equal(after.volumeRatio20, before.volumeRatio20)
    assert.equal(after.correctionDuration, before.correctionDuration)
    const described = describeRebound(closes, 0, 15, 100)
    const descriptive = postEntryVolume(series, 0, 15, described)
    assert.equal(Object.hasOwn(before, "t1to3"), false)
    assert.ok(descriptive.role === "descriptive")
  })

  it("weights tickers once and checks every leave-one-out removal", () => {
    const events = [
      { ticker: "AMD", leadershipGroup: "HIGH", leadershipScore: 80, t0: -0.02, predictors: { volumeRatio20: 2 }, outcomes: { window: 0.2 } },
      { ticker: "AMD", leadershipGroup: "HIGH", leadershipScore: 80, t0: -0.02, predictors: { volumeRatio20: 4 }, outcomes: { window: 0.4 } },
      { ticker: "AAPL", leadershipGroup: "LOW", leadershipScore: 10, t0: -0.01, predictors: { volumeRatio20: 1 }, outcomes: { window: 0.1 } },
    ]
    const stock = stockWeightedPredictors(events).find((row) => row.id === "volumeRatio20")
    assert.equal(stock.highTickers, 1)
    assert.equal(stock.high, 3)
    assert.equal(stock.low, 1)
    const held = leaveOneCorrelation(
      events,
      (event) => event.leadershipScore,
      (event) => event.outcomes.window,
      [{ symbol: "AMD" }, { symbol: "AAPL" }, { symbol: "MSFT" }],
    )
    assert.equal(held.rows.reduce((sum, row) => sum + row.removed, 0), 3)
    assert.equal(held.rows.find((row) => row.ticker === "MSFT").rho, held.baseline.rho)
    const fit = fitModel(
      [
        { y: 1, t0: 0, leadership: 0 },
        { y: 3, t0: 1, leadership: 0 },
        { y: 5, t0: 2, leadership: 0 },
        { y: 4, t0: 0, leadership: 1 },
        { y: 6, t0: 1, leadership: 1 },
        { y: 8, t0: 2, leadership: 1 },
      ],
      ["t0", "leadership"],
    )
    assert.equal(fit.n, 6)
    assert.equal(fit.r2, 1)
  })

  it("matches the stored v6 mild identities, scores, groups, and T0 values", () => {
    const v6 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v6-result.json"), "utf8"))
    const events = selectMildEvents(v6.events)
    assert.equal(events.length, 103)
    assert.deepEqual(events.map((event) => event.eventId), v6.events.map((event) => event.eventId))
    assert.deepEqual(events.map((event) => event.ticker), v6.events.map((event) => event.ticker))
    assert.deepEqual(events.map((event) => event.t0Date), v6.events.map((event) => event.t0Date))
    assert.deepEqual(events.map((event) => event.t0), v6.events.map((event) => event.t0))
    assert.deepEqual(events.map((event) => event.leadershipScore), v6.events.map((event) => event.leadershipScore))
    assert.deepEqual(events.map((event) => event.leadershipGroup), v6.events.map((event) => event.leadershipGroup))
    assert.equal(events.filter((event) => event.leadershipGroup === "HIGH").length, 15)
    assert.equal(events.filter((event) => event.leadershipGroup === "MID").length, 53)
    assert.equal(events.filter((event) => event.leadershipGroup === "LOW").length, 35)
  })
})
