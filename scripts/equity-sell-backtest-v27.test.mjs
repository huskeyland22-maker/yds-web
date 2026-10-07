/**
 * node --test scripts/equity-sell-backtest-v27.test.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
import { attachRisk } from "./lib/equity-sell-backtest-v21.mjs"
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
  auditLookAhead,
  fitFields,
  judgeDecision,
  judgeIndependence,
  loadOhlcv,
  measureCheckpoint,
  recoveryAlgebra,
  recoveryPoint,
  selectMildEvents,
  study,
} from "./lib/equity-sell-backtest-v27.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  return loadOhlcv(bars)
}

describe("equity sell backtest v27", () => {
  it("keeps T+5 recovery inside the T+5 close and treats it as return minus MAE", () => {
    assert.equal(SELECTED_STRATEGY, null)
    const source = fs.readFileSync(new URL("./lib/equity-sell-backtest-v27.mjs", import.meta.url), "utf8")
    assert.equal(source.includes("vite-project"), false)
    const closes = [100, 97, 96, 98, 90, 99, 70]
    const t5 = measureCheckpoint(closes, 0, 5)
    const point = recoveryPoint(t5)
    const algebra = recoveryAlgebra(point)
    assert.equal(algebra.equalsReturnMinusMae, true)
    assert.equal(point.fromMae, point.return - point.mae)
    const cutT6 = closes.slice()
    cutT6[6] = 40
    assert.equal(recoveryPoint(measureCheckpoint(cutT6, 0, 5)).fromMae, point.fromMae)
    const cutT4 = closes.slice()
    cutT4[4] = 80
    assert.notEqual(recoveryPoint(measureCheckpoint(cutT4, 0, 5)).mae, point.mae)

    const rows = [
      [-0.02, 0, 0.02, 0.01, -0.03, 0.02, 0.04],
      [-0.01, 1, 0.03, 0.04, -0.02, 0.01, 0.05],
      [-0.03, 0, 0.01, 0.02, -0.04, 0.04, 0.02],
      [-0.015, 1, 0.04, 0.06, -0.01, 0.005, 0.06],
      [-0.025, 0, 0.015, 0.03, -0.025, 0.03, 0.01],
      [-0.008, 1, 0.025, 0.05, -0.015, 0.01, 0.03],
      [-0.018, 0, 0.035, 0.015, -0.02, 0.02, 0.025],
      [-0.012, 1, 0.012, 0.07, -0.008, 0.015, 0.02],
    ].map((spec) => ({
      predictors: { t0: spec[0], leadership: spec[1], atrPct: spec[2] },
      early: {
        t3: { depth: spec[3], return: spec[4], fromMae: spec[5], mae: spec[4] - spec[5], recentSlope: 0 },
        t5: { depth: spec[3], return: spec[4], fromMae: spec[6], mae: spec[4] - spec[6], ratio: 0.5, recentSlope: 0.01 },
        stateT5: "RECOVERING",
      },
      hold: { returns: { window: spec[6] } },
    }))
    const fields = ["t0", "leadership", "eventAtr", "recoveryT5"]
    const fit = fitFields(rows, rows, (event) => event.hold.returns.window, fields)
    const changed = rows.map((row, index) => ({ ...row, hold: { returns: { window: index === 5 ? 9 : row.hold.returns.window } } }))
    const again = fitFields(rows, changed, (event) => event.hold.returns.window, fields)
    assert.deepEqual(again.train.standardized, fit.train.standardized)

    const strong = {
      m7Fit: true, recoveryBeta: 0.2, m5ToM7Window: true, m5ToM7T20: true,
      bToCWindow: 3, bToCHold: 2, looMin: 0.2, signFlips: [],
      windowCiLow: 1, t20CiLow: 1, lookAheadViolations: 0,
    }
    assert.equal(judgeIndependence(strong).label, "T+5 Recovery: 독립 신호 강하게 지지")
    assert.equal(judgeIndependence({ ...strong, bToCWindow: 2, m5ToM7T20: false }).label, "T+5 Recovery: 독립 신호 부분적으로 지지")
    assert.equal(judgeIndependence({ ...strong, m7Fit: false, recoveryBeta: null, m5ToM7Window: false, m5ToM7T20: false, bToCWindow: 0 }).label, "T+5 Recovery: 독립 신호 확인 실패")

    const decision = {
      recoverN: 30, fallN: 25, forwardWindowGap: 4, forwardT20Gap: 3,
      forwardWindowCiLow: 1, forwardT20CiLow: 0.5, permWindow: 0.01,
      recoverTail10: 8, fallTail10: 20, lookAheadViolations: 0,
    }
    assert.equal(judgeDecision(decision).label, "실제 의사결정 가치: 강하게 지지")
    assert.equal(judgeDecision({ ...decision, forwardWindowCiLow: -1, permWindow: 0.2 }).label, "실제 의사결정 가치: 부분적으로 지지")
    assert.equal(judgeDecision({ ...decision, forwardWindowGap: -1, recoverN: 5 }).label, "실제 의사결정 가치: 확인 실패")
  })

  it("keeps the stored 103 events and rejects a bar after T+5", () => {
    const v6 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v6-result.json"), "utf8"))
    const selected = selectMildEvents(v6.events)
    const needed = [...new Set(selected.map((row) => row.ticker))]
    const series = new Map(needed.map((symbol) => [symbol, loadSeries(symbol)]))
    const spy = loadSeries("SPY")
    const held = attachHold(attachRegime(attachSplit(selected, series, spy), spy), series)
    const early = attachEarly(attachShape(held, series))
    const events = attachForward(attachRisk(early, series), series)
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
    assert.equal(result.identity.recoveryEqualsReturnMinusMae, true)
    assert.equal(result.selectedStrategy, null)
    assert.match(result.note, /Not a sell rule/)
    assert.equal(result.judgment.independence.label, "T+5 Recovery: 독립 신호 확인 실패")
    assert.equal(result.judgment.decision.label, "실제 의사결정 가치: 부분적으로 지지")
  })
})
