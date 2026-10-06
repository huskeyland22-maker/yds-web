/**
 * node --test scripts/equity-sell-backtest-v20.test.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
import {
  SELECTED_STRATEGY,
  assertBaseline,
  attachHold,
  attachRegime,
  attachSplit,
  buildHold,
  judgeHold,
  loadOhlcv,
  selectMildEvents,
  study,
} from "./lib/equity-sell-backtest-v20.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  return loadOhlcv(bars)
}

describe("equity sell backtest v20", () => {
  it("measures holding from the correction close and does not swap T+40 with the window", () => {
    assert.equal(SELECTED_STRATEGY, null)
    const closes = Array.from({ length: 70 }, () => 100)
    closes[10] = 100
    closes[11] = 101
    closes[50] = 80
    closes[60] = 110
    const hold = buildHold(closes, 0, 10)
    assert.equal(hold.returns.t0, 0)
    assert.ok(Math.abs(hold.returns.t1 - 0.01) < 1e-12)
    assert.ok(Math.abs(hold.returns.t40 + 0.2) < 1e-12)
    assert.ok(Math.abs(hold.returns.window - 0.1) < 1e-12)
    assert.notEqual(hold.returns.t40, hold.returns.window)
    const later = buildHold([...closes, 40], 0, 10)
    assert.equal(later.returns.window, hold.returns.window)
    assert.equal(later.returns.t40, hold.returns.t40)
    assert.equal(judgeHold({
      gap: { t10: 1, t20: 1, window: 1 },
      lowWindowGap: 1,
      highWin: { t10: 60, t20: 60, window: 60 },
      extraDropGap: 2,
      extraDrop15: 4,
      extraDrop20: 2,
      minMedianGap: -1,
      looMin: 0.4,
    }).label, "강하게 지지")
    assert.equal(judgeHold({
      gap: { t10: 1, t20: 1, window: 1 },
      lowWindowGap: 1,
      highWin: { t10: 60, t20: 60, window: 60 },
      extraDropGap: 9,
      extraDrop15: 21,
      extraDrop20: 15,
      minMedianGap: -1.5,
      looMin: 0.4,
    }).label, "부분적으로 지지")
    assert.equal(judgeHold({
      gap: { t10: -1, t20: 1, window: 1 },
      lowWindowGap: 1,
      highWin: { t10: 60, t20: 60, window: 60 },
      extraDropGap: 2,
      minMedianGap: -1,
      looMin: 0.4,
    }).label, "부분적으로 지지")
    assert.equal(judgeHold({
      gap: { t10: -1, t20: -1, window: -1 },
      lowWindowGap: -1,
      highWin: { t10: 40, t20: 40, window: 40 },
      extraDropGap: 30,
      minMedianGap: -8,
      looMin: -0.2,
    }).label, "확인 실패")
  })

  it("keeps the stored 103 events and ATR groups", () => {
    const v6 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v6-result.json"), "utf8"))
    const selected = selectMildEvents(v6.events)
    const needed = [...new Set(selected.map((row) => row.ticker))]
    const series = new Map(needed.map((symbol) => [symbol, loadSeries(symbol)]))
    const spy = loadSeries("SPY")
    const events = attachHold(attachRegime(attachSplit(selected, series, spy), spy), series)
    assert.doesNotThrow(() => assertBaseline(events))
    assert.equal(events.length, 103)
    assert.equal(events.filter((row) => row.lowDay != null).length, 102)
    assert.equal(events.bandCounts.LOW, 34)
    assert.equal(events.bandCounts.MID, 34)
    assert.equal(events.bandCounts.HIGH, 35)
    const result = study(events, { bootstrap: 30 })
    assert.equal(result.selectedStrategy, null)
    assert.equal(result.judgment.label, "부분적으로 지지")
    assert.ok(result.bands.HIGH.t0.mean < 0)
    assert.equal(result.bands.HIGH.t0.sellNow, 0)
    assert.equal(result.bands.HIGH.t1.holdAdvantageMean, result.bands.HIGH.t1.mean)
    assert.equal(result.t0Buckets.lt0.n, 103)
  })
})
