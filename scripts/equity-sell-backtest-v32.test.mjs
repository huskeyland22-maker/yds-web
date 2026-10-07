/**
 * node --test scripts/equity-sell-backtest-v32.test.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
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
  judgeHoldConviction,
  loadOhlcv,
  predictorFrame,
  rawSpearman,
  selectMildEvents,
  study,
} from "./lib/equity-sell-backtest-v32.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  return loadOhlcv(bars)
}

function card(patch) {
  return { id: "x", returnClear: false, tailClear: false, ...patch }
}

describe("equity sell backtest v32", () => {
  it("keeps future outcomes out of the T+5 frame", () => {
    assert.equal(SELECTED_STRATEGY, null)
    const source = fs.readFileSync(new URL("./lib/equity-sell-backtest-v32.mjs", import.meta.url), "utf8")
    assert.equal(source.includes("vite-project"), false)
    assert.equal(source.includes("noThresholdSearch: true"), true)
    const event = {
      predictors: { t0: -0.02, leadership: 40, atrPct: 0.03, withinAtr: 0.01, correctionSpeed: 0.002, correctionDuration: 8, ret20: 0.04, distMa20: -0.03, distMa50Prior: -0.05, pos60: 0.2, pos120: 0.4, spyRet20: 0.01, spyAtr: 0.02 },
      early: { stateT5: "RECOVERING", t5: { mae: -0.04, fromMae: 0.01, return: -0.03, depth: 0.04 }, t3: { mae: -0.05 }, t1: { mae: -0.02 } },
      forward: { window: 0.2 },
    }
    const frame = predictorFrame(event)
    assert.equal(frame.t0, -0.02)
    assert.equal(frame.fromMae, 0.01)
    assert.equal(frame.stateRecovering, 1)
    assert.equal("window" in frame, false)
    assert.equal("days5" in frame, false)
    const poisoned = predictorFrame({ ...event, forward: { window: -1 }, futureLow: -5, days5: 3 })
    assert.deepEqual(poisoned, frame)
    assert.ok(Math.abs(rawSpearman([1, 2, 3, 4], [1, 2, 3, 4]) - 1) < 1e-12)
    const models = [{ id: "M0", nonPositiveSplits: 3 }]
    assert.equal(judgeHoldConviction({
      lookAheadViolations: 0,
      cards: [card({ returnClear: true, tailClear: true }), card({ id: "y", returnClear: true, tailClear: true })],
      models,
    }).label, "강한 보유 확신 신호")
    assert.equal(judgeHoldConviction({
      lookAheadViolations: 0,
      cards: [card({ returnClear: true, tailClear: false })],
      models,
    }).label, "부분적인 보유 확신 신호")
    assert.equal(judgeHoldConviction({
      lookAheadViolations: 0,
      cards: [card({})],
      models,
    }).label, "반대 증거")
    assert.equal(judgeHoldConviction({
      lookAheadViolations: 0,
      cards: [card({})],
      models: [{ id: "M0", nonPositiveSplits: 0 }],
    }).label, "보유 확신 신호 부족")
    assert.throws(() => judgeHoldConviction({ lookAheadViolations: 1, cards: [], models }))
  })

  it("keeps the stored 103 events and does not refit the hold predictors", () => {
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
    const result = study(events, series, { lookAheadViolations: 0 })
    assert.equal(result.selectedStrategy, null)
    assert.equal(result.rules.noRefit, true)
    assert.equal(result.rules.recoveryIsOutcome, true)
    assert.equal(result.lookAhead.violations, 0)
    assert.equal(result.lookAhead.hold.checked, 103)
    assert.equal(result.identities.ok, true)
    assert.ok(result.identities.maxAbsError <= 1e-10)
    assert.equal(result.levels.window.n, 99)
    assert.equal(result.levels.t20.n, 103)
    assert.equal(result.byState.STABILIZING.conclusion, "결론 금지")
    assert.equal(result.byState.STABILIZING.window.mean, null)
    assert.equal(result.best, undefined)
    assert.match(result.note, /not a sell rule/i)
    assert.equal(result.judgment.label, "부분적인 보유 확신 신호")
  })
})
