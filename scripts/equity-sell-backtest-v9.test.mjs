/**
 * node --test scripts/equity-sell-backtest-v9.test.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
import { partialSpearman } from "./lib/equity-sell-backtest-v4.mjs"
import { selectMildEvents } from "./lib/equity-sell-backtest-v7.mjs"
import {
  SELECTED_STRATEGY,
  assignAtrBands,
  fitInferred,
  judgeCombination,
  judgeFade,
  judgeInteraction,
  partialSpearmanControls,
  presentCell,
  studyFactors,
  studyOutcomes,
} from "./lib/equity-sell-backtest-v9.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function correctionSeries() {
  const closes = Array.from({ length: 100 }, () => 100)
  closes[30] = 120
  for (let index = 31; index <= 34; index++) closes[index] = 115
  closes[35] = 108
  return {
    highs: closes.map((close) => close + 1),
    lows: closes.map((close) => close - 1),
    closes,
    volumes: closes.map(() => 1000),
  }
}

describe("equity sell backtest v9", () => {
  it("keeps the 103 v8 events, the leadership groups, and a null strategy", () => {
    assert.equal(SELECTED_STRATEGY, null)
    const v6 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v6-result.json"), "utf8"))
    const v8 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v8-result.json"), "utf8"))
    const events = selectMildEvents(v6.events)
    assert.equal(events.length, 103)
    assert.equal(events.filter((event) => event.leadershipGroup === "HIGH").length, 15)
    assert.equal(events.filter((event) => event.leadershipGroup === "MID").length, 53)
    assert.equal(events.filter((event) => event.leadershipGroup === "LOW").length, 35)
    assert.deepEqual(events.map((event) => event.eventId), v8.events.map((event) => event.eventId))
    for (const event of events) {
      const stored = v8.events.find((row) => row.eventId === event.eventId)
      assert.equal(event.leadershipGroup, stored.leadershipGroup)
      assert.ok(event.t0 >= -0.05 && event.t0 < 0)
    }
  })

  it("keeps entry predictors unchanged when a later bar changes", () => {
    const series = correctionSeries()
    const before = studyFactors(series, 20, 35)
    assert.equal(before.matched, true)
    assert.ok(before.atrPct > 0)
    assert.equal(before.atrLog, Math.log(before.atrPct))
    assert.equal(before.atrOverVol, before.atrPct / before.vol20)
    const outcome = studyOutcomes(series.closes, 20, 35, series.closes[20])
    series.highs[36] = 500
    series.lows[36] = 1
    series.closes[36] = 250
    series.volumes[40] = 1
    assert.deepEqual(studyFactors(series, 20, 35), before)
    series.closes[40] = 180
    const later = studyOutcomes(series.closes, 20, 35, series.closes[20])
    assert.notEqual(later.entry.t5, outcome.entry.t5)
    assert.deepEqual(studyFactors(series, 20, 35), before)
  })

  it("splits absolute ATR into three near-equal bands and matches a one-control partial", () => {
    const events = Array.from({ length: 9 }, (_, index) => ({
      eventId: `E${index}`,
      factors: { atrPct: index + 1 },
    }))
    const tagged = assignAtrBands(events)
    assert.deepEqual(tagged.bandCounts, { LOW: 3, MID: 3, HIGH: 3 })
    assert.deepEqual(
      tagged.filter((event) => event.atrBand === "LOW").map((event) => event.factors.atrPct),
      [1, 2, 3],
    )
    assert.deepEqual(
      tagged.filter((event) => event.atrBand === "HIGH").map((event) => event.factors.atrPct),
      [7, 8, 9],
    )
    const pairs = [
      { x: 1, y: 2, z: 3 },
      { x: 2, y: 1, z: 4 },
      { x: 4, y: 5, z: 1 },
      { x: 3, y: 4, z: 2 },
      { x: 6, y: 3, z: 5 },
      { x: 5, y: 6, z: 0 },
    ]
    const single = partialSpearman(pairs)
    const multi = partialSpearmanControls(pairs.map((pair) => ({ x: pair.x, y: pair.y, controls: [pair.z] })))
    assert.equal(multi.n, single.n)
    assert.equal(multi.rho, single.rho)
  })

  it("recovers a known line and withholds small leadership-ATR cells", () => {
    const rows = Array.from({ length: 8 }, (_, index) => ({ y: 1 + 2 * index + 3 * (index % 3), t0: index, leadership: index % 3 }))
    const fit = fitInferred(rows, ["t0", "leadership"])
    assert.equal(fit.r2, 1)
    assert.equal(fit.coefficients[0].coefficient, 1)
    assert.equal(fit.coefficients[1].coefficient, 2)
    assert.equal(fit.coefficients[2].coefficient, 3)
    assert.equal(presentCell({ n: 3, window: { avg: 9 } }).status, "insufficient")
    assert.equal(presentCell({ n: 3 }).values, undefined)
    assert.equal(presentCell({ n: 7, t10: 1, t20: 2, window: 3, lowT20: 4, lowWindow: 5 }).status, "numbers_only")
    assert.equal(presentCell({ n: 12, t10: 1, t20: 2, window: 3, lowT20: 4, lowWindow: 5 }).status, "limited")
    const horizon = (rho, n = 40) => ({ rho, n })
    assert.equal(judgeFade({ t5: horizon(0.4), t10: horizon(0.4), t20: horizon(0.05), t40: horizon(0.05), window: horizon(0.05) }), "지지")
    assert.equal(judgeFade({ t5: horizon(0.4), t10: horizon(0.4), t20: horizon(0.3), t40: horizon(0.3), window: horizon(0.3) }), "약한 지지")
    assert.equal(judgeFade({ t5: horizon(0.3), t10: horizon(0.3), t20: horizon(0.32), t40: horizon(0.31), window: horizon(0.33) }), "기각")
    assert.equal(judgeFade({ t5: horizon(0.4, 4), t10: horizon(0.4), t20: horizon(0.05), t40: horizon(0.05), window: horizon(0.05) }), "표본 부족")
    assert.equal(judgeInteraction({ n: 20, rho: 0.4 }, { n: 20, rho: 0.1 }), "지지")
    assert.equal(judgeInteraction({ n: 20, rho: 0.2 }, { n: 20, rho: 0.16 }), "약한 지지")
    assert.equal(judgeInteraction({ n: 20, rho: 0.1 }, { n: 20, rho: 0.3 }), "기각")
    assert.equal(judgeInteraction({ n: 8, rho: 0.5 }, { n: 20, rho: 0.1 }), "표본 부족")
    const cell = (leadership, atr, n, avg) => ({ leadership, atr, n, window: { avg } })
    assert.equal(judgeCombination([cell("HIGH", "HIGH", 12, 20), cell("HIGH", "LOW", 12, 5), cell("LOW", "HIGH", 12, 6), cell("LOW", "LOW", 12, 5)]), "지지")
    assert.equal(judgeCombination([cell("HIGH", "HIGH", 12, 20), cell("HIGH", "LOW", 12, 10), cell("LOW", "HIGH", 12, 18), cell("LOW", "LOW", 12, 8)]), "기각")
    assert.equal(judgeCombination([cell("HIGH", "HIGH", 6, 20), cell("HIGH", "LOW", 12, 5), cell("LOW", "HIGH", 12, 6), cell("LOW", "LOW", 12, 4)]), "표본 부족")
  })
})
