import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
const assert = process.env.VITEST ? null : (await import("node:assert/strict")).default

import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import {
  FOCUS_CAGR_GAP,
  FROZEN_THRESHOLDS,
  MAX_SELLS,
  SELECTED_STRATEGY,
  STRONG_CAGR_GAP,
  TICKERS,
  WEEKLY_FAST,
  WEEKLY_SLOW,
  aggregateWeeks,
  auditLookAhead,
  judgeWeekly,
  simulatePath,
  weeklyTransitions,
} from "./lib/equity-weekly-trend-sell-v1.mjs"

const ORDER = ["AMZN", "AAPL", "AMAT", "ASML", "AVGO", "CEG", "ETN", "FCX", "FTNT", "GOOGL", "LRCX", "LLY", "MU", "NVDA", "ORCL", "PANW", "PLTR", "TSLA", "TSM", "VST", "KLAC", "ANET", "VRT", "PWR", "V", "MSFT", "GEV", "ISRG", "SNPS", "AMD", "CRWD"]

function check(condition, message) {
  if (process.env.VITEST) throw new Error(message)
  assert.equal(condition, true, message)
}

function bar(date, open, high, low, close) {
  return { date, open, high, low, close, volume: 1 }
}

function fridays(count, closeAt) {
  const start = new Date(Date.UTC(2024, 0, 5))
  return Array.from({ length: count }, (_, index) => {
    const stamp = new Date(start)
    stamp.setUTCDate(start.getUTCDate() + index * 7)
    const close = closeAt(index)
    return bar(stamp.toISOString().slice(0, 10), close, close + 1, close - 1, close)
  })
}

describe("equity weekly trend sell v1", () => {
  it("keeps the frozen buy and the 20/60 week pair", () => {
    check(SELECTED_STRATEGY === null, "strategy")
    check(TICKERS.join() === ORDER.join(), "order")
    check(TICKERS.join() === EQUITY_SELL_RESEARCH_UNIVERSE.map((item) => item.symbol).join(), "universe")
    check(!TICKERS.includes("QQQ") && !TICKERS.includes("SMH"), "no etf")
    check(FROZEN_THRESHOLDS.rsiMax === 36 && FROZEN_THRESHOLDS.stochKMax === 15.4, "thresholds")
    check(WEEKLY_FAST === 20 && WEEKLY_SLOW === 60, "weeks")
    check(MAX_SELLS === 15 && STRONG_CAGR_GAP === -0.05 && FOCUS_CAGR_GAP === -0.1, "gates")
  })

  it("aggregates a completed week and leaves an unfinished week out", () => {
    const bars = [
      bar("2024-01-01", 1, 3, 0.5, 2),
      bar("2024-01-02", 2, 4, 1, 3),
      bar("2024-01-03", 3, 3, 2, 2.5),
      bar("2024-01-08", 9, 9, 8, 9),
    ]
    const weeks = aggregateWeeks(bars)
    check(weeks.length === 1, "one completed week")
    check(weeks[0].open === 1 && weeks[0].high === 4 && weeks[0].low === 0.5 && weeks[0].close === 2.5, "ohlc")
    check(weeks[0].end === 2 && weeks[0].exec === 3 && weeks[0].execOpen === 9, "next open")
  })

  it("crosses only on a new weekly break and fills the next session", () => {
    const bars = fridays(22, (index) => (index === 20 ? 9 : 10))
    const weeks = aggregateWeeks(bars)
    check(weeks[19].ma20 === 10, "ma20")
    check(weeks.length >= 60 ? weeks[59].ma60 === 10 : weeks[20].ma20 < 10, "ma path")
    const { signals, excluded } = weeklyTransitions(weeks)
    check(signals.W1.some((signal) => signal.weekEnd === 20 && signal.exec === 21), "w1")
    check(signals.W1.every((signal) => signal.weekEnd !== 19), "no repeat")
    check(excluded === 0 || signals.W1.length > 0, "execution exists")
    const flat = weeklyTransitions(aggregateWeeks(fridays(25, () => 10)))
    check(flat.signals.W1.length === 0 && flat.signals.W2.length === 0 && flat.signals.W3.length === 0, "no level sell")
  })

  it("does not let a later week change an earlier signal", () => {
    const bars = fridays(30, (index) => 50 + (index % 5))
    const full = weeklyTransitions(aggregateWeeks(bars))
    const part = weeklyTransitions(aggregateWeeks(bars.slice(0, -8)))
    const partEnds = new Set(aggregateWeeks(bars.slice(0, -8)).map((week) => week.end))
    for (const id of ["W1", "W2", "W3"]) {
      const left = part.signals[id].filter((signal) => partEnds.has(signal.weekEnd)).map((signal) => signal.weekEnd)
      const right = full.signals[id].filter((signal) => partEnds.has(signal.weekEnd)).map((signal) => signal.weekEnd)
      check(left.join() === right.join(), id)
    }
  })

  it("accounts for buy-and-hold, one sell, and a later re-entry", () => {
    const bars = [
      bar("2024-01-01", 10, 10, 10, 10),
      bar("2024-01-02", 10, 12, 10, 12),
      bar("2024-01-03", 11, 14, 11, 14),
      bar("2024-01-04", 14, 20, 14, 20),
      bar("2024-01-05", 20, 22, 20, 22),
    ]
    const held = simulatePath(bars, [0, 1], [])
    check(held.trades === 0 && held.reentries === 0 && held.totalReturn === 1.2 && held.bhTotalReturn === 1.2, "hold")
    check(held.overlap === false, "one position")
    const sold = simulatePath(bars, [0], [{ weekEnd: 1, exec: 2 }])
    check(sold.trades === 1 && sold.totalReturn === 0.1 && sold.bhTotalReturn === 1.2, "sell at open")
    const again = simulatePath(bars, [0, 3], [{ weekEnd: 1, exec: 2 }])
    check(again.trades === 1 && again.reentries === 1 && again.totalReturn === 0.21, "reentry")
    check(again.overlap === false, "no overlap")
  })

  it("rejects a rule unless every pre-set bar is true", () => {
    const pass = {
      complexity: 1,
      summary: { id: "W1", tickers: 31, tickerWins: 20, meanExcessCagr: 0.01, mddDiff: 0.02, meanTrades: 4 },
      oos: [{ tickers: 20, meanExcessCagr: 0.01 }, { tickers: 20, meanExcessCagr: 0.02 }, { tickers: 10, meanExcessCagr: -0.01 }],
      gates: { oos: true, cagr: true, breadth: true, mdd: true, compounders: true, trades: true },
    }
    const adopted = judgeWeekly([pass])
    check(adopted.sell === "주봉 추세 SELL이 의미 있음" && adopted.adopted === true, "adopt")
    const held = judgeWeekly([{
      ...pass,
      gates: { oos: false, cagr: false, breadth: false, mdd: true, compounders: false, trades: true },
      summary: { ...pass.summary, tickerWins: 4, meanExcessCagr: -0.04 },
      oos: pass.oos.map((row) => ({ ...row, meanExcessCagr: -0.02 })),
    }])
    check(held.sell === "주봉 추세 SELL도 Buy & Hold를 넘지 못함" && held.adopted === false, "reject")
  })

  it("covers the 31 caches with the stored buy counts and no look-ahead", () => {
    const root = dirname(fileURLToPath(import.meta.url))
    const prior = JSON.parse(readFileSync(join(root, "data", "equity-technical-sell-v1.json"), "utf8"))
    let violations = 0
    for (const symbol of ORDER) {
      const doc = JSON.parse(readFileSync(join(root, ".cache", "eq-ohlcv", `${symbol}.json`), "utf8"))
      check(doc.bars.length > 60, symbol)
      violations += auditLookAhead(doc.bars)
    }
    check(violations === 0, "look-ahead")
    check(prior.selectedStrategy === null, "prior strategy")
    check(Object.keys(prior.buy.counts).length === 31, "buy coverage")
  })
})
