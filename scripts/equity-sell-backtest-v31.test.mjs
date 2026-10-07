/**
 * node --test scripts/equity-sell-backtest-v31.test.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
import {
  METHODS,
  SELECTED_STRATEGY,
  assertBaseline,
  assertEventList,
  assertReentryIdentities,
  assertV18Split,
  attachEarly,
  attachForward,
  attachHold,
  attachRegime,
  attachShape,
  attachSplit,
  judgeReentry,
  loadOhlcv,
  locateReentry,
  markHorizon,
  portfolioAction,
  selectMildEvents,
  study,
} from "./lib/equity-sell-backtest-v31.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  return loadOhlcv(bars)
}

function card(patch) {
  return {
    n: 99,
    incremental: 0.02,
    ciLow: 0.4,
    ciHigh: 2,
    oosPositive: 3,
    oosNegative: 0,
    tail10Strategy: 0.05,
    tail10Hold: 0.16,
    tail20Strategy: 0.01,
    tail20Hold: 0.03,
    looFlip: false,
    ...patch,
  }
}

describe("equity sell backtest v31", () => {
  it("prices a fixed re-entry without using a later bar or merging scenarios", () => {
    assert.equal(SELECTED_STRATEGY, null)
    const source = fs.readFileSync(new URL("./lib/equity-sell-backtest-v31.mjs", import.meta.url), "utf8")
    assert.equal(source.includes("vite-project"), false)
    assert.equal(METHODS.length, 6)
    const closes = [100, 100, 100, 100, 100, 100, 99, 100]
    const lows = [100, 100, 100, 100, 100, 100, 100, 90]
    const series = { closes, lows }
    assert.equal(locateReentry(series, 0, 6, "entry").failed, true)
    assert.equal(locateReentry(series, 0, 6, "low5").failed, true)
    assert.equal(locateReentry(series, 0, 7, "low5").reentryIdx, 7)
    assert.notEqual(locateReentry(series, 0, 7, "low5").reentryIdx, 6)
    const recovered = { closes: closes.slice(), lows: lows.slice() }
    recovered.closes[6] = 101
    assert.equal(locateReentry(recovered, 0, 7, "entry").reentryIdx, 6)
    const after = { closes: recovered.closes.concat([150]), lows: recovered.lows.concat([1]) }
    assert.equal(locateReentry(after, 0, 7, "entry").reentryIdx, 6)
    const bought = markHorizon({
      action: "sell",
      horizon: "t20",
      t5Idx: 1,
      t5Close: 100,
      horizonIdx: 4,
      horizonClose: 110,
      reentryIdx: 3,
      reentryClose: 90,
      failed: false,
      cost: 0,
    })
    assert.equal(bought.status, "reentered")
    assert.ok(Math.abs(bought.strategy - (110 / 90 - 1)) < 1e-12)
    assert.ok(Math.abs(bought.bh - (110 / 100 - 1)) < 1e-12)
    assert.ok(Math.abs(bought.incremental - (bought.strategy - bought.bh)) < 1e-12)
    assert.ok(Math.abs(bought.incremental - (bought.avoided - bought.missed)) < 1e-12)
    const costly = markHorizon({ ...bought, action: "sell", horizon: "t20", t5Idx: 1, t5Close: 100, horizonIdx: 4, horizonClose: 110, reentryIdx: 3, reentryClose: 90, failed: false, cost: 0.001, strategy: undefined })
    assert.ok(Math.abs(costly.strategy - ((1 - 0.001) ** 2 * (110 / 90) - 1)) < 1e-12)
    const late = markHorizon({
      action: "sell",
      horizon: "t10",
      t5Idx: 1,
      t5Close: 100,
      horizonIdx: 2,
      horizonClose: 104,
      reentryIdx: 4,
      reentryClose: 110,
      failed: false,
    })
    assert.equal(late.status, "unavailable")
    assert.equal(late.strategy, null)
    const cash = markHorizon({
      action: "sell",
      horizon: "window",
      t5Idx: 1,
      t5Close: 100,
      horizonIdx: 4,
      horizonClose: 110,
      reentryIdx: null,
      reentryClose: null,
      failed: true,
      cost: 0,
    })
    assert.equal(cash.status, "cash")
    assert.equal(cash.cash, true)
    assert.equal(cash.strategy, 0)
    assert.ok(cash.missed > 0)
    const held = markHorizon({
      action: "hold",
      horizon: "window",
      t5Idx: 1,
      t5Close: 100,
      horizonIdx: 4,
      horizonClose: 110,
      reentryIdx: null,
      reentryClose: null,
      failed: false,
      cost: 0.005,
    })
    assert.equal(held.strategy, held.bh)
    assert.equal(held.incremental, 0)
    const clear = Array.from({ length: 6 }, () => card({}))
    assert.equal(judgeReentry({ lookAheadViolations: 0, cards: clear }).label, "강한 지지")
    const against = Array.from({ length: 6 }, () => card({ incremental: -0.02, ciLow: -3, ciHigh: -0.2, oosPositive: 0, oosNegative: 3 }))
    assert.equal(judgeReentry({ lookAheadViolations: 0, cards: against }).label, "반대 증거")
    const mixed = [
      card({ ciLow: -0.2, oosPositive: 2 }),
      card({ ciLow: -0.2, oosPositive: 2 }),
      card({ incremental: -0.01, ciLow: -1, ciHigh: 1, oosPositive: 1, oosNegative: 1 }),
      card({ incremental: -0.01, ciLow: -1, ciHigh: 1, oosPositive: 1, oosNegative: 1 }),
      card({ incremental: -0.01, ciLow: -1, ciHigh: 1, oosPositive: 0, oosNegative: 1 }),
      card({ incremental: -0.01, ciLow: -1, ciHigh: 1, oosPositive: 0, oosNegative: 1 }),
    ]
    assert.equal(judgeReentry({ lookAheadViolations: 0, cards: mixed }).label, "부분 지지")
    const weak = Array.from({ length: 6 }, () => card({ incremental: -0.01, ciLow: -1, ciHigh: 0.4, oosPositive: 1, oosNegative: 1 }))
    assert.equal(judgeReentry({ lookAheadViolations: 0, cards: weak }).label, "지지 부족")
    assert.throws(() => judgeReentry({ lookAheadViolations: 1, cards: clear }))
    assert.equal(portfolioAction({ early: { stateT5: "RECOVERING" } }), "hold")
    assert.equal(portfolioAction({ early: { stateT5: "STILL_FALLING" } }), "sell")
    assert.equal(portfolioAction({ early: { stateT5: "STABILIZING" } }), "sell")
  })

  it("keeps the stored 103 events and scores the fixed scenarios separately", () => {
    const v6 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v6-result.json"), "utf8"))
    const selected = selectMildEvents(v6.events)
    const needed = [...new Set(selected.map((row) => row.ticker))]
    const series = new Map(needed.map((symbol) => [symbol, loadSeries(symbol)]))
    const spy = loadSeries("SPY")
    const held = attachHold(attachRegime(attachSplit(selected, series, spy), spy), series)
    const early = attachEarly(attachShape(held, series))
    const events = attachForward(early, series)
    assert.doesNotThrow(() => assertBaseline(events))
    assert.doesNotThrow(() => assertV18Split(events))
    assert.doesNotThrow(() => assertEventList(events))
    assert.equal(events.length, 103)
    assert.equal(events.filter((row) => row.early.stateT5 === "RECOVERING").length, 53)
    assert.equal(events.filter((row) => row.early.stateT5 === "STABILIZING").length, 4)
    assert.equal(events.filter((row) => row.early.stateT5 === "STILL_FALLING").length, 46)
    const result = study(events, series, { lookAheadViolations: 0 })
    assert.equal(result.selectedStrategy, null)
    assert.equal(result.rules.noBestScenario, true)
    assert.equal(result.best, undefined)
    assert.equal(result.lookAhead.violations, 0)
    assert.equal(result.lookAhead.reentry.checked, 103)
    assert.equal(result.identities.ok, true)
    assert.ok(result.identities.maxAbsError <= 1e-10)
    assert.equal(result.portfolio.entry.window.n, 99)
    assert.equal(result.portfolio.low5.window.n, 99)
    assert.equal(result.portfolio.low10.window.n, 99)
    assert.equal(result.portfolio.t20.t10.n < result.portfolio.t20.window.n || result.portfolio.t20.t10.unavailable > 0, true)
    const sample = [{
      method: "entry",
      horizon: "window",
      status: "cash",
      cash: true,
      bh: 0.1,
      strategy: 0,
      incremental: -0.1,
      avoided: 0,
      missed: 0.1,
      forward: 0.1,
      reentryIdx: null,
      eventId: "x",
    }, {
      method: "t10",
      horizon: "t10",
      status: "unavailable",
      cash: false,
      bh: 0.1,
      strategy: null,
      incremental: null,
      avoided: null,
      missed: null,
      forward: 0.1,
      reentryIdx: 8,
      eventId: "x",
    }, {
      method: "t20",
      horizon: "window",
      status: "hold",
      cash: false,
      bh: 0.2,
      strategy: 0.2,
      incremental: 0,
      avoided: 0,
      missed: 0,
      forward: 0.2,
      reentryIdx: null,
      eventId: "y",
    }, {
      method: "t40",
      horizon: "t40",
      status: "reentered",
      cash: false,
      bh: 0.2,
      strategy: 0.05,
      incremental: -0.15,
      avoided: 0,
      missed: 0.15,
      forward: 0.2,
      reentryIdx: 3,
      eventId: "y",
    }, {
      method: "low5",
      horizon: "window",
      status: "reentered",
      cash: false,
      bh: -0.1,
      strategy: 0,
      incremental: 0.1,
      avoided: 0.1,
      missed: 0,
      forward: -0.1,
      reentryIdx: 4,
      eventId: "z",
    }, {
      method: "low10",
      horizon: "window",
      status: "cash",
      cash: true,
      bh: -0.2,
      strategy: 0,
      incremental: 0.2,
      avoided: 0.2,
      missed: 0,
      forward: -0.2,
      reentryIdx: null,
      eventId: "z",
    }]
    const check = assertReentryIdentities(sample)
    assert.equal(check.ok, true)
    assert.match(result.note, /not a sell rule/i)
    assert.equal(result.rules.noRefit, true)
    assert.equal(result.judgment.label, "반대 증거")
  })
})
