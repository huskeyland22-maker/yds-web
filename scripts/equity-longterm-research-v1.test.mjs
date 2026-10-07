import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
const assert = process.env.VITEST ? (await import("vitest")).expect : (await import("node:assert/strict")).default

import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import {
  PENALTY_CAP,
  SELECTED_STRATEGY,
  TICKERS,
  gradeOf,
  revenueCagr,
  scoreTicker,
  study,
  valuationClass,
} from "./lib/equity-longterm-research-v1.mjs"
import { SELECTED_STRATEGY as SELL_STRATEGY } from "./lib/equity-sell-backtest-v34.mjs"

const ORDER = ["AMZN", "AAPL", "AMAT", "ASML", "AVGO", "CEG", "ETN", "FCX", "FTNT", "GOOGL", "LRCX", "LLY", "MU", "NVDA", "ORCL", "PANW", "PLTR", "TSLA", "TSM", "VST", "KLAC", "ANET", "VRT", "PWR", "V", "MSFT", "GEV", "ISRG", "SNPS", "AMD", "CRWD"]
const root = dirname(fileURLToPath(import.meta.url))
const source = JSON.parse(readFileSync(join(root, "data/equity-longterm-research-v1-source.json"), "utf8"))

function check(condition, message) {
  if (process.env.VITEST) assert(condition, message)
  else assert.equal(condition, true, message)
}

describe("equity long-term research v1", () => {
  it("keeps the frozen 31-name order and a null strategy", () => {
    check(SELECTED_STRATEGY === null, "strategy")
    check(SELL_STRATEGY === null, "sell strategy")
    check(TICKERS.join() === ORDER.join(), "order")
    check(TICKERS.join() === EQUITY_SELL_RESEARCH_UNIVERSE.map((item) => item.symbol).join(), "universe")
  })

  it("scores every name inside the fixed ranges", () => {
    const result = study(source)
    check(result.count === 31, "count")
    check(new Set(result.rows.map((row) => row.ticker)).size === 31, "unique")
    check(result.rows.every((row) => row.evidence.roic === null), "roic")
    check(result.rows.every((row) => row.evidence.revenueCagr5Y === null), "cagr5")
    check(result.rows.every((row) => row.evidence.epsCagr3Y === null), "eps")
    for (const row of result.rows) {
      for (const axis of Object.values(row.axes)) {
        check(axis.score === null || (axis.score >= 0 && axis.score <= 100), row.ticker)
      }
      check(row.penalty >= 0 && row.penalty <= PENALTY_CAP, "penalty")
      check(row.final === null || (row.final >= 0 && row.final <= 100), "final")
      check(row.grade !== "CORE LONG-TERM" || row.evidence.valuation !== "Extreme", "core gate")
    }
    const finals = result.ranked.map((ticker) => result.rows.find((row) => row.ticker === ticker).final)
    const sorted = [...finals].sort((a, b) => b - a)
    check(finals.join() === sorted.join(), "rank")
  })

  it("leaves a score empty when the market fields are missing", () => {
    const row = scoreTicker("NVDA", { annual: [] }, {
      group: "t", industry: "t", industryScore: 90, ai: "direct beneficiary",
      moat: ["technical"], tam: ["large"], why: "a", risk: "b", question: "c",
    })
    check(row.axes.growth.score === null, "growth")
    check(row.axes.profit.score === null, "profit")
    check(row.axes.capital.score === null, "capital")
    check(row.final === null, "final")
    check(row.grade === "DATA_INCOMPLETE", "grade")
  })

  it("blocks an extreme valuation from CORE and caps the penalty", () => {
    check(gradeOf(92, "Extreme") === "LONG-TERM", "blocked")
    check(gradeOf(92, "Reasonable") === "CORE LONG-TERM", "core")
    check(gradeOf(74, "Cheap") === "WATCH", "watch")
    check(gradeOf(49, "Cheap") === "NOT LONG-TERM", "low")
    const row = scoreTicker("TSLA", {
      currentPrice: 100, forwardPE: 80, forwardEps: 1.25, pegRatio: 4,
      operatingMargins: 0.4, earningsGrowth: 0.2, totalRevenue: 100, freeCashflow: 30,
      operatingCashflow: 40, revenueGrowth: 0.3,
      annual: [
        { end: "2022-12-31", revenue: 40 },
        { end: "2023-12-31", revenue: 50 },
        { end: "2024-12-31", revenue: 70 },
        { end: "2025-12-31", revenue: 100 },
      ],
    }, {
      group: "t", industry: "t", industryScore: 90, ai: "direct beneficiary",
      moat: ["technical", "scale", "switching", "ecosystem", "lockin", "supply", "ip", "brand", "network", "regulatory"],
      tam: ["large", "growing", "adjacent", "international", "aiPath", "reinvest"],
      why: "a", risk: "b", question: "c",
    })
    check(row.evidence.valuation === "Extreme", "class")
    check(row.grade !== "CORE LONG-TERM", "not core")
    check(row.penalty <= PENALTY_CAP, "cap")
    check(valuationClass({ currentPrice: 100, forwardPE: 10, forwardEps: 20 }) === null, "identity")
    check(valuationClass({ currentPrice: 100, forwardPE: 35, forwardEps: 100 / 35, pegRatio: 1.2, enterpriseToRevenue: 1107, growth: 0.16 }) === "Reasonable", "broken evs")
    check(revenueCagr([{ end: "2023-12-31", revenue: 0 }, { end: "2024-12-31", revenue: 10 }, { end: "2025-12-31", revenue: 12 }], 3) === null, "zero")
  })
})
