const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
const assert = process.env.VITEST ? null : (await import("node:assert/strict")).default

import { FROZEN_THRESHOLDS } from "./lib/daily-bottom-split-buy-sim.mjs"
import { EQUITY_SELL_RESEARCH_SELECTED_STRATEGY } from "./lib/equity-sell-research-universe.mjs"
import { SELECTED_STRATEGY as TECHNICAL_SELECTED_STRATEGY } from "./lib/equity-technical-sell-v1.mjs"
import {
  FOCUS_TICKERS,
  SELECTED_STRATEGY,
  TICKERS,
  assertStoredEpisodes,
  averageCost,
  firstBreachIndex,
  judgeAddon,
  simulateAddon,
} from "./lib/equity-addon-buy-v39.mjs"

const ORDER = ["AMZN", "AAPL", "AMAT", "ASML", "AVGO", "CEG", "ETN", "FCX", "FTNT", "GOOGL", "LRCX", "LLY", "MU", "NVDA", "ORCL", "PANW", "PLTR", "TSLA", "TSM", "VST", "KLAC", "ANET", "VRT", "PWR", "V", "MSFT", "GEV", "ISRG", "SNPS", "AMD", "CRWD"]

function check(condition, message) {
  if (process.env.VITEST) {
    if (!condition) throw new Error(message)
    return
  }
  assert.equal(condition, true, message)
}

function dollar(overrides = {}) {
  return {
    mean: 0.12,
    median: 0.08,
    ciLow: 0.04,
    loss120: 0.1,
    deepN: 40,
    deepMean: 0.06,
    deepWin: 0.62,
    furtherMedian: -0.03,
    ...overrides,
  }
}

describe("v39 equal-cash add-on", () => {
  it("keeps the frozen buy and a null strategy", () => {
    check(TICKERS.join() === ORDER.join(), "31 names")
    check(FOCUS_TICKERS.join() === "NVDA,AMD,AVGO,CRWD,PLTR,TSLA", "focus names")
    check(SELECTED_STRATEGY === null && TECHNICAL_SELECTED_STRATEGY === null, "strategy null")
    check(EQUITY_SELL_RESEARCH_SELECTED_STRATEGY === null, "universe strategy")
    check(FROZEN_THRESHOLDS.rsiMax === 36 && FROZEN_THRESHOLDS.stochKMax === 15.4, "thresholds")
    check(FROZEN_THRESHOLDS.bbPctBMax === 0.01 && FROZEN_THRESHOLDS.ma20DevMax === -4.2, "band and distance")
  })

  it("adds once at the first breach and uses equal cash", () => {
    check(Math.abs(averageCost(100, 95) - (2 * 100 * 95) / 195) < 1e-9, "harmonic average")
    const closes = [100, 96, 94, 90, 110]
    check(firstBreachIndex(closes, 0, -0.05, 4) === 2, "first -5% day, not the later low")
    check(firstBreachIndex(closes, 0, -0.1, 4) === 3, "first -10% day")
    check(firstBreachIndex(closes.slice(0, 3), 0, -0.05, 2) === 2, "later lower close is not required")
    const holdPath = simulateAddon(closes, 0, 4, null)
    const added = simulateAddon(closes, 0, 4, -0.05)
    check(added.capitalReturn > holdPath.capitalReturn, "buying cheaper raises the blended return by arithmetic")
    check(added.added && added.addPrice === 94, "fills at the first -5% close")
    check(Math.abs(added.avgCost - averageCost(100, 94)) < 1e-9, "average cost")
    const hold = simulateAddon(closes, 0, 4, null)
    check(Math.abs(hold.capitalReturn - 0.1) < 1e-12, "hold is the price return")
    check(hold.added === false, "hold never adds")
    const same = simulateAddon([100, 97, 101], 0, 2, -0.05)
    check(same.added === false && Math.abs(same.capitalReturn - holdShort(101)) < 1e-12, "no breach matches hold")
    check(simulateAddon([100, 88], 0, 1, -0.05).addPrice === 88, "gap fills -5% at the gap close")
    check(simulateAddon([100, 88], 0, 1, -0.1).addPrice === 88, "gap fills -10% at the same close")
    check(simulateAddon([100, 101], 0, 5, null) == null, "missing horizon stays missing")
  })

  it("does not treat the blended-return identity as a research pass", () => {
    const strong = { extraDollar: { BUY_PLUS_5: dollar(), BUY_PLUS_10: dollar({ mean: -0.01, median: -0.02, ciLow: -0.03 }) } }
    check(judgeAddon(strong).label.startsWith("A."), "extra dollar and deep dips both clear")
    check(judgeAddon(strong).production === "변경 없음", "A does not change production")
    check(judgeAddon(strong).selectedStrategy === null, "A keeps null")
    const early = { extraDollar: { BUY_PLUS_5: dollar({ loss120: 0.3, furtherMedian: -0.1, deepMean: -0.02, deepWin: 0.4 }), BUY_PLUS_10: dollar({ mean: -0.01, median: -0.02, ciLow: -0.04 }) } }
    check(judgeAddon(early).label.startsWith("B."), "profitable extra dollar with a deep-dip failure")
    const dead = { extraDollar: { BUY_PLUS_5: dollar({ mean: -0.02, median: -0.03, ciLow: -0.05 }), BUY_PLUS_10: dollar({ mean: -0.04, median: -0.05, ciLow: -0.06 }) } }
    check(judgeAddon(dead).label.startsWith("C."), "extra dollar does not pay")
  })

  it("stops when stored episodes differ", () => {
    const stored = [{ symbol: "AMZN", date: "2020-01-02" }]
    let lines = []
    try {
      assertStoredEpisodes([{ symbol: "AMZN", date: "2020-01-03" }], { episodes: stored, fingerprint: "none" })
    } catch (error) {
      lines = error.lines
    }
    check(lines.some((line) => line.includes("AMZN")), "date mismatch is reported")
  })
})

function holdShort(close) {
  return close / 100 - 1
}
