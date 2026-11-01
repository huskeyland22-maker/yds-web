/**
 * node --test scripts/equity-sell-backtest-v12.test.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
import { predictorBlock } from "./lib/equity-sell-backtest-v7.mjs"
import {
  SELECTED_STRATEGY,
  attachProfile,
  conditionalContrasts,
  entryLocation,
  judgeAssociation,
  judgeContrasts,
  selectMildEvents,
  speedSide,
  standardizedFit,
} from "./lib/equity-sell-backtest-v12.mjs"
import { loadOhlcv } from "./lib/equity-sell-backtest-v12.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  return loadOhlcv(bars)
}

describe("equity sell backtest v12", () => {
  it("places the correction close in the prior range and keeps the speed split fixed", () => {
    assert.equal(SELECTED_STRATEGY, null)
    const closes = Array.from({ length: 80 }, () => 100)
    closes[40] = 80
    closes[60] = 120
    const location = entryLocation(closes, 60)
    assert.ok(location.distMa50 > 0)
    assert.ok(location.pos60 > 1)
    closes[61] = 50
    assert.deepEqual(entryLocation(closes, 60), location)
    assert.equal(speedSide(1, 2), "FAST")
    assert.equal(speedSide(2, 2), "FAST")
    assert.equal(speedSide(3, 2), "SLOW")
    const rows = [1, 2, 3, 4, 5].map((value) => ({ y: value, x: value }))
    const fit = standardizedFit(rows, ["x"])
    assert.equal(fit.coefficients.find((row) => row.name === "x").coefficient, 1)
    assert.equal(judgeAssociation(100, 0.04), "차이 없음")
    assert.equal(judgeAssociation(100, 0.12), "약한 차이")
    assert.equal(judgeAssociation(100, -0.3), "명확한 차이")
    assert.equal(judgeAssociation(8, 0.4), "표본 부족")
    assert.equal(judgeContrasts([{ judgment: "표본 부족" }, { judgment: "표본 부족" }]), "표본 부족")
    const contrasts = conditionalContrasts([
      { leadership: "HIGH", atr: "HIGH", n: 10 },
      { leadership: "HIGH", atr: "LOW", n: 1 },
      { leadership: "LOW", atr: "HIGH", n: 8 },
      { leadership: "LOW", atr: "LOW", n: 16 },
    ])
    assert.ok(contrasts.every((row) => row.judgment === "표본 부족"))
  })

  it("keeps entry predictors fixed when a later close changes", () => {
    const closes = Array.from({ length: 100 }, () => 100)
    closes[30] = 120
    for (let index = 31; index <= 34; index++) closes[index] = 115
    closes[35] = 108
    const series = {
      dates: closes.map((_, index) => `2020-04-${String(index + 1).padStart(2, "0")}`),
      highs: closes.map((close) => close + 1),
      lows: closes.map((close) => close - 1),
      closes,
      volumes: closes.map(() => 1000),
    }
    const before = predictorBlock(series, 20, 35)
    const place = entryLocation(series.closes, 35)
    series.closes[50] = 70
    series.volumes[50] = 5
    assert.equal(predictorBlock(series, 20, 35).atrPct, before.atrPct)
    assert.equal(predictorBlock(series, 20, 35).correctionSpeed, before.correctionSpeed)
    assert.equal(predictorBlock(series, 20, 35).volumeRatio20, before.volumeRatio20)
    assert.deepEqual(entryLocation(series.closes, 35), place)
  })

  it("matches the stored v11 events, ATR bands, window rebound, and +10% hit days", () => {
    const v6 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v6-result.json"), "utf8"))
    const v11 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v11-result.json"), "utf8"))
    const selected = selectMildEvents(v6.events)
    const needed = [...new Set(selected.map((event) => event.ticker))]
    const series = new Map(needed.map((symbol) => [symbol, loadSeries(symbol)]))
    const events = attachProfile(selected, series)
    assert.equal(events.length, 103)
    assert.equal(events.filter((event) => event.leadershipGroup === "HIGH").length, 15)
    assert.equal(events.filter((event) => event.leadershipGroup === "MID").length, 53)
    assert.equal(events.filter((event) => event.leadershipGroup === "LOW").length, 35)
    assert.deepEqual(events.bandCounts, { LOW: 34, MID: 34, HIGH: 35 })
    assert.equal(events.speedCount, 103)
    assert.equal(events.filter((event) => event.speedSide === "FAST").length + events.filter((event) => event.speedSide === "SLOW").length, 103)
    for (let index = 0; index < events.length; index++) {
      const prior = v11.events[index]
      const event = events[index]
      assert.equal(event.eventId, prior.eventId)
      assert.equal(event.atrBand, prior.atrBand)
      if (prior.lowToWindow == null) assert.equal(event.lowToWindow, null)
      else assert.ok(Math.abs(event.lowToWindow - prior.lowToWindow) <= 1e-10)
      assert.equal(event.hits["10"].days, prior.hits["10"].days)
      assert.ok(event.predictors.distMa50 === null || Number.isFinite(event.predictors.distMa50))
    }
  })
})
