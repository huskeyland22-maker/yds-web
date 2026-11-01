/**
 * node --test scripts/equity-sell-backtest-v5.test.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import { eventIdentity } from "./lib/equity-sell-backtest-v2.mjs"
import {
  SELECTED_STRATEGY,
  analyzeInnerBuckets,
  innerBucket,
  interpretationStatus,
  leaveOneTickerOut,
  selectLt0Events,
  tickerReports,
  withinStockComparison,
} from "./lib/equity-sell-backtest-v5.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function row(ticker, group, t0, t20, windowEnd, rebound) {
  return {
    eventId: `${ticker}|2016-01-01|2016-02-01|1|2016-01-01`,
    ticker,
    episodeStart: "2016-01-01",
    plus10Date: "2016-01-01",
    t0Date: "2016-02-01",
    leadershipScore: group === "HIGH" ? 80 : 10,
    leadershipGroup: group,
    t0,
    t1: t20,
    t3: t20,
    t5: t20,
    t10: t20,
    t20,
    t40: t20,
    windowEnd,
    recovered: true,
    peakRecovered: false,
    additionalDrawdown: 0.01,
    reboundFromLow: rebound,
    daysToLow: 4,
    innerBucket: innerBucket(t0),
  }
}

describe("equity sell backtest v5", () => {
  it("keeps a null strategy and the inner T0 edges", () => {
    assert.equal(SELECTED_STRATEGY, null)
    assert.equal(EQUITY_SELL_RESEARCH_UNIVERSE.length, 31)
    assert.equal(innerBucket(-0.11), "lt-10")
    assert.equal(innerBucket(-0.1), "m10")
    assert.equal(innerBucket(-0.05), "m5")
    assert.equal(innerBucket(-0.001), "m5")
    assert.equal(innerBucket(0), null)
    assert.equal(interpretationStatus(10, 10), "제한적 해석 가능")
    assert.equal(interpretationStatus(10, 9), "표본 부족")
    assert.equal(interpretationStatus(10, 5), "표본 부족")
    assert.equal(interpretationStatus(10, 4), "비교 불가")
    assert.equal(interpretationStatus(0, 12), "비교 불가")
  })

  it("weights each ticker once and checks every leave-one-out removal", () => {
    const events = [
      row("AMD", "HIGH", -0.02, 0.3, 0.3, 0.2),
      row("AMD", "HIGH", -0.03, 0.1, 0.1, 0.1),
      row("AAPL", "LOW", -0.04, 0, 0, 0.05),
      row("NVDA", "LOW", -0.12, 0.05, 0.04, 0.02),
    ]
    events[1].eventId = "AMD|2016-01-02|2016-02-02|1|2016-01-02"
    events[1].t0Date = "2016-02-02"
    const universe = [
      { symbol: "AMD" },
      { symbol: "AAPL" },
      { symbol: "NVDA" },
      { symbol: "MSFT" },
    ]
    const reports = tickerReports(events, universe)
    assert.equal(reports.reduce((sum, item) => sum + item.total, 0), 4)
    assert.equal(reports.find((item) => item.ticker === "MSFT").total, 0)
    assert.equal(reports.find((item) => item.ticker === "AMD").HIGH.windowEnd.avg, 20)
    const held = leaveOneTickerOut(events, universe)
    assert.equal(held.rows.reduce((sum, item) => sum + item.removed, 0), 4)
    assert.equal(held.rows.find((item) => item.ticker === "MSFT").removed, 0)
    assert.equal(held.rows.find((item) => item.ticker === "MSFT").windowDiff, held.baseline.windowEnd)
    const within = withinStockComparison(reports)
    assert.equal(within.includedCount, 0)
    assert.ok(within.excludedTickers.includes("AMD"))
    const bands = analyzeInnerBuckets(events)
    assert.equal(bands.reduce((sum, band) => sum + band.n, 0), 4)
    assert.equal(bands.find((band) => band.id === "lt-10").n, 1)
    assert.equal(bands.find((band) => band.id === "m5").n, 3)
  })

  it("matches the stored v4 T0 < 0% identities, scores, groups, and 31 names", () => {
    const v2 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v2-result.json"), "utf8"))
    const v3 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v3-result.json"), "utf8"))
    const v4 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v4-result.json"), "utf8"))
    const listed = v4.events.filter((event) => event.bucket === "lt0")
    const events = selectLt0Events(
      v4.events,
      v3.events.filter((event) => event.correctionDepth === 0.1),
      v2.events.filter((event) => event.correctionDepth === 0.1),
    )
    assert.equal(events.length, 112)
    assert.deepEqual(events.map((event) => event.eventId), listed.map((event) => event.eventId))
    assert.deepEqual(events.map((event) => event.ticker), listed.map((event) => event.ticker))
    assert.deepEqual(events.map((event) => event.t0), listed.map((event) => event.t0))
    assert.deepEqual(events.map((event) => event.leadershipScore), listed.map((event) => event.leadershipScore))
    assert.deepEqual(events.map((event) => event.leadershipGroup), listed.map((event) => event.leadershipGroup))
    const reports = tickerReports(events)
    assert.equal(reports.length, 31)
    assert.deepEqual(reports.map((item) => item.ticker).slice().sort(), EQUITY_SELL_RESEARCH_UNIVERSE.map((item) => item.symbol).slice().sort())
    assert.equal(reports.reduce((sum, item) => sum + item.total, 0), 112)
    assert.equal(reports.reduce((sum, item) => sum + item.high, 0), 17)
    assert.equal(reports.reduce((sum, item) => sum + item.low, 0), 35)
    const held = leaveOneTickerOut(events)
    assert.equal(held.rows.length, 31)
    assert.equal(held.rows.reduce((sum, item) => sum + item.removed, 0), 112)
    const bands = analyzeInnerBuckets(events)
    assert.equal(bands.reduce((sum, band) => sum + band.n, 0), 112)
    assert.equal(events.filter((event) => event.leadershipGroup === "HIGH").length, 17)
    assert.equal(events.filter((event) => event.leadershipGroup === "LOW").length, 35)
    for (const event of events) {
      assert.equal(event.eventId, eventIdentity(event).join("|"))
    }
  })
})
