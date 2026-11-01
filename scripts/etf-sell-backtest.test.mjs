/**
 * node --test scripts/etf-sell-backtest.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { DAILY_BOTTOM_THRESHOLDS } from "../api/_lib/dailyBottomBuyEngine.js"
import {
  DAILY_BOTTOM_BUY_ETFS,
  DAILY_BOTTOM_BUY_ETFS_RESEARCH_V1,
  FORWARD_DAYS,
  SELL_CANDIDATES,
  analyzeSymbol,
  firstTargetTouch,
  poolAnalysis,
  productionThresholdsMatchFrozen,
  simulateSell,
} from "./lib/etf-sell-backtest.mjs"

const FAIL = { rsi14: 50, stochK: 50, bbPctB: 0.5, ma20DevPct: 0 }
const THREE = { rsi14: 30, stochK: 10, bbPctB: 0.5, ma20DevPct: -5 }
const FOUR = { rsi14: 30, stochK: 10, bbPctB: 0, ma20DevPct: -5 }

function row(i, close, flags) {
  const date = new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10)
  return { date, close, open: close, high: close, low: close, volume: 1, ...flags }
}

function flatPath(overrides = {}, length = 80) {
  const rows = []
  for (let i = 0; i < length; i++) rows.push(row(i, 100, FAIL))
  rows[1] = row(1, 100, THREE)
  rows[2] = row(2, 100, THREE)
  rows[3] = row(3, 100, THREE)
  rows[4] = row(4, 100, FOUR)
  rows[5] = row(5, 100, FAIL)
  for (const [idx, close] of Object.entries(overrides)) {
    const i = Number(idx)
    rows[i] = { ...rows[i], close, open: close, high: close, low: close }
  }
  return rows
}

describe("etf sell backtest", () => {
  it("uses the frozen research V1 nine and frozen thresholds", () => {
    assert.equal(DAILY_BOTTOM_BUY_ETFS_RESEARCH_V1.length, 9)
    assert.equal(DAILY_BOTTOM_BUY_ETFS, DAILY_BOTTOM_BUY_ETFS_RESEARCH_V1)
    assert.deepEqual(
      DAILY_BOTTOM_BUY_ETFS.map((meta) => meta.symbol),
      ["SMH", "GRID", "QQQ", "IGV", "CIBR", "BOTZ", "ITA", "URA", "IBB"],
    )
    assert.equal(productionThresholdsMatchFrozen(), true)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.rsiMax, 36)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.stochKMax, 15.4)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.bbPctBMax, 0.01)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.ma20DevMax, -4.2)
  })

  it("counts one episode for a 3/4 cluster and records the later 4/4", () => {
    const analyzed = analyzeSymbol("SMH", flatPath())
    assert.equal(analyzed.events.length, 1)
    const event = analyzed.events[0]
    assert.equal(event.threeOfFour, true)
    assert.equal(event.laterFourOfFour, true)
    assert.equal(event.daysToFour, 3)
    assert.equal(event.entryPrice, 100)
    assert.equal(event.signalDate, "2020-01-02")
  })

  it("does not open a second event inside the same cluster", () => {
    const rows = flatPath({}, 120)
    rows[20] = row(20, 100, THREE)
    rows[21] = row(21, 100, FAIL)
    const analyzed = analyzeSymbol("QQQ", rows)
    assert.equal(analyzed.events.length, 2)
    assert.equal(analyzed.events[0].entryIdx, 1)
    assert.equal(analyzed.events[1].entryIdx, 20)
  })

  it("measures forward returns, MFE, MAE, and first target day from later closes only", () => {
    const rows = flatPath({
      6: 105,
      9: 90,
      11: 110,
      21: 125,
      41: 112,
      61: 107,
    })
    const event = analyzeSymbol("ITA", rows).events[0]
    assert.equal(Math.round(event.d5 * 1000) / 10, 5)
    assert.equal(Math.round(event.d10 * 100), 10)
    assert.equal(Math.round(event.d20 * 100), 25)
    assert.equal(Math.round(event.d40 * 100), 12)
    assert.equal(Math.round(event.d60 * 100), 7)
    assert.equal(Math.round(event.mfe * 100), 25)
    assert.equal(Math.round(event.mae * 100), 10)
    assert.equal(event.daysTo5, 5)
    assert.equal(event.daysTo10, 10)
    assert.equal(event.daysTo25, 20)
    assert.equal(event.hit20, true)
    const touch = firstTargetTouch(rows.map((r) => r.close), event.entryIdx, FORWARD_DAYS, 0.1)
    assert.equal(touch.days, 10)
    assert.equal(touch.price, 110)
  })

  it("sells at the first close that reaches the target and keeps the later rise as missed upside", () => {
    const rows = flatPath({ 12: 110, 21: 125, 61: 120 })
    const closes = rows.map((r) => r.close)
    const tp10 = SELL_CANDIDATES.find((c) => c.id === "tp10")
    const sold = simulateSell(closes, 1, FORWARD_DAYS, tp10)
    assert.equal(sold.completed, true)
    assert.equal(sold.holdDays, 11)
    assert.equal(Math.round(sold.realized * 100), 10)
    assert.equal(Math.round(sold.missedUpside * 100), 15)
    assert.equal(sold.fills[0].idx > 1, true)
  })

  it("fills a gap at that close instead of a limit price from the future", () => {
    const rows = flatPath({ 8: 130 })
    const closes = rows.map((r) => r.close)
    const tp10 = SELL_CANDIDATES.find((c) => c.id === "tp10")
    const sold = simulateSell(closes, 1, FORWARD_DAYS, tp10)
    assert.equal(sold.holdDays, 7)
    assert.equal(sold.fills[0].price, 130)
    assert.equal(Math.round(sold.realized * 100), 30)
  })

  it("weights split sells and leaves the unfilled part at day 60", () => {
    const rows = flatPath({ 12: 110, 21: 125 })
    const closes = rows.map((r) => r.close)
    const split = SELL_CANDIDATES.find((c) => c.id === "split1015")
    const sold = simulateSell(closes, 1, FORWARD_DAYS, split)
    assert.equal(sold.completed, true)
    assert.equal(Math.round(sold.realized * 1000) / 10, 17.5)
    assert.equal(Math.round(sold.missedUpside * 1000) / 10, 7.5)

    const quiet = flatPath()
    const held = simulateSell(
      quiet.map((r) => r.close),
      1,
      FORWARD_DAYS,
      split,
    )
    assert.equal(held.completed, false)
    assert.equal(held.holdDays, 60)
    assert.equal(held.realized, 0)
    assert.equal(held.missedUpside, 0)
  })

  it("does not run an unconfigured trend rule", () => {
    const pooled = poolAnalysis([analyzeSymbol("IBB", flatPath())])
    const trend = pooled.strategies.find((row) => row.id === "trend")
    assert.equal(trend.configured, false)
    assert.equal(pooled.events.length, 1)
    assert.equal(pooled.etfs.find((row) => row.etf === "IBB").events, 1)
    assert.equal(pooled.etfs.find((row) => row.etf === "SMH").events, 0)
  })

  it("drops an event that does not have 60 later sessions", () => {
    const rows = []
    for (let i = 0; i < 30; i++) rows.push(row(i, 100, FAIL))
    rows[1] = row(1, 100, THREE)
    rows[2] = row(2, 100, FAIL)
    const analyzed = analyzeSymbol("URA", rows)
    assert.equal(analyzed.events.length, 0)
    assert.equal(analyzed.incomplete, 1)
  })
})
