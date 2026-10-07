/**
 * node --test scripts/equity-sell-backtest-v24.test.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
import {
  SELECTED_STRATEGY,
  assertBaseline,
  assertV18Split,
  attachHold,
  attachRecovery,
  attachRegime,
  attachShape,
  attachSplit,
  fitFields,
  judgeRecovery,
  loadOhlcv,
  measureCheckpoint,
  recoveryPoint,
  recoveryState,
  selectMildEvents,
  study,
} from "./lib/equity-sell-backtest-v24.mjs"

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

describe("equity sell backtest v24", () => {
  it("keeps the recovery state inside the T+5 checkpoint", () => {
    assert.equal(SELECTED_STRATEGY, null)
    const source = fs.readFileSync(new URL("./lib/equity-sell-backtest-v24.mjs", import.meta.url), "utf8")
    assert.equal(source.includes("vite-project"), false)
    assert.equal(source.includes("final Low"), false)
    const closes = [100, 98, 92, 94, 93, 97, 70]
    const t5 = measureCheckpoint(closes, 0, 5)
    const recovered = recoveryPoint(t5)
    assert.ok(Math.abs(t5.mae + 0.08) < 1e-12)
    assert.ok(Math.abs(t5.point + 0.03) < 1e-12)
    assert.ok(Math.abs(recovered.fromMae - 0.05) < 1e-12)
    const hidden = recoveryPoint(measureCheckpoint(closes.slice(0, 6), 0, 5))
    assert.equal(hidden.fromMae, recovered.fromMae)
    assert.equal(hidden.mae, recovered.mae)
    assert.equal(recoveryPoint({ point: -0.05, mae: -0.1, depth: 0.1 }).ratio, 0.5)
    assert.equal(recoveryPoint({ point: 0.02, mae: 0, depth: 0 }).ratio, null)

    const recovering = { return: -0.02, mae: -0.06 }
    const base = { return: -0.04, mae: -0.06 }
    assert.equal(recoveryState(base, recovering), "RECOVERING")
    assert.equal(recoveryState(base, { return: -0.03, mae: -0.08 }), "STABILIZING")
    assert.equal(recoveryState(base, { return: -0.05, mae: -0.05 }), "STILL_FALLING")
    assert.equal(recoveryState(base, { return: -0.04, mae: -0.06 }), "STILL_FALLING")
    const laterLow = measureCheckpoint([...closes.slice(0, 6), 70], 0, 5)
    assert.equal(recoveryState(point(measureCheckpoint(closes, 0, 3).point, measureCheckpoint(closes, 0, 3).mae), point(laterLow.point, laterLow.mae)), recoveryState(point(measureCheckpoint(closes.slice(0, 6), 0, 3).point, measureCheckpoint(closes.slice(0, 6), 0, 3).mae), point(measureCheckpoint(closes.slice(0, 6), 0, 5).point, measureCheckpoint(closes.slice(0, 6), 0, 5).mae)))

    const rows = [
      [-0.02, 0, 0.02, 0.01, 0.02, 0.01],
      [-0.01, 1, 0.03, 0.04, 0.01, -0.02],
      [-0.03, 0, 0.01, 0.02, 0.04, 0.03],
      [-0.015, 1, 0.04, 0.06, 0.005, -0.01],
      [-0.025, 0, 0.015, 0.03, 0.03, 0.04],
      [-0.008, 1, 0.025, 0.05, 0.01, 0],
      [-0.018, 0, 0.035, 0.015, 0.02, 0.02],
      [-0.012, 1, 0.012, 0.07, 0.015, -0.03],
    ].map((spec) => ({
      predictors: { t0: spec[0], leadership: spec[1], atrPct: spec[2] },
      recovery: { t5: { depth: spec[3], fromMae: spec[4], ratio: spec[4] / spec[3] } },
      hold: { returns: { window: spec[5] } },
    }))
    const fields = ["t0", "leadership", "eventAtr", "depth", "recovery"]
    const fit = fitFields(rows, rows, (event) => event.hold.returns.window, fields)
    const changed = rows.map((row, index) => ({
      ...row,
      hold: { returns: { window: index === 5 ? 9 : row.hold.returns.window } },
    }))
    const again = fitFields(rows, changed, (event) => event.hold.returns.window, fields)
    assert.deepEqual(again.train.standardized, fit.train.standardized)

    assert.equal(judgeRecovery({
      recoverN: 30,
      fallN: 25,
      windowGap: 4,
      windowCiLow: 0.8,
      recoveryBeta: 0.2,
      depthControlledImproves: true,
      bToD: { 70: true, 60: true, 50: true },
      aToC: { 70: true, 60: true, 50: true },
      looMin: 0.1,
      signFlips: [],
    }).label, "강하게 지지")
    assert.equal(judgeRecovery({
      recoverN: 30,
      fallN: 25,
      windowGap: 4,
      windowCiLow: -0.2,
      recoveryBeta: 0.2,
      depthControlledImproves: true,
      bToD: { 70: true, 60: false, 50: true },
      aToC: { 70: false, 60: false, 50: false },
      looMin: 0.1,
      signFlips: [],
    }).label, "부분적으로 지지")
    assert.equal(judgeRecovery({
      recoverN: 30,
      fallN: 25,
      windowGap: -1,
      windowCiLow: -3,
      recoveryBeta: -0.1,
      depthControlledImproves: false,
      bToD: { 70: false, 60: false, 50: false },
      aToC: { 70: false, 60: false, 50: false },
      looMin: -0.2,
      signFlips: ["NVDA"],
    }).label, "확인 실패")
  })

  it("keeps the stored 103 events, ATR groups, and chronological split", () => {
    const v6 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v6-result.json"), "utf8"))
    const selected = selectMildEvents(v6.events)
    const needed = [...new Set(selected.map((row) => row.ticker))]
    const series = new Map(needed.map((symbol) => [symbol, loadSeries(symbol)]))
    const spy = loadSeries("SPY")
    const held = attachHold(attachRegime(attachSplit(selected, series, spy), spy), series)
    const events = attachRecovery(attachShape(held, series))
    assert.doesNotThrow(() => assertBaseline(events))
    assert.doesNotThrow(() => assertV18Split(events))
    assert.equal(events.length, 103)
    assert.equal(events.filter((row) => row.lowDay != null).length, 102)
    assert.equal(events.filter((row) => row.leadershipGroup === "HIGH").length, 15)
    assert.equal(events.filter((row) => row.leadershipGroup === "MID").length, 53)
    assert.equal(events.filter((row) => row.leadershipGroup === "LOW").length, 35)
    assert.equal(events.bandCounts.LOW, 34)
    assert.equal(events.bandCounts.MID, 34)
    assert.equal(events.bandCounts.HIGH, 35)
    assert.equal(events.every((row) => row.recovery.t5.fromMae >= -1e-12), true)
    assert.equal(events.filter((row) => !row.recovery.state).length, 0)
    const result = study(events)
    assert.equal(result.selectedStrategy, null)
    assert.equal(result.judgment.label, "강하게 지지")
    assert.equal(result.note.includes("Not a sell rule"), true)
  })
})
