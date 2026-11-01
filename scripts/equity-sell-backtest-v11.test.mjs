/**
 * node --test scripts/equity-sell-backtest-v11.test.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
import { loadOhlcv, selectMildEvents, studyFactors } from "./lib/equity-sell-backtest-v9.mjs"
import {
  SELECTED_STRATEGY,
  attachSpeed,
  hitDay,
  judgeReboundShape,
} from "./lib/equity-sell-backtest-v11.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  return loadOhlcv(bars)
}

describe("equity sell backtest v11", () => {
  it("counts hit days after the low and leaves a miss empty", () => {
    assert.equal(SELECTED_STRATEGY, null)
    const closes = Array.from({ length: 30 }, () => 100)
    closes[10] = 100
    closes[11] = 103
    closes[15] = 110
    assert.equal(hitDay(closes, 10, 29, 0.03), 1)
    assert.equal(hitDay(closes, 10, 29, 0.1), 5)
    assert.equal(hitDay(closes, 10, 29, 0.2), null)
    const flat = Array.from({ length: 20 }, () => 100)
    assert.equal(hitDay(flat, 5, 19, 0.05), null)
  })

  it("keeps the correction-day ATR fixed when a later close reaches the rebound sooner", () => {
    const closes = Array.from({ length: 100 }, () => 100)
    closes[30] = 120
    for (let index = 31; index <= 34; index++) closes[index] = 115
    closes[35] = 108
    closes[40] = 90
    for (let index = 41; index < closes.length; index++) closes[index] = 91
    const series = {
      highs: closes.map((close) => close + 1),
      lows: closes.map((close) => close - 1),
      closes,
      volumes: closes.map(() => 1000),
    }
    const before = studyFactors(series, 20, 35)
    assert.equal(hitDay(series.closes, 40, 80, 0.1), null)
    series.closes[45] = 110
    assert.equal(hitDay(series.closes, 40, 80, 0.1), 5)
    assert.deepEqual(studyFactors(series, 20, 35), before)
  })

  it("labels size and speed together only when both links are present", () => {
    const row = (rho, n = 40) => ({ rho, n })
    assert.deepEqual(judgeReboundShape({ windowRho: 0.41, time5: row(-0.2), time10: row(-0.2), time20: row(-0.2) }), { A: "기각", B: "지지", C: "지지" })
    assert.deepEqual(judgeReboundShape({ windowRho: 0.41, time5: row(-0.02), time10: row(0.04), time20: row(0.01) }), { A: "지지", B: "기각", C: "기각" })
    assert.deepEqual(judgeReboundShape({ windowRho: 0.41, time5: row(-0.08), time10: row(-0.08), time20: row(-0.02) }), { A: "약한 지지", B: "약한 지지", C: "약한 지지" })
    assert.equal(judgeReboundShape({ windowRho: 0.41, time5: row(-0.3, 4), time10: row(-0.3, 8), time20: row(-0.3) }).B, "표본 부족")
  })

  it("matches the stored v10 events, ATR bands, and low-to-window returns", () => {
    const v6 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v6-result.json"), "utf8"))
    const v10 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v10-result.json"), "utf8"))
    const selected = selectMildEvents(v6.events)
    const needed = [...new Set(selected.map((event) => event.ticker))]
    const series = new Map(needed.map((symbol) => [symbol, loadSeries(symbol)]))
    const events = attachSpeed(selected, series)
    assert.equal(events.length, 103)
    assert.equal(events.filter((event) => event.leadershipGroup === "HIGH").length, 15)
    assert.equal(events.filter((event) => event.leadershipGroup === "MID").length, 53)
    assert.equal(events.filter((event) => event.leadershipGroup === "LOW").length, 35)
    assert.deepEqual(events.bandCounts, { LOW: 34, MID: 34, HIGH: 35 })
    for (let index = 0; index < events.length; index++) {
      const prior = v10.events[index]
      const event = events[index]
      assert.equal(event.eventId, prior.eventId)
      assert.equal(event.atrBand, prior.atrBand)
      if (prior.lowToWindow == null) assert.equal(event.lowToWindow, null)
      else assert.ok(Math.abs(event.lowToWindow - prior.lowToWindow) <= 1e-10)
      if (event.lowDay == null) assert.equal(event.hits["10"].days, null)
    }
  })
})
