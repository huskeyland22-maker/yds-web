/**
 * node --test scripts/equity-sell-backtest-v1.test.mjs
 */
import assert from "node:assert/strict"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
import { equityUniverse } from "./lib/equity-daily-bottom-buy.mjs"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import { locateProfitCorrection } from "./lib/etf-sell-backtest-v6.mjs"
import { describeCorrection } from "./lib/etf-sell-backtest-v6.mjs"
import {
  EQUITY_SELL_RESEARCH_THEMES,
  FORWARD_DAYS,
  SELECTED_STRATEGY,
  correctionRecord,
  sampleJudgment,
  summarizeCorrections,
  themesFor,
  uniqueEventCount,
} from "./lib/equity-sell-backtest-v1.mjs"

const ORIGINAL = [
  "AMZN", "AAPL", "AMAT", "ASML", "AVGO", "CEG", "ETN", "FCX", "FTNT", "GOOGL",
  "LRCX", "LLY", "MU", "NVDA", "ORCL", "PANW", "PLTR", "TSLA", "TSM", "VST",
]

function flat(length = 80) {
  return Array.from({ length }, () => 100)
}

function dated(closes) {
  return closes.map((close, index) => ({ date: `2020-01-${String(index + 1).padStart(2, "0")}`, close }))
}

describe("equity sell backtest v1", () => {
  it("keeps the 31-name research list and the 20-name screen scan", () => {
    const symbols = EQUITY_SELL_RESEARCH_UNIVERSE.map((row) => row.symbol)
    assert.equal(SELECTED_STRATEGY, null)
    assert.equal(FORWARD_DAYS, 60)
    assert.equal(symbols.length, 31)
    assert.equal(new Set(symbols).size, 31)
    assert.equal(symbols.includes("FNTN"), false)
    assert.equal(EQUITY_SELL_RESEARCH_UNIVERSE.find((row) => row.symbol === "FTNT").name, "Fortinet")
    assert.deepEqual(symbols.slice(0, 20), ORIGINAL)
    assert.deepEqual(equityUniverse().map((row) => row.symbol), ORIGINAL)
    const tagged = new Set(EQUITY_SELL_RESEARCH_THEMES.flatMap((theme) => theme.symbols))
    assert.deepEqual([...tagged].sort(), [...symbols].sort())
    assert.deepEqual(themesFor("ISRG"), ["로봇/자동화", "헬스케어"])
    assert.deepEqual(themesFor("CRWD"), ["사이버보안"])
  })

  it("does not copy a later close into a missing T+20", () => {
    const closes = flat()
    for (let i = 6; i <= 9; i++) closes[i] = 120
    closes[10] = 108
    for (let i = 11; i <= 15; i++) closes[i] = 108
    closes[30] = 80
    const located = locateProfitCorrection(closes, 1, 60, 0.1, 0.1)
    const record = correctionRecord({
      symbol: "NVDA",
      themes: themesFor("NVDA"),
      rows: dated(closes),
      event: { signalDate: "2020-01-02", entryPrice: 100 },
      depth: 0.1,
      described: describeCorrection(closes, located),
    })
    assert.equal(record.t5.vsEntry, (108 - 100) / 100)
    assert.notEqual(record.t5.vsEntry, (80 - 100) / 100)
    const late = flat()
    for (let i = 6; i <= 49; i++) late[i] = 120
    late[50] = 108
    for (let i = 51; i <= 61; i++) late[i] = 108
    late[61] = 130
    const locatedLate = locateProfitCorrection(late, 1, 60, 0.1, 0.1)
    const lateRecord = correctionRecord({
      symbol: "NVDA",
      themes: ["AI/반도체"],
      rows: dated(late),
      event: { signalDate: "2020-01-02", entryPrice: 100 },
      depth: 0.1,
      described: describeCorrection(late, locatedLate),
    })
    assert.equal(lateRecord.t20, null)
    assert.equal(lateRecord.t40, null)
    assert.equal(Math.round(lateRecord.windowEnd.vsEntry * 100), 30)
  })

  it("counts a shared name once in the pooled set and withholds a small sample", () => {
    const isrg = { ticker: "ISRG", episodeStart: "2020-01-01", t0Date: "2020-02-01", correctionDepth: 0.1, t0Return: 0.02, t5: null, t10: null, t20: { vsEntry: 0.01, vsT0: 0.01 }, t40: null, windowEnd: { vsEntry: 0.04, vsT0: 0.02 }, entryRecovered: true, peakRecovered: false, additionalDrawdown: 0.03 }
    const lly = { ...isrg, ticker: "LLY", episodeStart: "2020-03-01" }
    const rows = [isrg, lly]
    assert.equal(uniqueEventCount(rows), 2)
    assert.equal(uniqueEventCount([isrg, isrg]), 1)
    const summary = summarizeCorrections([isrg])
    assert.equal(summary.n, 1)
    assert.equal(summary.judgment, "no_conclusion")
    assert.equal(summary.t20.n, 1)
    assert.equal(summary.t40.n, 0)
    assert.equal(summary.t40.avgVsEntry, null)
    assert.equal(sampleJudgment(9), "withhold")
    assert.equal(sampleJudgment(10), "limited")
  })
})
