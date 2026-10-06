/**
 * node --test scripts/equity-sell-backtest-v21.test.mjs
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
  attachRisk,
  attachSplit,
  excursion,
  judgeRisk,
  loadOhlcv,
  ratioOf,
  selectMildEvents,
  standardizedRegression,
  study,
} from "./lib/equity-sell-backtest-v21.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  return loadOhlcv(bars)
}

describe("equity sell backtest v21", () => {
  it("keeps the window excursion separate from T+40 and leaves a zero MAE ratio empty", () => {
    assert.equal(SELECTED_STRATEGY, null)
    const source = fs.readFileSync(new URL("./lib/equity-sell-backtest-v21.mjs", import.meta.url), "utf8")
    assert.equal(source.includes("vite-project"), false)
    const closes = Array.from({ length: 70 }, () => 100)
    closes[20] = 70
    closes[40] = 140
    closes[50] = 80
    closes[60] = 110
    const path = excursion(closes, 0, 10)
    assert.ok(Math.abs(path.mae + 0.3) < 1e-12)
    assert.ok(Math.abs(path.mfe - 0.4) < 1e-12)
    assert.ok(Math.abs(path.window - 0.1) < 1e-12)
    assert.ok(Math.abs(path.t40 + 0.2) < 1e-12)
    assert.notEqual(path.t40, path.window)
    assert.equal(path.lowDepth, path.mae)
    assert.ok(Math.abs(ratioOf(path.window, path.mae) - (0.1 / 0.3)) < 1e-12)
    const later = excursion([...closes, 10], 0, 10)
    assert.equal(later.mae, path.mae)
    assert.equal(later.window, path.window)
    const flat = Array.from({ length: 70 }, () => 100)
    assert.equal(ratioOf(excursion(flat, 0, 10).window, excursion(flat, 0, 10).mae), null)
    const ended = Array.from({ length: 61 }, () => 100)
    assert.equal(excursion(ended, 0, 60).mae, null)
    const fit = standardizedRegression([
      { y: 1, t0: 1, atr: 1 },
      { y: 0, t0: 2, atr: 0 },
      { y: 1, t0: 3, atr: 1 },
      { y: 0, t0: 4, atr: 0 },
      { y: 1, t0: 5, atr: 1 },
      { y: 0, t0: 6, atr: 0 },
    ])
    assert.ok(fit.atr > 0.9)
    assert.ok(fit.r2 > 0.9)
    assert.equal(judgeRisk({
      windowGap: 5, lowWindowGap: 4, ratioMeanGap: 0.2, ratioMedianGap: 0.1,
      worse15Gap: 2, worse20Gap: 1, maeMedianGap: -1,
      windowCiLow: 1, lowWindowCiLow: 1, ratioCiLow: 0.05,
      looWindowMin: 1, looLowMin: 1,
    }).label, "강하게 지지")
    assert.equal(judgeRisk({
      windowGap: 5, lowWindowGap: 4, ratioMeanGap: 0.2, ratioMedianGap: 0.1,
      worse15Gap: 21, worse20Gap: 12, maeMedianGap: -1.5,
      windowCiLow: 1, lowWindowCiLow: 1, ratioCiLow: 0.05,
      looWindowMin: 1, looLowMin: 1,
    }).label, "부분적으로 지지")
    assert.equal(judgeRisk({
      windowGap: 5, lowWindowGap: 4, ratioMeanGap: -0.2, ratioMedianGap: -0.1,
      worse15Gap: 2, worse20Gap: 1, maeMedianGap: -1,
      windowCiLow: 1, lowWindowCiLow: 1, ratioCiLow: -0.2,
      looWindowMin: 1, looLowMin: 1,
    }).label, "확인 실패")
  })

  it("keeps the stored 103 events and ATR groups", () => {
    const v6 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v6-result.json"), "utf8"))
    const selected = selectMildEvents(v6.events)
    const needed = [...new Set(selected.map((row) => row.ticker))]
    const series = new Map(needed.map((symbol) => [symbol, loadSeries(symbol)]))
    const spy = loadSeries("SPY")
    const events = attachRisk(attachHold(attachRegime(attachSplit(selected, series, spy), spy), series), series)
    assert.doesNotThrow(() => assertBaseline(events))
    assert.equal(events.length, 103)
    assert.equal(events.filter((row) => row.lowDay != null).length, 102)
    assert.equal(events.filter((row) => row.risk.mae == null).length, 1)
    assert.equal(events.bandCounts.LOW, 34)
    assert.equal(events.bandCounts.MID, 34)
    assert.equal(events.bandCounts.HIGH, 35)
    const result = study(events, { bootstrap: 30 })
    assert.equal(result.selectedStrategy, null)
    assert.equal(result.continuous.lowWindow.spearman, 0.4107)
    assert.equal(result.continuous.hit10.spearman, -0.3421)
    assert.equal(result.judgment.label, "부분적으로 지지")
    assert.equal(result.regression.note.includes("Not a causal"), true)
  })
})
