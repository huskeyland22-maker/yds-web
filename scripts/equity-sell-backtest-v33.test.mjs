/**
 * node --test scripts/equity-sell-backtest-v33.test.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
import { predictorFrame as v32Frame } from "./lib/equity-sell-backtest-v32.mjs"
import {
  SELECTED_STRATEGY,
  assertBaseline,
  assertEventList,
  assertV18Split,
  attachEarly,
  attachForward,
  attachHold,
  attachRegime,
  attachShape,
  attachSplit,
  judgeIndependence,
  loadOhlcv,
  partialRankCorrelation,
  selectMildEvents,
  study,
} from "./lib/equity-sell-backtest-v33.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  return loadOhlcv(bars)
}

describe("equity sell backtest v33", () => {
  it("keeps the three core predictors inside the T+5 frame", () => {
    assert.equal(SELECTED_STRATEGY, null)
    const source = fs.readFileSync(new URL("./lib/equity-sell-backtest-v33.mjs", import.meta.url), "utf8")
    assert.equal(source.includes("vite-project"), false)
    assert.equal(source.includes("noThresholdSearch: true"), true)
    assert.equal(source.includes("noModelPick: true"), true)
    const x = [1, 2, 3, 4, 5, 6, 7, 8]
    const rho = partialRankCorrelation(x, x.map((value) => value * 2), [[8, 1, 7, 2, 6, 3, 5, 4]])
    assert.ok(Math.abs(rho - 1) < 1e-9)
    const event = {
      predictors: { t0: -0.08, leadership: 40, atrPct: 0.03, spyAtr: 0.02 },
      forward: { window: 0.2 },
    }
    const prior = v32Frame(event)
    assert.equal(prior.t0, -0.08)
    assert.equal(prior.eventAtr, 0.03)
    assert.equal(prior.spyAtr, 0.02)
    assert.equal(judgeIndependence({
      lookAheadViolations: 0,
      variables: [
        { independent: true, hurts: false, riskStable: true },
        { independent: true, hurts: false, riskStable: true },
      ],
    }).label, "독립적인 보유 신호 확인")
    assert.equal(judgeIndependence({
      lookAheadViolations: 0,
      variables: [
        { independent: true, hurts: false, riskStable: false },
        { independent: true, hurts: false, riskStable: true },
      ],
    }).label, "부분적인 독립 보유 신호")
    assert.equal(judgeIndependence({
      lookAheadViolations: 0,
      variables: [
        { independent: true, hurts: false, riskStable: true },
        { independent: false, hurts: true, riskStable: false },
      ],
    }).label, "부분적인 독립 보유 신호")
    assert.equal(judgeIndependence({
      lookAheadViolations: 0,
      variables: [
        { independent: false, hurts: true, riskStable: false },
        { independent: false, hurts: true, riskStable: false },
      ],
    }).label, "반대 증거")
    assert.equal(judgeIndependence({
      lookAheadViolations: 0,
      variables: [
        { independent: false, hurts: false, riskStable: false },
        { independent: false, hurts: true, riskStable: false },
      ],
    }).label, "독립 정보 증거 부족")
    assert.throws(() => judgeIndependence({ lookAheadViolations: 1, variables: [] }))
  })

  it("keeps the stored 103 events and does not refit the three predictors", () => {
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
    const result = study(events, series, { lookAheadViolations: 0, spy })
    assert.equal(result.selectedStrategy, null)
    assert.equal(result.rules.noRefit, true)
    assert.equal(result.rules.noModelPick, true)
    assert.equal(result.rules.utilityIsDescriptive, true)
    assert.equal(result.lookAhead.violations, 0)
    assert.equal(result.lookAhead.core.checked, 103)
    assert.equal(result.identities.ok, true)
    assert.ok(result.identities.maxAbsError <= 1e-10)
    assert.equal(result.levels.window.n, 99)
    assert.equal(result.states.RECOVERING, 53)
    assert.equal(result.states.STILL_FALLING, 46)
    assert.equal(result.byState.STABILIZING.conclusion, "결론 금지")
    assert.equal(result.byState.STABILIZING.models.M0, undefined)
    assert.equal(result.best, undefined)
    assert.match(result.note, /not a sell rule/i)
    assert.equal(result.steps["leadership|m3"].judged, false)
    assert.equal(result.steps["eventAtr|t0+spyAtr"].judged, true)
    assert.equal(result.steps["spyAtr|t0+eventAtr"].judged, true)
    for (const id of ["M0", "M1", "M2", "M3", "M4"]) {
      for (const split of ["50", "60", "70"]) {
        const test = result.models[id].splits[split].test
        if (test) assert.equal(Object.hasOwn(test, "r2"), true)
      }
    }
    assert.equal(result.judgment.label, "독립 정보 증거 부족")
  })
})
