/**
 * node --test scripts/equity-sell-backtest-v22.test.mjs
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
  attachEarly,
  attachHold,
  attachRegime,
  attachSplit,
  earlyPath,
  fitLinear,
  judgePath,
  loadOhlcv,
  selectMildEvents,
  study,
} from "./lib/equity-sell-backtest-v22.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  return loadOhlcv(bars)
}

describe("equity sell backtest v22", () => {
  it("keeps a checkpoint MAE inside the bars known on that day", () => {
    assert.equal(SELECTED_STRATEGY, null)
    const source = fs.readFileSync(new URL("./lib/equity-sell-backtest-v22.mjs", import.meta.url), "utf8")
    assert.equal(source.includes("vite-project"), false)
    assert.equal(source.includes("lowToWindow"), true)
    const closes = Array.from({ length: 30 }, () => 100)
    closes[11] = 97
    closes[12] = 90
    closes[15] = 94
    const t5 = earlyPath(closes, 10, 5)
    assert.ok(Math.abs(t5.mae + 0.1) < 1e-12)
    assert.ok(Math.abs(t5.return + 0.06) < 1e-12)
    assert.ok(Math.abs(t5.depth - 0.1) < 1e-12)
    const later = [...closes]
    later[20] = 50
    assert.equal(earlyPath(later, 10, 5).mae, t5.mae)
    assert.equal(earlyPath(closes.slice(0, 16), 10, 5).mae, t5.mae)
    const rows = [
      { t0: -0.01, leadership: 0, atrPct: 0.02, mae: 0, y: 0.01 },
      { t0: -0.02, leadership: 1, atrPct: 0.01, mae: -0.01, y: 0.02 },
      { t0: -0.015, leadership: 0, atrPct: 0.03, mae: -0.04, y: -0.01 },
      { t0: -0.03, leadership: 1, atrPct: 0.015, mae: -0.02, y: 0.03 },
      { t0: -0.005, leadership: 0, atrPct: 0.025, mae: -0.08, y: -0.02 },
      { t0: -0.025, leadership: 1, atrPct: 0.012, mae: -0.03, y: 0.04 },
    ].map((row) => ({
      predictors: { t0: row.t0, leadership: row.leadership, atrPct: row.atrPct },
      _mae: row.mae,
      hold: { returns: { t10: row.y, t20: row.y, window: row.y } },
    }))
    const fit = fitLinear(rows, rows, (event) => event.hold.returns.window, ["t0", "leadership", "checkpointMae"])
    const changed = rows.map((row, index) => ({ ...row, hold: { returns: { window: index === 5 ? 9 : row.hold.returns.window } } }))
    const again = fitLinear(rows, changed, (event) => event.hold.returns.window, ["t0", "leadership", "checkpointMae"])
    assert.deepEqual(again.beta, fit.beta)
    assert.equal(judgePath({
      depthRho: { t1: -0.2, t3: -0.3, t5: -0.4 },
      cut5Gap: { t1: 2, t3: 3, t5: 4 },
      cut5CiLow: { t1: 0.4, t3: 0.5, t5: 0.6 },
      cut10CiLow: { t1: null, t3: null, t5: null },
      cut10DeepN: { t1: 4, t3: 8, t5: 12 },
      controlled: { t1: true, t3: false, t5: false },
      oosAllSplits: { t1: true, t3: false, t5: false },
      looBase: { t1: 0.2, t3: 0.2, t5: 0.2 },
      looMin: { t1: 0.1, t3: 0.1, t5: 0.1 },
    }).label, "강하게 지지")
    assert.equal(judgePath({
      depthRho: { t1: -0.2, t3: 0.1, t5: -0.1 },
      cut5Gap: { t1: 2, t3: -1, t5: 1 },
      cut5CiLow: { t1: null, t3: null, t5: null },
      cut10CiLow: { t1: null, t3: null, t5: null },
      cut10DeepN: { t1: 4, t3: 4, t5: 4 },
      controlled: { t1: false, t3: false, t5: false },
      oosAllSplits: { t1: false, t3: false, t5: false },
      looBase: { t1: 0.2, t3: -0.1, t5: 0.1 },
      looMin: { t1: 0.1, t3: -0.2, t5: 0.05 },
    }).label, "부분적으로 지지")
    assert.equal(judgePath({
      depthRho: { t1: 0.2, t3: 0.1, t5: 0.3 },
      cut5Gap: { t1: -1, t3: -2, t5: -1 },
      cut5CiLow: { t1: -2, t3: -3, t5: -2 },
      cut10CiLow: { t1: null, t3: null, t5: null },
      cut10DeepN: { t1: 4, t3: 4, t5: 4 },
      controlled: { t1: false, t3: false, t5: false },
      oosAllSplits: { t1: false, t3: false, t5: false },
      looBase: { t1: -0.2, t3: -0.1, t5: -0.2 },
      looMin: { t1: -0.3, t3: -0.2, t5: -0.3 },
    }).label, "확인 실패")
  })

  it("keeps the stored 103 events, ATR groups, and chronological split", () => {
    const v6 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v6-result.json"), "utf8"))
    const selected = selectMildEvents(v6.events)
    const needed = [...new Set(selected.map((row) => row.ticker))]
    const series = new Map(needed.map((symbol) => [symbol, loadSeries(symbol)]))
    const spy = loadSeries("SPY")
    const held = attachHold(attachRegime(attachSplit(selected, series, spy), spy), series)
    const events = attachEarly(held, series)
    assert.doesNotThrow(() => assertBaseline(events))
    assert.doesNotThrow(() => assertV18Split(events))
    assert.equal(events.length, 103)
    assert.equal(events.filter((row) => row.lowDay != null).length, 102)
    assert.equal(events.bandCounts.LOW, 34)
    assert.equal(events.bandCounts.MID, 34)
    assert.equal(events.bandCounts.HIGH, 35)
    const result = study(events, { bootstrap: 20 })
    assert.equal(result.selectedStrategy, null)
    assert.equal(result.judgment.label, "부분적으로 지지")
    assert.equal(result.note.includes("Not a sell rule"), true)
  })
})
