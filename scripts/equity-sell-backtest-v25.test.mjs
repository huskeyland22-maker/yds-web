/**
 * node --test scripts/equity-sell-backtest-v25.test.mjs
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
  closeToLater,
  fitFields,
  judgeEarly,
  loadOhlcv,
  measureCheckpoint,
  recoveryPoint,
  recoveryState,
  selectMildEvents,
  study,
} from "./lib/equity-sell-backtest-v25.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  return loadOhlcv(bars)
}

function point(ret, mae) {
  return { return: ret, mae, fromMae: ret - mae }
}

describe("equity sell backtest v25", () => {
  it("keeps T+3 predictors inside the T+3 close", () => {
    assert.equal(SELECTED_STRATEGY, null)
    const source = fs.readFileSync(new URL("./lib/equity-sell-backtest-v25.mjs", import.meta.url), "utf8")
    assert.equal(source.includes("vite-project"), false)
    assert.equal(source.includes("attachEarly"), true)
    const closes = [100, 95, 96, 98, 90, 99, 70]
    const t3 = measureCheckpoint(closes, 0, 3)
    const recovered = recoveryPoint(t3)
    assert.ok(Math.abs(t3.mae + 0.05) < 1e-12)
    assert.ok(Math.abs(t3.point + 0.02) < 1e-12)
    assert.ok(Math.abs(recovered.fromMae - 0.03) < 1e-12)
    const hiddenT3 = recoveryPoint(measureCheckpoint(closes.slice(0, 4), 0, 3))
    assert.equal(hiddenT3.fromMae, recovered.fromMae)
    assert.equal(hiddenT3.mae, recovered.mae)
    const shifted = closes.slice()
    shifted[4] = 80
    assert.equal(recoveryPoint(measureCheckpoint(shifted, 0, 3)).fromMae, recovered.fromMae)
    assert.notEqual(recoveryPoint(measureCheckpoint(shifted, 0, 5)).mae, recoveryPoint(measureCheckpoint(closes, 0, 5)).mae)
    const afterT5 = closes.slice()
    afterT5[6] = 40
    assert.equal(recoveryPoint(measureCheckpoint(afterT5, 0, 5)).fromMae, recoveryPoint(measureCheckpoint(closes, 0, 5)).fromMae)
    assert.equal(recoveryPoint(measureCheckpoint(closes, 0, 1)).fromMae, 0)
    assert.equal(recoveryPoint({ point: -0.05, mae: -0.1, depth: 0.1 }).ratio, 0.5)
    assert.equal(recoveryPoint({ point: 0.02, mae: 0, depth: 0 }).ratio, null)

    const t1 = point(-0.05, -0.05)
    assert.equal(recoveryState(t1, { return: -0.02, mae: -0.05 }), "RECOVERING")
    assert.equal(recoveryState(t1, { return: -0.03, mae: -0.08 }), "STABILIZING")
    assert.equal(recoveryState(t1, { return: -0.06, mae: -0.06 }), "STILL_FALLING")
    assert.equal(recoveryState(t1, point(-0.05, -0.05)), "STILL_FALLING")
    const t3State = recoveryState(point(measureCheckpoint(closes, 0, 1).point, measureCheckpoint(closes, 0, 1).mae), point(t3.point, t3.mae))
    const later = closes.slice()
    later[6] = 40
    const t3Later = measureCheckpoint(later, 0, 3)
    assert.equal(recoveryState(point(measureCheckpoint(later, 0, 1).point, measureCheckpoint(later, 0, 1).mae), point(t3Later.point, t3Later.mae)), t3State)

    const rows = [
      [-0.02, 0, 0.02, 0.01, 0.02, 0.03, 0.01],
      [-0.01, 1, 0.03, 0.04, 0.01, 0.02, -0.02],
      [-0.03, 0, 0.01, 0.02, 0.04, 0.01, 0.03],
      [-0.015, 1, 0.04, 0.06, 0.005, 0.04, -0.01],
      [-0.025, 0, 0.015, 0.03, 0.03, 0.015, 0.04],
      [-0.008, 1, 0.025, 0.05, 0.01, 0.025, 0],
      [-0.018, 0, 0.035, 0.015, 0.02, 0.03, 0.02],
      [-0.012, 1, 0.012, 0.07, 0.015, 0.01, -0.03],
    ].map((spec) => ({
      predictors: { t0: spec[0], leadership: spec[1], atrPct: spec[2] },
      early: {
        t3: { depth: spec[3], fromMae: spec[4], ratio: spec[4] / spec[3] },
        t5: { depth: spec[3] + 0.01, fromMae: spec[5], ratio: 0.5 },
        stateT3: spec[1] === 1 ? "RECOVERING" : "STILL_FALLING",
      },
      hold: { returns: { window: spec[6] } },
    }))
    const fields = ["t0", "leadership", "eventAtr", "recoveryT3"]
    const fit = fitFields(rows, rows, (event) => event.hold.returns.window, fields)
    const changed = rows.map((row, index) => ({
      ...row,
      hold: { returns: { window: index === 5 ? 9 : row.hold.returns.window } },
    }))
    const again = fitFields(rows, changed, (event) => event.hold.returns.window, fields)
    assert.deepEqual(again.train.standardized, fit.train.standardized)

    assert.equal(closeToLater({ oosR2: 0.14, spearman: 0.35 }, { oosR2: 0.18, spearman: 0.4 }), true)
    assert.equal(closeToLater({ oosR2: 0.04, spearman: 0.1 }, { oosR2: 0.2, spearman: 0.4 }), false)
    assert.equal(judgeEarly({
      recoverN: 30,
      fallN: 25,
      windowGap: 4,
      windowCiLow: 0.8,
      recoveryBeta: 0.2,
      depthControlledImproves: true,
      aToB: { 70: true, 60: true, 50: true },
      close: { 70: true, 60: true, 50: true },
      looMin: 0.1,
      signFlips: [],
    }).label, "조기 회복 신호: 강하게 지지")
    assert.equal(judgeEarly({
      recoverN: 30,
      fallN: 25,
      windowGap: 4,
      windowCiLow: -0.2,
      recoveryBeta: 0.2,
      depthControlledImproves: true,
      aToB: { 70: true, 60: false, 50: true },
      close: { 70: false, 60: false, 50: false },
      looMin: 0.1,
      signFlips: [],
    }).label, "조기 회복 신호: 부분적으로 지지")
    assert.equal(judgeEarly({
      recoverN: 30,
      fallN: 25,
      windowGap: 1,
      windowCiLow: -1,
      recoveryBeta: -0.1,
      depthControlledImproves: false,
      aToB: { 70: false, 60: true, 50: false },
      close: { 70: false, 60: false, 50: false },
      looMin: -0.2,
      signFlips: ["NVDA"],
    }).label, "조기 회복 신호: 확인 실패")
  })

  it("keeps the stored 103 events and rejects a future bar in the predictor", () => {
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
    assert.equal(events.every((row) => row.early.t3.fromMae >= -1e-12 && row.early.t5.fromMae >= -1e-12), true)
    assert.equal(events.every((row) => row.early.t1.fromMae === 0), true)
    assert.equal(events.filter((row) => !row.early.stateT3 || !row.early.stateT5).length, 0)
    const audit = auditLookAhead(events, series)
    assert.equal(audit.ok, true)
    assert.equal(audit.violations, 0)
    assert.equal(audit.checked, 206)
    const result = study(events)
    assert.equal(result.selectedStrategy, null)
    assert.equal(result.judgment.label, "조기 회복 신호: 부분적으로 지지")
    assert.equal(result.note.includes("Not a sell rule"), true)
  })
})
