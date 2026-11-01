/**
 * node --test scripts/equity-sell-backtest-v6.test.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import {
  SELECTED_STRATEGY,
  describeRebound,
  leaveOneTickerOut,
  selectMildEvents,
  stockWeighted,
} from "./lib/equity-sell-backtest-v6.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function flatCloses() {
  const closes = Array.from({ length: 80 }, () => 100)
  closes[10] = 98
  closes[11] = 97
  closes[12] = 96
  closes[13] = 90
  closes[14] = 92
  closes[15] = 94.5
  closes[16] = 99
  for (let i = 17; i < closes.length; i++) closes[i] = 99
  return closes
}

describe("equity sell backtest v6", () => {
  it("keeps a null strategy and the frozen low", () => {
    assert.equal(SELECTED_STRATEGY, null)
    assert.equal(EQUITY_SELL_RESEARCH_UNIVERSE.length, 31)
    const described = describeRebound(flatCloses(), 0, 10, 100)
    assert.equal(described.lowDay, 3)
    assert.ok(Math.abs(described.lowReturnFromEntry + 0.1) < 1e-12)
    assert.ok(Math.abs(described.lowReturnFromEpisodeStart + 0.1) < 1e-12)
    assert.ok(Math.abs(described.lowToWindowReturn - 0.1) < 1e-12)
    assert.equal(described.afterLowFormed.t1, null)
    assert.ok(Math.abs(described.afterLowFormed.t5 - 0.05) < 1e-12)
    assert.equal(described.rebound["5"].reached, true)
    assert.equal(described.rebound["5"].days, 2)
    assert.equal(described.rebound["10"].days, 3)
    assert.equal(described.rebound["15"].reached, false)
    assert.equal(described.rebound["15"].days, null)
    assert.equal(described.rebound["20"].days, null)
  })

  it("keeps a tied low on the first bar and does not fill a missed rebound", () => {
    const closes = Array.from({ length: 80 }, () => 100)
    closes[10] = 95
    closes[11] = 90
    closes[12] = 90
    for (let i = 13; i < closes.length; i++) closes[i] = 91
    const described = describeRebound(closes, 0, 10, 100)
    assert.equal(described.lowDay, 1)
    assert.equal(described.rebound["3"].reached, false)
    assert.equal(described.rebound["3"].days, null)
    assert.notEqual(described.rebound["3"].days, 999)
  })

  it("weights each ticker once and checks every leave-one-out removal", () => {
    const events = [
      { ticker: "AMD", leadershipGroup: "HIGH", lowDay: 2, afterLowFormed: { t10: 0.1, t20: 0.1, t40: 0.1, windowEnd: 0.1 } },
      { ticker: "AMD", leadershipGroup: "HIGH", lowDay: 4, afterLowFormed: { t10: 0.3, t20: 0.3, t40: 0.3, windowEnd: 0.3 } },
      { ticker: "NVDA", leadershipGroup: "HIGH", lowDay: 6, afterLowFormed: { t10: 0.4, t20: 0.4, t40: 0.4, windowEnd: 0.4 } },
      { ticker: "AAPL", leadershipGroup: "LOW", lowDay: 10, afterLowFormed: { t10: 0, t20: 0, t40: 0, windowEnd: 0 } },
    ]
    const stock = stockWeighted(events)
    assert.equal(stock.t10.highTickers, 2)
    assert.equal(stock.t10.high, 30)
    assert.equal(stock.t10.low, 0)
    const universe = [{ symbol: "AMD" }, { symbol: "NVDA" }, { symbol: "AAPL" }, { symbol: "MSFT" }]
    const held = leaveOneTickerOut(events, universe)
    assert.equal(held.rows.reduce((sum, row) => sum + row.removed, 0), 4)
    assert.equal(held.rows.find((row) => row.ticker === "MSFT").removed, 0)
    assert.equal(held.rows.find((row) => row.ticker === "MSFT").windowRebound, held.baseline.windowRebound)
  })

  it("matches the stored v5 mild identities, scores, groups, and T0 range", () => {
    const v3 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v3-result.json"), "utf8"))
    const v5 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v5-result.json"), "utf8"))
    const listed = v5.events.filter((event) => event.innerBucket === "m5")
    const events = selectMildEvents(v5.events, v3.events.filter((event) => event.correctionDepth === 0.1))
    assert.equal(events.length, 103)
    assert.deepEqual(events.map((event) => event.eventId), listed.map((event) => event.eventId))
    assert.deepEqual(events.map((event) => event.ticker), listed.map((event) => event.ticker))
    assert.deepEqual(events.map((event) => event.t0Date), listed.map((event) => event.t0Date))
    assert.deepEqual(events.map((event) => event.leadershipScore), listed.map((event) => event.leadershipScore))
    assert.deepEqual(events.map((event) => event.leadershipGroup), listed.map((event) => event.leadershipGroup))
    for (const event of events) {
      assert.ok(event.t0 >= -0.05 && event.t0 < 0)
    }
    assert.equal(events.filter((event) => event.leadershipGroup === "HIGH").length, 15)
    assert.equal(events.filter((event) => event.leadershipGroup === "MID").length, 53)
    assert.equal(events.filter((event) => event.leadershipGroup === "LOW").length, 35)
  })
})
