/**
 * node --test scripts/equity-sell-backtest-v8.test.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import { volatilityBlock } from "./lib/equity-sell-backtest-v7.mjs"
import {
  SELECTED_STRATEGY,
  atrHistory,
  decileOf,
  percentileAgainstPast,
  selectMildEvents,
} from "./lib/equity-sell-backtest-v8.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function flat(length, range) {
  const closes = Array.from({ length }, () => 100)
  const highs = closes.map((close) => close + range)
  const lows = closes.map((close) => close - range)
  return { highs, lows, closes }
}

describe("equity sell backtest v8", () => {
  it("places the current ATR against earlier readings only", () => {
    assert.equal(SELECTED_STRATEGY, null)
    assert.equal(EQUITY_SELL_RESEARCH_UNIVERSE.length, 31)
    assert.equal(percentileAgainstPast(5, [1, 2, 3, 4]), 100)
    assert.equal(percentileAgainstPast(0, [1, 2, 3, 4]), 0)
    assert.equal(percentileAgainstPast(2, [1, 2, 3, 4]), 37.5)
    assert.equal(percentileAgainstPast(1, [1]), null)
    assert.equal(decileOf(0), 1)
    assert.equal(decileOf(90), 10)
    assert.equal(decileOf(100), 10)
    const calm = flat(200, 1)
    const calmAtr = volatilityBlock(calm.highs, calm.lows, calm.closes, 80).atrPct
    const history = atrHistory(calm.highs, calm.lows, calm.closes, 80, 60)
    assert.equal(history.n, 60)
    assert.equal(history.current, calmAtr)
    assert.equal(history.percentile, 50)
    calm.highs[81] = 150
    const after = atrHistory(calm.highs, calm.lows, calm.closes, 80, 60)
    assert.equal(after.percentile, history.percentile)
    assert.equal(atrHistory(calm.highs, calm.lows, calm.closes, 20, 60).percentile, null)
  })

  it("ranks a wider current day above a calm history", () => {
    const rows = flat(200, 1)
    rows.highs[160] = 110
    rows.lows[160] = 90
    const history = atrHistory(rows.highs, rows.lows, rows.closes, 160, 60)
    assert.equal(history.percentile, 100)
    assert.equal(history.decile, 10)
    assert.ok(history.ratio > 1)
  })

  it("matches the stored v6 mild event list", () => {
    const v6 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v6-result.json"), "utf8"))
    const events = selectMildEvents(v6.events)
    assert.equal(events.length, 103)
    assert.deepEqual(events.map((event) => event.eventId), v6.events.map((event) => event.eventId))
    assert.equal(events.filter((event) => event.leadershipGroup === "HIGH").length, 15)
    assert.equal(events.filter((event) => event.leadershipGroup === "LOW").length, 35)
    for (const event of events) assert.ok(event.t0 >= -0.05 && event.t0 < 0)
  })
})
