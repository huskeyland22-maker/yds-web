/**
 * node --test scripts/equity-sell-backtest-v26.test.mjs
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
  attachHold,
  attachRegime,
  attachShape,
  attachSplit,
  auditLookAhead,
  fitFields,
  judgeTiming,
  loadOhlcv,
  measureCheckpoint,
  recoveryPoint,
  selectMildEvents,
  study,
} from "./lib/equity-sell-backtest-v26.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  return loadOhlcv(bars)
}

describe("equity sell backtest v26", () => {
  it("keeps each checkpoint inside its own close", () => {
    assert.equal(SELECTED_STRATEGY, null)
    const source = fs.readFileSync(new URL("./lib/equity-sell-backtest-v26.mjs", import.meta.url), "utf8")
    assert.equal(source.includes("vite-project"), false)
    const closes = [100, 97, 96, 98, 90, 99, 70]
    const t1 = measureCheckpoint(closes, 0, 1)
    const t3 = measureCheckpoint(closes, 0, 3)
    const t5 = measureCheckpoint(closes, 0, 5)
    assert.equal(recoveryPoint(t1).fromMae, 0)
    assert.equal(t1.recentSlope, t1.point)
    const cutT2 = closes.slice()
    cutT2[2] = 80
    assert.equal(recoveryPoint(measureCheckpoint(cutT2, 0, 1)).return, recoveryPoint(t1).return)
    assert.notEqual(recoveryPoint(measureCheckpoint(cutT2, 0, 3)).mae, recoveryPoint(t3).mae)
    const cutT4 = closes.slice()
    cutT4[4] = 80
    assert.equal(recoveryPoint(measureCheckpoint(cutT4, 0, 3)).fromMae, recoveryPoint(t3).fromMae)
    assert.notEqual(recoveryPoint(measureCheckpoint(cutT4, 0, 5)).mae, recoveryPoint(t5).mae)
    const cutT6 = closes.slice()
    cutT6[6] = 40
    assert.equal(recoveryPoint(measureCheckpoint(cutT6, 0, 1)).fromMae, recoveryPoint(t1).fromMae)
    assert.equal(recoveryPoint(measureCheckpoint(cutT6, 0, 3)).fromMae, recoveryPoint(t3).fromMae)
    assert.equal(recoveryPoint(measureCheckpoint(cutT6, 0, 5)).fromMae, recoveryPoint(t5).fromMae)

    const rows = [
      [-0.02, 0, 0.02, 0.01, -0.03, 0.02, 0.03, 0.04, 0.01],
      [-0.01, 1, 0.03, 0.04, -0.02, 0.01, 0.02, 0.05, -0.02],
      [-0.03, 0, 0.01, 0.02, -0.04, 0.04, 0.01, 0.02, 0.03],
      [-0.015, 1, 0.04, 0.06, -0.01, 0.005, 0.03, 0.06, -0.01],
      [-0.025, 0, 0.015, 0.03, -0.025, 0.03, 0.02, 0.01, 0.04],
      [-0.008, 1, 0.025, 0.05, -0.015, 0.01, 0.04, 0.03, 0],
      [-0.018, 0, 0.035, 0.015, -0.02, 0.02, 0.015, 0.025, 0.02],
      [-0.012, 1, 0.012, 0.07, -0.008, 0.015, 0.025, 0.02, -0.03],
    ].map((spec) => ({
      predictors: { t0: spec[0], leadership: spec[1], atrPct: spec[2] },
      early: {
        t1: { depth: spec[3], return: spec[4], recentSlope: spec[4], fromMae: 0, ratio: 0 },
        t3: { depth: spec[3], return: spec[4], fromMae: spec[5], ratio: 0.4, recentSlope: spec[6] },
        t5: { depth: spec[3] + 0.01, return: spec[4], fromMae: spec[7], ratio: 0.5, recentSlope: 0.01 },
        stateT3: "RECOVERING",
        stateT5: "RECOVERING",
      },
      hold: { returns: { window: spec[8] } },
    }))
    const fields = ["t0", "leadership", "eventAtr", "recoveryT3"]
    const fit = fitFields(rows, rows, (event) => event.hold.returns.window, fields)
    const changed = rows.map((row, index) => ({ ...row, hold: { returns: { window: index === 5 ? 9 : row.hold.returns.window } } }))
    const again = fitFields(rows, changed, (event) => event.hold.returns.window, fields)
    assert.deepEqual(again.train.standardized, fit.train.standardized)

    const strong = {
      closeSplits: 2, directionSplits: 2, looMin: 0.1, signFlips: [],
      t3WindowGap: 4, t3WindowCiLow: 0.5, t5WindowGap: 8, t5WindowCiLow: 1,
      lookAheadViolations: 0, t3Beta: 0.2, t3DepthControlled: true, r3Improves: 3, recoverN3: 30, fallN3: 25,
    }
    assert.equal(judgeTiming(strong).label, "T+3 조기 판단: 강하게 지지")
    assert.equal(judgeTiming({ ...strong, closeSplits: 0, t3WindowCiLow: -0.2 }).label, "T+3 조기 판단: 부분적으로 지지")
    assert.equal(judgeTiming({
      ...strong, closeSplits: 0, directionSplits: 0, looMin: -0.2, signFlips: ["NVDA"],
      t3WindowGap: -1, t3WindowCiLow: -2, t5WindowCiLow: -1, t3Beta: -0.1, t3DepthControlled: false, r3Improves: 0,
    }).label, "T+3 조기 판단: 확인 실패")
  })

  it("keeps the stored 103 events and rejects a bar after the checkpoint", () => {
    const v6 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v6-result.json"), "utf8"))
    const selected = selectMildEvents(v6.events)
    const needed = [...new Set(selected.map((row) => row.ticker))]
    const series = new Map(needed.map((symbol) => [symbol, loadSeries(symbol)]))
    const spy = loadSeries("SPY")
    const held = attachHold(attachRegime(attachSplit(selected, series, spy), spy), series)
    const events = attachEarly(attachShape(held, series))
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
    assert.equal(events.every((row) => row.early.t1.fromMae === 0), true)
    assert.equal(events.every((row) => row.early.t1.recentSlope === row.early.t1.return), true)
    const audit = auditLookAhead(events, series)
    assert.equal(audit.ok, true)
    assert.equal(audit.violations, 0)
    assert.equal(audit.checked, 309)
    const result = study(events, { lookAheadViolations: audit.violations })
    assert.equal(result.selectedStrategy, null)
    assert.equal(result.correlations.t1.recovery.window.spearman, null)
    assert.equal(result.note.includes("Not a sell rule"), true)
    assert.equal(result.judgment.label, "T+3 조기 판단: 부분적으로 지지")
    assert.equal(result.judgment.substituteCandidate, false)
  })
})
