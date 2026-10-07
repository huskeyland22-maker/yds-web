import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
const assert = process.env.VITEST ? null : (await import("node:assert/strict")).default

import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import { SELECTED_STRATEGY as SELL_V34 } from "./lib/equity-sell-backtest-v34.mjs"
import {
  auditLookAhead,
  FROZEN_THRESHOLDS,
  MACD_PARAMS,
  RSI_PERIOD,
  RSI_SELL_LEVEL,
  RSI_SIGNAL,
  SELECTED_STRATEGY,
  STOCH_OVERBOUGHT,
  TICKERS,
  histogramSell,
  judgeSell,
  maCrossSell,
  macdSeries,
  rsiSell,
  simulate,
  stochasticSell,
  study,
  weekKey,
  weeklyStates,
} from "./lib/equity-technical-sell-v1.mjs"

const ORDER = ["AMZN", "AAPL", "AMAT", "ASML", "AVGO", "CEG", "ETN", "FCX", "FTNT", "GOOGL", "LRCX", "LLY", "MU", "NVDA", "ORCL", "PANW", "PLTR", "TSLA", "TSM", "VST", "KLAC", "ANET", "VRT", "PWR", "V", "MSFT", "GEV", "ISRG", "SNPS", "AMD", "CRWD"]

function check(condition, message) {
  if (process.env.VITEST) throw new Error("vitest path unused")
  assert.equal(condition, true, message)
}

function barsFrom(closes, start = "2020-01-06") {
  const [year, month, day] = start.split("-").map(Number)
  const stamp = new Date(Date.UTC(year, month - 1, day))
  return closes.map((close, index) => {
    const date = new Date(stamp)
    date.setUTCDate(stamp.getUTCDate() + index)
    return {
      date: date.toISOString().slice(0, 10),
      open: close,
      high: close + 1,
      low: close - 1,
      close,
      volume: 1,
    }
  })
}

describe("equity technical sell v1", () => {
  it("keeps the frozen buy thresholds, 31 names, and a null strategy", () => {
    check(SELECTED_STRATEGY === null, "strategy")
    check(SELL_V34 === null, "v34")
    check(TICKERS.join() === ORDER.join(), "order")
    check(TICKERS.join() === EQUITY_SELL_RESEARCH_UNIVERSE.map((item) => item.symbol).join(), "universe")
    check(!TICKERS.includes("QQQ") && !TICKERS.includes("SPY") && !TICKERS.includes("SMH"), "no etf")
    check(FROZEN_THRESHOLDS.rsiMax === 36 && FROZEN_THRESHOLDS.stochKMax === 15.4, "rsi")
    check(FROZEN_THRESHOLDS.bbPctBMax === 0.01 && FROZEN_THRESHOLDS.ma20DevMax === -4.2, "bb")
    check(RSI_PERIOD === 10 && RSI_SIGNAL === 9 && RSI_SELL_LEVEL === 50, "rsi sell")
    check(STOCH_OVERBOUGHT === 80 && MACD_PARAMS.fast === 12 && MACD_PARAMS.signal === 9, "macd")
  })

  it("builds sell edges without using the next bar", () => {
    const k = [70, 82, 85, 78, 60]
    const d = [60, 70, 80, 82, 70]
    const stoch = stochasticSell(k, d)
    check(stoch.edge[2] === false && stoch.edge[3] === true, "stoch cross")
    const rsi = rsiSell([55, 60, 48, 40, 52])
    check(rsi.edge[2] === true && rsi.edge[4] === false && rsi.state[4] === false, "rsi 50")
    const macd = histogramSell([0.2, 0.1, -0.1, -0.2, 0.1])
    check(macd.edge[2] === true && macd.edge[4] === false, "hist")
    const closes = [10, 11, 12, 9, 10]
    const ma = [null, null, 11, 10.5, 10]
    const cross = maCrossSell(closes, ma)
    check(cross.edge[3] === true, "ma")
    const hist = macdSeries([1, 2, 3, 2, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1])
    check(hist.hist.filter((value) => value != null).length > 0, "macd series")
    check(weekKey("2024-01-03") === weekKey("2024-01-01"), "week")
  })

  it("does not change an earlier signal when a future bar is appended", () => {
    const closes = Array.from({ length: 80 }, (_, index) => 100 + Math.sin(index / 3) * 5 + index * 0.05)
    const dates = barsFrom(closes).map((bar) => bar.date)
    const base = weeklyStates(dates, closes)
    const extraDates = dates.concat(["2030-01-06"])
    const extraCloses = closes.concat([50])
    const more = weeklyStates(extraDates, extraCloses)
    check(base.every((value, index) => value === more[index]), "weekly prefix")
    const rsi = rsiSell(closes.map((_, index) => 40 + (index % 17)))
    const longer = rsiSell(closes.concat([1]).map((_, index) => 40 + (index % 17)))
    check(rsi.edge.every((value, index) => value === longer.edge[index]), "rsi prefix")
  })

  it("accounts for one position, cash while flat, and the buy-and-hold path", () => {
    const closes = [10, 10, 10, 12, 12, 9, 9, 11]
    const dates = barsFrom(closes).map((bar) => bar.date)
    const blank = { edge: closes.map(() => false), state: closes.map(() => false) }
    const ma = {
      edge: [false, false, false, false, true, false, false, false],
      state: [false, false, false, false, true, true, false, false],
    }
    const prepared = {
      dates,
      closes,
      buyIndexes: [1, 2],
      weekly: closes.map(() => "MIXED"),
      signals: { stoch: blank, rsi: blank, macd: blank, ma20: ma },
    }
    const row = simulate(prepared, { indicators: ["ma20"], need: 1, weekly: "none" })
    check(row.trades === 1, "one closed trade")
    check(row.strategy.totalReturn === 0.2, "sold the rise")
    check(row.hold.totalReturn === 0.1, "hold path")
    const reenter = simulate({ ...prepared, buyIndexes: [1, 6] }, { indicators: ["ma20"], need: 1, weekly: "none" })
    check(reenter.trades === 1 && reenter.strategy.totalReturn === 0.4667, "reentry")
    const again = simulate(prepared, { indicators: ["ma20"], need: 1, weekly: "downtrend" })
    check(again.trades === 0 && again.strategy.totalReturn === again.hold.totalReturn, "filter holds")
    const oos = simulate({ ...prepared, buyIndexes: [1, 6] }, { indicators: ["ma20"], need: 1, weekly: "none" }, 5)
    check(oos.trades === 0, "oos starts later")
    const judged = judgeSell([
      { summary: { tickers: 31, complexity: 1, id: "x", tickerWins: 20, mddImprovement: 0.02, meanTimeInMarket: 0.8, meanTrades: 3, meanExcessCagr: 0.01 }, oos: [{ tickers: 20, meanExcessCagr: 0.01 }, { tickers: 20, meanExcessCagr: 0.02 }, { tickers: 10, meanExcessCagr: -0.01 }] },
    ])
    check(judged.sell === "단순 기술적 SELL이 의미 있음" && judged.buy === "A" && judged.winner === "x", "judge")
    const held = judgeSell([
      { summary: { tickers: 31, complexity: 1, id: "y", tickerWins: 4, mddImprovement: -0.1, meanTimeInMarket: 0.2, meanTrades: 8, meanExcessCagr: -0.05 }, oos: [{ tickers: 20, meanExcessCagr: -0.01 }, { tickers: 20, meanExcessCagr: -0.02 }, { tickers: 20, meanExcessCagr: -0.03 }] },
    ])
    check(held.sell === "ETF가 아니라 개별 성장주에서는 Buy & Hold가 우세" && held.buy === "B", "hold")
  })

  it("covers all 31 cached names and finds no look-ahead violation", () => {
    const root = dirname(fileURLToPath(import.meta.url))
    let violations = 0
    for (const symbol of ORDER) {
      const doc = JSON.parse(readFileSync(join(root, ".cache", "eq-ohlcv", `${symbol}.json`), "utf8"))
      check(doc.bars.length > 60, symbol)
      violations += auditLookAhead(doc.bars)
    }
    check(violations === 0, "look-ahead")
    check(typeof study === "function", "study")
  })
})
