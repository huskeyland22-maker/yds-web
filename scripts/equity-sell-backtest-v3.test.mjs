/**
 * node --test scripts/equity-sell-backtest-v3.test.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
import { equityUniverse } from "./lib/equity-daily-bottom-buy.mjs"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import { prepareSeries } from "./lib/equity-sell-backtest-v2.mjs"
import {
  LOCKED_DEEP_EVENTS,
  SELECTED_STRATEGY,
  analyzeTrajectories,
  assertSameEvents,
  attachPaths,
  measurePath,
} from "./lib/equity-sell-backtest-v3.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function closesOf(length, fill = 100) {
  return Array.from({ length }, () => fill)
}

describe("equity sell backtest v3", () => {
  it("keeps 31 names and a null strategy", () => {
    const symbols = EQUITY_SELL_RESEARCH_UNIVERSE.map((row) => row.symbol)
    assert.equal(SELECTED_STRATEGY, null)
    assert.equal(symbols.length, 31)
    assert.equal(new Set(symbols).size, 31)
    assert.equal(symbols.includes("FNTN"), false)
    assert.equal(EQUITY_SELL_RESEARCH_UNIVERSE.find((row) => row.symbol === "FTNT").name, "Fortinet")
    assert.deepEqual(equityUniverse().map((row) => row.symbol), symbols.slice(0, 20))
  })

  it("keeps a missing T+20 empty and records the first recovery and the first low", () => {
    const closes = closesOf(61, 100)
    closes[10] = 90
    closes[11] = 95
    closes[12] = 95
    closes[13] = 95
    closes[14] = 100
    closes[20] = 80
    closes[21] = 70
    closes[60] = 110
    const path = measurePath(closes, 0, 10, 100)
    assert.equal(path.t5, 100 / 100 - 1)
    assert.equal(path.daysToEntry, 4)
    assert.equal(path.daysToLow, 11)
    assert.equal(path.additionalDrawdown, (90 - 70) / 90)
    assert.equal(Math.round((path.lowVsEntry + path.reboundVsEntry) * 1e8), Math.round(path.windowEnd * 1e8))
    const late = closesOf(61, 100)
    for (let i = 50; i <= 60; i++) late[i] = 90
    late[60] = 130
    const latePath = measurePath(late, 0, 50, 100)
    assert.equal(latePath.t20, null)
    assert.equal(latePath.t40, null)
    assert.ok(Math.abs(latePath.windowEnd - 0.3) < 1e-12)
    const held = closesOf(61, 100)
    held[10] = 90
    held[11] = 95
    held[12] = 101
    held[20] = 80
    const first = measurePath(held, 0, 10, 100)
    assert.equal(first.daysToEntry, 2)
    assert.equal(first.recovered, true)
  })

  it("matches the stored v2 events, groups, window, and additional drawdown", () => {
    const v2 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v2-result.json"), "utf8"))
    const v2Events = v2.events.filter((event) => event.correctionDepth === 0.1)
    const symbols = EQUITY_SELL_RESEARCH_UNIVERSE.map((row) => row.symbol)
    const series = new Map(
      symbols.map((symbol) => {
        const raw = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "eq-ohlcv", `${symbol}.json`), "utf8"))
        return [symbol, prepareSeries(raw.bars)]
      }),
    )
    const events = attachPaths(v2Events, series)
    assert.equal(events.length, LOCKED_DEEP_EVENTS)
    assertSameEvents(v2Events, events)
    const analysis = analyzeTrajectories(events)
    assert.equal(analysis.counts.HIGH, v2.groups.counts.HIGH)
    assert.equal(analysis.counts.MID, v2.groups.counts.MID)
    assert.equal(analysis.counts.LOW, v2.groups.counts.LOW)
    assert.equal(analysis.eventWeighted.HIGH.horizons.windowEnd.avg, 29.7)
    assert.equal(analysis.eventWeighted.LOW.horizons.windowEnd.avg, 8.94)
    assert.equal(analysis.eventWeighted.HIGH.horizons.t20.avg, 22.76)
    assert.equal(analysis.counts.HIGH + analysis.counts.MID + analysis.counts.LOW, v2.groups.scored)
    for (const event of events) {
      if (!event.hasAfter) continue
      assert.ok(Math.abs(event.lowVsEntry + event.reboundVsEntry - event.windowEnd) < 1e-8)
    }
  })
})
