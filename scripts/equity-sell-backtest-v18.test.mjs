/**
 * node --test scripts/equity-sell-backtest-v18.test.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
import {
  CLASS_CUTOFF,
  MODEL_SPEC,
  SELECTED_STRATEGY,
  WEAK_SPEARMAN,
  assertBaseline,
  attachRegime,
  attachSplit,
  centeredProduct,
  chronologicalSplit,
  judgeOos,
  loadOhlcv,
  permutationTail,
  scoreContinuous,
  selectMildEvents,
  targetTrainCount,
  transferLinear,
} from "./lib/equity-sell-backtest-v18.mjs"

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
    predictors: { t0: x, leadership: 10, atrPct: x, withinAtr: x / 2, spyRet20: x / 10, spyAtr: 0.02 },
  }
}

function block(oosR2, spearman, mae, direction) {
  return { train: { direction }, test: { oosR2, spearman, mae } }
}

describe("equity sell backtest v18", () => {
  it("keeps a date together and does not let the test outcome refit the train line", () => {
    assert.equal(SELECTED_STRATEGY, null)
    assert.equal(CLASS_CUTOFF, 0.5)
    assert.equal(WEAK_SPEARMAN, 0.1)
    assert.equal(targetTrainCount(103, 0.7), 72)
    assert.equal(targetTrainCount(103, 0.6), 62)
    assert.equal(targetTrainCount(103, 0.5), 52)
    assert.deepEqual(Object.keys(MODEL_SPEC.C.interactions), ["0"])
    assert.equal(MODEL_SPEC.C.interactions[0].name, "withinXspy")
    const events = [
      event("2020-01-01", "AAA", 0.1, 1),
      event("2020-01-01", "BBB", 0.2, 2),
      event("2020-01-02", "CCC", 0.3, 3),
      event("2020-01-03", "DDD", 0.4, 4),
      event("2020-01-04", "EEE", 0.5, 5),
    ]
    const split = chronologicalSplit(events, 0.6)
    assert.deepEqual(split.train.map((row) => row.ticker), ["AAA", "BBB", "CCC"])
    assert.deepEqual(split.test.map((row) => row.ticker), ["DDD", "EEE"])
    const first = transferLinear(split.train, split.test, (row) => row.lowToWindow, MODEL_SPEC.M0)
    split.test[0].lowToWindow = 9
    const second = transferLinear(split.train, split.test, (row) => row.lowToWindow, MODEL_SPEC.M0)
    assert.deepEqual(first.train.rawCoefficient, second.train.rawCoefficient)
    assert.equal(centeredProduct(0.05, -0.02, 0.03, 0.01), (0.05 - 0.03) * (-0.02 - 0.01))
    const scored = scoreContinuous([0.1, 0.2, 0.3], [0.1, 0.2, 0.9])
    assert.ok(scored.oosR2 < 1)
    const tail = permutationTail([0.1, 0.4, 0.2, 0.8, 0.3], [0.1, 0.2, 0.3, 0.4, 0.5], 200, 7)
    assert.ok(tail.spearmanGreater >= 0 && tail.spearmanGreater <= 1)
    const strong = {
      A: block(0.01, 0.1, 8, 1),
      C: block(0.08, 0.3, 6, -1),
      D: block(-0.02, 0.05, 9, 1),
    }
    assert.equal(judgeOos({
      testN: 30,
      splits: { "70": strong, "60": strong, "50": strong },
    }).label, "A")
    assert.equal(judgeOos({
      testN: 30,
      splits: {
        "70": strong,
        "60": { A: block(0.02, 0.2, 7, 1), C: block(0.01, 0.15, 8, -1), D: block(0.01, 0.1, 8, 1) },
        "50": strong,
      },
    }).label, "B")
    assert.equal(judgeOos({
      testN: 30,
      splits: {
        "70": { A: block(0.02, 0.2, 7, 1), C: block(-0.04, 0.05, 9, -1), D: block(-0.01, 0.02, 8, 1) },
        "60": strong,
        "50": strong,
      },
    }).label, "C")
    assert.equal(judgeOos({ testN: 8, splits: {} }).label, "D")
  })

  it("reproduces the stored ATR baseline before any time split", () => {
    const v6 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v6-result.json"), "utf8"))
    const selected = selectMildEvents(v6.events)
    const needed = [...new Set(selected.map((event) => event.ticker))]
    const series = new Map(needed.map((symbol) => [symbol, loadSeries(symbol)]))
    const spy = loadSeries("SPY")
    const events = attachRegime(attachSplit(selected, series, spy), spy)
    assert.doesNotThrow(() => assertBaseline(events))
    const split = chronologicalSplit(events, 0.7)
    assert.equal(split.trainN + split.testN, 103)
    assert.ok(split.trainEnd <= split.testStart)
    const dates = new Map()
    for (const row of [...split.train, ...split.test]) dates.set(row.t0Date, (dates.get(row.t0Date) ?? 0) + 1)
    for (const [date, count] of dates) {
      const trainCount = split.train.filter((row) => row.t0Date === date).length
      assert.ok(trainCount === 0 || trainCount === count)
    }
  })
})
