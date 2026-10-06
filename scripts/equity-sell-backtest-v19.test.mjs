/**
 * node --test scripts/equity-sell-backtest-v19.test.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
import { volatilityBlock } from "./lib/equity-sell-backtest-v7.mjs"
import { chronologicalSplit as splitV18 } from "./lib/equity-sell-backtest-v18.mjs"
import {
  MODEL_SPEC,
  SELECTED_STRATEGY,
  V18_SPLIT,
  assertBaseline,
  assertV18Split,
  attachRegime,
  attachSplit,
  attachStockVol,
  chronologicalSplit,
  improves,
  judgeIndependence,
  loadOhlcv,
  metricDelta,
  selectMildEvents,
  study,
  transferLinear,
} from "./lib/equity-sell-backtest-v19.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  return loadOhlcv(bars)
}

function event(date, ticker, y, x) {
  return {
    eventId: `${ticker}-${date}`,
    ticker,
    t0Date: date,
    lowDay: 1,
    lowToWindow: y,
    fromLow: { t20: y },
    hits: { "10": { reached: true, days: 4 } },
    predictors: {
      t0: x,
      leadership: 10 + x,
      atrPct: 0.02 + x / 100,
      stockVol20: 0.2 + x / 50,
      spyVol20: 0.15,
      spyAtr: 0.012,
      betweenAtr: 0.018,
      withinAtr: 0.002 + x / 200,
    },
  }
}

describe("equity sell backtest v19", () => {
  it("keeps Event ATR separate from between and within, and does not refit on the test", () => {
    assert.equal(SELECTED_STRATEGY, null)
    for (const spec of Object.values(MODEL_SPEC)) {
      const fields = new Set(spec.fields)
      assert.equal(fields.has("eventAtr") && fields.has("betweenAtr") && fields.has("withinAtr"), false)
    }
    assert.deepEqual(MODEL_SPEC.M4.fields, ["t0", "leadership", "eventAtr", "stockVol20"])
    assert.deepEqual(MODEL_SPEC.M8.fields, ["t0", "leadership", "betweenAtr"])
    assert.deepEqual(MODEL_SPEC.M9.fields, ["t0", "leadership", "withinAtr"])
    const events = [
      event("2020-01-01", "AAA", 0.1, 1),
      event("2020-01-01", "BBB", 0.2, 2),
      event("2020-01-02", "CCC", 0.3, 3),
      event("2020-01-03", "DDD", 0.4, 4),
      event("2020-01-04", "EEE", 0.5, 5),
    ]
    const split = chronologicalSplit(events, 0.6)
    assert.deepEqual(split.train.map((row) => row.ticker), splitV18(events, 0.6).train.map((row) => row.ticker))
    const first = transferLinear(split.train, split.test, (row) => row.lowToWindow, MODEL_SPEC.M0)
    split.test[0].lowToWindow = 9
    const second = transferLinear(split.train, split.test, (row) => row.lowToWindow, MODEL_SPEC.M0)
    assert.deepEqual(first.train.rawCoefficient, second.train.rawCoefficient)
    assert.equal(improves(metricDelta(
      { test: { oosR2: 0.2, spearman: 0.4, pearson: 0.3, mae: 5, rmse: 7 } },
      { test: { oosR2: 0.1, spearman: 0.2, pearson: 0.1, mae: 6, rmse: 8 } },
    )), true)
    const strong = {
      deltas: {
        "70": { m1m2: { deltaR2: 0.1, deltaSpearman: 0.1, deltaMae: -1 }, m3m4: { deltaR2: 0.1, deltaSpearman: 0.1, deltaMae: -1 }, m2m4: { deltaR2: 0.1, deltaSpearman: 0.1, deltaMae: -1 } },
        "60": { m1m2: { deltaR2: 0.1, deltaSpearman: 0.1, deltaMae: -1 }, m3m4: { deltaR2: 0.1, deltaSpearman: 0.1, deltaMae: -1 }, m2m4: { deltaR2: 0.1, deltaSpearman: 0.1, deltaMae: -1 } },
        "50": { m1m2: { deltaR2: 0.1, deltaSpearman: 0.1, deltaMae: -1 }, m3m4: { deltaR2: 0.1, deltaSpearman: 0.1, deltaMae: -1 }, m2m4: { deltaR2: 0.1, deltaSpearman: 0.1, deltaMae: -1 } },
      },
      signs: { "70": { M2: 1, M4: 1 }, "60": { M2: 1, M4: 1 }, "50": { M2: 1, M4: 1 } },
      loo: { baseline: 0.4, min: 0.2, max: 0.5 },
      permutation: { "70": { M2: 0.01, M4: 0.02 }, "60": { M2: 0.03, M4: 0.04 }, "50": { M2: 0.02, M4: 0.01 } },
    }
    assert.equal(judgeIndependence(strong).label, "강하게 지지")
    assert.equal(judgeIndependence({
      ...strong,
      deltas: {
        ...strong.deltas,
        "70": { m1m2: { deltaR2: 0.1, deltaSpearman: 0.1, deltaMae: -1 }, m3m4: { deltaR2: -0.1, deltaSpearman: 0.1, deltaMae: -1 } },
      },
    }).label, "부분적으로 지지")
    assert.equal(judgeIndependence({
      ...strong,
      signs: { "70": { M2: 1, M4: 1 }, "60": { M2: -1, M4: -1 }, "50": { M2: 1, M4: 1 } },
    }).label, "확인 실패")
  })

  it("does not let a future bar change the 20-day volatility known at entry", () => {
    const closes = Array.from({ length: 40 }, (_, index) => 100 + index * 0.4)
    const highs = closes.map((price) => price + 1)
    const lows = closes.map((price) => price - 1)
    const known = volatilityBlock(highs, lows, closes, 30).vol20
    const later = volatilityBlock([...highs, 180], [...lows, 40], [...closes, 160], 30).vol20
    assert.equal(later, known)
    assert.notEqual(volatilityBlock([...highs.slice(0, 30), 130], [...lows.slice(0, 30), 70], [...closes.slice(0, 30), 120, ...closes.slice(31)], 30).vol20, known)
  })

  it("reproduces the v18 sample and split before scoring Event ATR", () => {
    const v6 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v6-result.json"), "utf8"))
    const selected = selectMildEvents(v6.events)
    const needed = [...new Set(selected.map((row) => row.ticker))]
    const series = new Map(needed.map((symbol) => [symbol, loadSeries(symbol)]))
    const spy = loadSeries("SPY")
    const events = attachStockVol(attachRegime(attachSplit(selected, series, spy), spy), series)
    assert.doesNotThrow(() => assertBaseline(events))
    assert.doesNotThrow(() => assertV18Split(events))
    assert.equal(events.length, 103)
    assert.equal(events.filter((row) => row.lowDay != null).length, 102)
    assert.equal(events.bandCounts.LOW, 34)
    assert.equal(events.bandCounts.MID, 34)
    assert.equal(events.bandCounts.HIGH, 35)
    const split = chronologicalSplit(events, 0.7)
    assert.equal(split.trainN, V18_SPLIT["70"].trainN)
    assert.equal(split.testStart, V18_SPLIT["70"].testStart)
    const result = study(events, { permutations: 20 })
    assert.equal(result.selectedStrategy, null)
    assert.ok(["강하게 지지", "부분적으로 지지", "확인 실패"].includes(result.judgment.label))
    assert.equal(result.splits["70"].models.M2.lowWindow.test.n >= 10, true)
  })
})
