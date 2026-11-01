/**
 * node --test scripts/equity-sell-backtest-v15.test.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
import { volatilityBlock } from "./lib/equity-sell-backtest-v7.mjs"
import {
  DESCRIPTIVE_SHAPE,
  MODEL_SHAPE,
  SELECTED_STRATEGY,
  assertBaseline,
  attachShape,
  atrPath,
  baselineLinks,
  episodePercentile,
  levelHeld,
  linearSlope,
  loadOhlcv,
  selectMildEvents,
  shapeFromPoints,
} from "./lib/equity-sell-backtest-v15.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  return loadOhlcv(bars)
}

describe("equity sell backtest v15", () => {
  it("keeps the peak-to-entry ATR path on information through the correction close", () => {
    assert.equal(SELECTED_STRATEGY, null)
    assert.deepEqual(MODEL_SHAPE, ["atrChange", "atrRatio", "atrSlope"])
    for (const key of DESCRIPTIVE_SHAPE) assert.equal(MODEL_SHAPE.includes(key), false)
    assert.equal(linearSlope([{ x: 0, y: 2 }, { x: 1, y: 5 }]), 3)
    assert.equal(episodePercentile([1, 2, 3, 4], 3), 62.5)
    const flat = shapeFromPoints([{ index: 10, x: 0, y: 0 }, { index: 11, x: 1, y: 0.04 }], 10, 11, 0)
    assert.equal(flat.atrRatio, null)
    assert.equal(flat.atrSlope, 0.04)
    assert.equal(levelHeld(0.4, 0.3), true)
    assert.equal(levelHeld(0.4, 0.15), false)
    const closes = Array.from({ length: 40 }, () => 100)
    const highs = closes.map((close) => close + 2)
    const lows = closes.map((close) => close - 2)
    const series = { highs, lows, closes }
    const before = atrPath(series, 20, 30)
    closes[35] = 140
    highs[35] = 150
    lows[35] = 130
    const after = atrPath(series, 20, 30)
    assert.deepEqual(after, before)
    assert.equal(volatilityBlock(highs, lows, closes, 30).atrPct, volatilityBlock(series.highs, series.lows, series.closes, 30).atrPct)
  })

  it("reproduces the stored 103-event ATR baseline from the same correction path", () => {
    const v6 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v6-result.json"), "utf8"))
    const selected = selectMildEvents(v6.events)
    const needed = [...new Set(selected.map((event) => event.ticker))]
    const series = new Map(needed.map((symbol) => [symbol, loadSeries(symbol)]))
    const events = attachShape(selected, series, loadSeries("SPY"))
    assert.doesNotThrow(() => assertBaseline(events, baselineLinks(events)))
    assert.ok(events.every((event) => event.predictors.correctionDuration >= 1))
    assert.ok(events.some((event) => Number.isFinite(event.predictors.atrRatio)))
  })
})
