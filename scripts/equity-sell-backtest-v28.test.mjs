/**
 * node --test scripts/equity-sell-backtest-v28.test.mjs
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
  attachTiming,
  auditLookAhead,
  decisionReturn,
  judgeHoldSell,
  loadOhlcv,
  measureCheckpoint,
  recoveryPoint,
  selectMildEvents,
  study,
} from "./lib/equity-sell-backtest-v28.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  return loadOhlcv(bars)
}

describe("equity sell backtest v28", () => {
  it("prices a T+5 sell at zero and keeps that close inside the predictor", () => {
    assert.equal(SELECTED_STRATEGY, null)
    const source = fs.readFileSync(new URL("./lib/equity-sell-backtest-v28.mjs", import.meta.url), "utf8")
    assert.equal(source.includes("vite-project"), false)
    assert.equal(decisionReturn(0.04, "sell", 0), 0)
    assert.equal(decisionReturn(0.04, "hold", 0), 0.04)
    assert.equal(decisionReturn(0.04, "sell", 0.0025), -0.0025)
    const closes = [100, 97, 96, 98, 90, 99, 110, 80]
    const point = recoveryPoint(measureCheckpoint(closes, 0, 5))
    const poisoned = closes.slice()
    poisoned[6] = 50
    assert.equal(recoveryPoint(measureCheckpoint(poisoned, 0, 5)).fromMae, point.fromMae)
    assert.notEqual(poisoned[6] / poisoned[5] - 1, closes[6] / closes[5] - 1)

    const strong = {
      windowSupport: 2, t20Support: 2, windowDirection: 2, t20Direction: 2,
      cMinusSellCiLow: 1, tailReductionCiLow: 0.4, recoverN: 30, fallN: 25,
      fullMean: 3, fullTailReduced: true, lookAheadViolations: 0,
    }
    assert.equal(judgeHoldSell(strong).label, "T+5 상태 기반 Hold/Sell 의사결정 가치 강하게 지지")
    assert.equal(judgeHoldSell({ ...strong, windowSupport: 0, t20Support: 0, cMinusSellCiLow: -1, tailReductionCiLow: -1 }).label, "T+5 상태 기반 Hold/Sell 의사결정 가치 부분적으로 지지")
    assert.equal(judgeHoldSell({
      ...strong, windowSupport: 0, t20Support: 0, cMinusSellCiLow: -1, tailReductionCiLow: -1,
      fullMean: -1, fullTailReduced: false, recoverN: 5, fallN: 5,
    }).label, "실제 의사결정 가치 확인 실패")
  })

  it("keeps the stored 103 events and rejects a bar after T+5 in the predictor", () => {
    const v6 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v6-result.json"), "utf8"))
    const selected = selectMildEvents(v6.events)
    const needed = [...new Set(selected.map((row) => row.ticker))]
    const series = new Map(needed.map((symbol) => [symbol, loadSeries(symbol)]))
    const spy = loadSeries("SPY")
    const held = attachHold(attachRegime(attachSplit(selected, series, spy), spy), series)
    const early = attachEarly(attachShape(held, series))
    const events = attachTiming(attachForward(early, series), series)
    assert.doesNotThrow(() => assertBaseline(events))
    assert.doesNotThrow(() => assertV18Split(events))
    assert.doesNotThrow(() => assertEventList(events))
    assert.equal(events.length, 103)
    assert.equal(events.filter((row) => row.lowDay != null).length, 102)
    assert.equal(events.filter((row) => row.leadershipGroup === "HIGH").length, 15)
    assert.equal(events.filter((row) => row.leadershipGroup === "MID").length, 53)
    assert.equal(events.filter((row) => row.leadershipGroup === "LOW").length, 35)
    assert.equal(events.bandCounts.LOW, 34)
    assert.equal(events.bandCounts.MID, 34)
    assert.equal(events.bandCounts.HIGH, 35)
    const audit = auditLookAhead(events, series)
    assert.equal(audit.checked, 103)
    assert.equal(audit.violations, 0)
    const result = study(events, { lookAheadViolations: 0 })
    assert.equal(result.selectedStrategy, null)
    assert.equal(result.policies.window.B.mean, 0)
    assert.match(result.note, /not a sell rule/i)
    assert.equal(result.judgment.label, "T+5 상태 기반 Hold/Sell 의사결정 가치 강하게 지지")
  })
})
