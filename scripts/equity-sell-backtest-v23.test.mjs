/**
 * node --test scripts/equity-sell-backtest-v23.test.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
import {
  FAST_MAX_DAYS,
  SELECTED_STRATEGY,
  assertBaseline,
  assertV18Split,
  attachHold,
  attachRegime,
  attachShape,
  attachSplit,
  fitFields,
  judgeShape,
  loadOhlcv,
  measureCheckpoint,
  pathType,
  selectMildEvents,
  study,
} from "./lib/equity-sell-backtest-v23.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  return loadOhlcv(bars)
}

function flags(shape) {
  const next = { ...shape }
  next.t3 = { ...shape.t3, deterioration: shape.t3.mae < shape.t1.mae - 1e-12 ? 1 : 0 }
  next.t5 = {
    ...shape.t5,
    deterioration: shape.t5.mae < shape.t3.mae - 1e-12 ? 1 : 0,
  }
  next.t5.bothSteps = next.t3.deterioration === 1 && next.t5.deterioration === 1 ? 1 : 0
  return next
}

describe("equity sell backtest v23", () => {
  it("keeps depth, speed, and persistence inside the checkpoint", () => {
    assert.equal(SELECTED_STRATEGY, null)
    assert.equal(FAST_MAX_DAYS, 2)
    const source = fs.readFileSync(new URL("./lib/equity-sell-backtest-v23.mjs", import.meta.url), "utf8")
    assert.equal(source.includes("vite-project"), false)
    const closes = [100, 98, 96, 97, 95, 96, 50]
    const known = measureCheckpoint(closes, 0, 5)
    assert.equal(known.renewalCount, 2)
    assert.equal(known.daysToMae, 4)
    assert.ok(Math.abs(known.mae + 0.05) < 1e-12)
    assert.ok(Math.abs(known.depth - 0.05) < 1e-12)
    assert.ok(Math.abs(known.avgVelocity - 0.01) < 1e-12)
    const hidden = measureCheckpoint(closes.slice(0, 6), 0, 5)
    assert.equal(hidden.mae, known.mae)
    assert.equal(hidden.renewalCount, known.renewalCount)
    assert.equal(hidden.recentSlope, known.recentSlope)
    assert.equal(hidden.daysToMae, known.daysToMae)

    const fastCloses = [100, 94, 95, 95, 96, 96]
    const slowCloses = [100, 98, 97, 94, 95, 95]
    const fast = flags({
      t1: measureCheckpoint(fastCloses, 0, 1),
      t3: measureCheckpoint(fastCloses, 0, 3),
      t5: measureCheckpoint(fastCloses, 0, 5),
    })
    const slow = flags({
      t1: measureCheckpoint(slowCloses, 0, 1),
      t3: measureCheckpoint(slowCloses, 0, 3),
      t5: measureCheckpoint(slowCloses, 0, 5),
    })
    assert.ok(Math.abs(fast.t5.depth - slow.t5.depth) < 1e-12)
    assert.equal(pathType(fast, 0.03), "FAST_DROP")
    assert.equal(pathType(slow, 0.03), "GRADUAL")
    const later = [...slowCloses, 40]
    const slowLater = flags({
      t1: measureCheckpoint(later, 0, 1),
      t3: measureCheckpoint(later, 0, 3),
      t5: measureCheckpoint(later, 0, 5),
    })
    assert.equal(pathType(slowLater, 0.03), pathType(slow, 0.03))

    const specs = [
      [-0.02, 0, 0.02, 0.01, -0.01, 0.01],
      [-0.01, 1, 0.03, 0.04, 0.02, -0.02],
      [-0.03, 0, 0.01, 0.02, -0.03, 0.03],
      [-0.015, 1, 0.04, 0.06, 0.01, -0.01],
      [-0.025, 0, 0.015, 0.03, -0.02, 0.04],
      [-0.008, 1, 0.025, 0.05, 0.03, 0],
      [-0.018, 0, 0.035, 0.015, -0.005, 0.02],
      [-0.012, 1, 0.012, 0.07, 0.015, -0.03],
    ]
    const rows = specs.map((spec, index) => ({
      predictors: { t0: spec[0], leadership: spec[1], atrPct: spec[2] },
      shape: { t5: { depth: spec[3], recentSlope: spec[4], renewalCount: index % 3 } },
      hold: { returns: { window: spec[5] } },
    }))
    const fields = ["t0", "leadership", "eventAtr", "depth", "velocity"]
    const fit = fitFields(rows, rows, (event) => event.hold.returns.window, fields, "t5")
    const changed = rows.map((row, index) => ({
      ...row,
      hold: { returns: { window: index === 5 ? 9 : row.hold.returns.window } },
    }))
    const again = fitFields(rows, changed, (event) => event.hold.returns.window, fields, "t5")
    assert.deepEqual(again.train.standardized, fit.train.standardized)

    assert.equal(judgeShape({
      bToC: { 70: true, 60: true, 50: true },
      bToD: { 70: false, 60: false, 50: false },
      fastSlowUsable: true,
      persistUsable: false,
      fastSlowCiLow: 1.2,
      persistCiLow: null,
      fastSlowGap: 4,
      persistGap: null,
      slopeBeta: 0.2,
      renewalBeta: null,
      slopeLooMin: 0.1,
      renewalLooMax: null,
      inSampleVelocity: true,
      inSamplePersistence: false,
    }).label, "강하게 지지")
    assert.equal(judgeShape({
      bToC: { 70: true, 60: false, 50: false },
      bToD: { 70: false, 60: false, 50: false },
      fastSlowUsable: true,
      persistUsable: false,
      fastSlowCiLow: -1,
      persistCiLow: null,
      fastSlowGap: 2,
      persistGap: null,
      slopeBeta: 0.1,
      renewalBeta: -0.1,
      slopeLooMin: 0.05,
      renewalLooMax: -0.02,
      inSampleVelocity: true,
      inSamplePersistence: false,
    }).label, "부분적으로 지지")
    assert.equal(judgeShape({
      bToC: { 70: false, 60: false, 50: false },
      bToD: { 70: false, 60: false, 50: false },
      fastSlowUsable: true,
      persistUsable: true,
      fastSlowCiLow: -2,
      persistCiLow: -3,
      fastSlowGap: -1,
      persistGap: -2,
      slopeBeta: -0.1,
      renewalBeta: 0.2,
      slopeLooMin: -0.2,
      renewalLooMax: 0.3,
      inSampleVelocity: false,
      inSamplePersistence: false,
    }).label, "확인 실패")
  })

  it("keeps the stored 103 events, ATR groups, and chronological split", () => {
    const v6 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v6-result.json"), "utf8"))
    const selected = selectMildEvents(v6.events)
    const needed = [...new Set(selected.map((row) => row.ticker))]
    const series = new Map(needed.map((symbol) => [symbol, loadSeries(symbol)]))
    const spy = loadSeries("SPY")
    const held = attachHold(attachRegime(attachSplit(selected, series, spy), spy), series)
    const events = attachShape(held, series)
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
    assert.equal(events.filter((row) => row.shape.t1.renewalCount !== 0).length, 0)
    const result = study(events, { bootstrap: 20 })
    assert.equal(result.selectedStrategy, null)
    assert.equal(result.judgment.label, "부분적으로 지지")
    assert.equal(result.note.includes("Not a sell rule"), true)
  })
})
