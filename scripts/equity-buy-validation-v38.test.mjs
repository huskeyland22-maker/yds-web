import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
const assert = process.env.VITEST ? null : (await import("node:assert/strict")).default

import { FROZEN_THRESHOLDS, buildSplitBuyEpisodes } from "./lib/daily-bottom-split-buy-sim.mjs"
import { EQUITY_SELL_RESEARCH_SELECTED_STRATEGY } from "./lib/equity-sell-research-universe.mjs"
import { SELECTED_STRATEGY as TECHNICAL_SELECTED_STRATEGY, existingBuyIndexes } from "./lib/equity-technical-sell-v1.mjs"
import { SELECTED_STRATEGY as WEEKLY_SELECTED_STRATEGY } from "./lib/equity-weekly-trend-sell-v1.mjs"
import {
  EXPECTED_EPISODES,
  FOCUS_TICKERS,
  SELECTED_STRATEGY,
  TICKERS,
  assertEpisodeIdentity,
  classifyPath,
  classifyRegime,
  forwardReturn,
  judgeBuy,
  reachDay,
  quantile,
  sampleIndexes,
  sampleJudgment,
} from "./lib/equity-buy-validation-v38.mjs"

const root = dirname(fileURLToPath(import.meta.url))
const ORDER = ["AMZN", "AAPL", "AMAT", "ASML", "AVGO", "CEG", "ETN", "FCX", "FTNT", "GOOGL", "LRCX", "LLY", "MU", "NVDA", "ORCL", "PANW", "PLTR", "TSLA", "TSM", "VST", "KLAC", "ANET", "VRT", "PWR", "V", "MSFT", "GEV", "ISRG", "SNPS", "AMD", "CRWD"]

function check(condition, message) {
  if (process.env.VITEST) {
    if (!condition) throw new Error(message)
    return
  }
  assert.equal(condition, true, message)
}

function addDays(date, days) {
  const [year, month, day] = date.split("-").map(Number)
  const stamp = new Date(Date.UTC(year, month - 1, day))
  stamp.setUTCDate(stamp.getUTCDate() + days)
  return stamp.toISOString().slice(0, 10)
}

function enriched(date, close, count) {
  return {
    date,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1,
    rsi14: count >= 1 ? 30 : 50,
    stochK: count >= 2 ? 10 : 50,
    bbPctB: count >= 3 ? 0 : 1,
    ma20DevPct: count >= 4 ? -5 : 0,
  }
}

function seriesFrom(index, values) {
  const closes = Array.from({ length: index + 61 }, () => 10)
  values.forEach((value, offset) => {
    closes[index + 1 + offset] = value
  })
  return closes
}

function cell(mean, median, winRate, mdd, n = 80) {
  return { n, mean, median, winRate, mdd }
}

describe("v38 frozen buy validation", () => {
  it("keeps the 31 names, null strategy, and frozen thresholds", () => {
    check(TICKERS.join() === ORDER.join(), "ticker order")
    check(FOCUS_TICKERS.join() === "NVDA,AMD,AVGO,CRWD,PLTR,TSLA", "focus names")
    check(SELECTED_STRATEGY === null && TECHNICAL_SELECTED_STRATEGY === null, "strategy null")
    check(WEEKLY_SELECTED_STRATEGY === null && EQUITY_SELL_RESEARCH_SELECTED_STRATEGY === null, "prior strategy null")
    check(FROZEN_THRESHOLDS.rsiMax === 36 && FROZEN_THRESHOLDS.stochKMax === 15.4, "rsi and stoch")
    check(FROZEN_THRESHOLDS.bbPctBMax === 0.01 && FROZEN_THRESHOLDS.ma20DevMax === -4.2, "band and ma20")
    check(sampleJudgment(4) === "결론 금지" && sampleJudgment(7) === "결론 보류" && sampleJudgment(10) === "제한적 해석", "sample labels")
  })

  it("keeps one episode across a continuous 3-of-4 cluster", () => {
    const rows = [enriched("2020-01-01", 10, 0)]
    for (let i = 1; i <= 40; i += 1) rows.push(enriched(addDays("2020-01-01", i), 10, 3))
    const episodes = buildSplitBuyEpisodes(rows, FROZEN_THRESHOLDS, { fromIdx: 0, toIdx: rows.length })
    check(episodes.length === 1, "continuous cluster is one episode")
    check(episodes[0].openIdx === 1, "opens on the rising edge")
    rows.push(enriched(addDays("2020-01-01", 41), 10, 0))
    rows.push(enriched(addDays("2020-01-01", 42), 10, 3))
    const again = buildSplitBuyEpisodes(rows, FROZEN_THRESHOLDS, { fromIdx: 0, toIdx: rows.length })
    check(again.length === 2, "a new rising edge can open later")
    check(again[1].openIdx > again[0].endIdx, "episodes do not overlap")
  })

  it("leaves a horizon outside the window missing", () => {
    const closes = Array.from({ length: 12 }, () => 10)
    closes[8] = 11
    closes[11] = 99
    check(Math.abs(forwardReturn(closes, 5, 3) - 0.1) < 1e-12, "T+3 uses that close")
    check(forwardReturn(closes, 5, 20) == null, "T+20 outside the window is missing")
    check(forwardReturn(closes, 5, 3) !== closes[11] / closes[5] - 1, "window end is not a substitute")
    const flat = Array.from({ length: 70 }, () => 10)
    check(reachDay(flat, 0, 0.1) === 0, "a flat path does not count as reaching +10%")
    flat[4] = 11.2
    check(reachDay(flat, 0, 0.1) === 4, "first day at the target")
    check(quantile([1, 2, 3, 4], 0.25) === 1.75, "25th percentile")
  })

  it("classifies the fixed post-buy paths and market regimes", () => {
    check(classifyPath(seriesFrom(0, Array.from({ length: 60 }, () => 10.6)), 0) === "EARLY_RISE", "early rise")
    const dip = Array.from({ length: 60 }, () => 10)
    dip[0] = 9.4
    dip[9] = 11.1
    check(classifyPath(seriesFrom(0, dip), 0) === "DIP_THEN_RISE", "dip then rise")
    const failed = Array.from({ length: 60 }, () => 9.6)
    failed[1] = 8.5
    check(classifyPath(seriesFrom(0, failed), 0) === "FAILED", "failed")
    check(classifyPath(seriesFrom(0, Array.from({ length: 60 }, () => 10.2)), 0) === "SIDEWAYS", "sideways")
    const later = Array.from({ length: 60 }, () => 10.2)
    later[9] = 11.5
    check(classifyPath(seriesFrom(0, later), 0) === "OTHER", "later rise stays unclassified")
    check(classifyPath([10, 11], 0) == null, "short path is missing")
    check(classifyRegime(0.05) === "강세" && classifyRegime(0.049) === "중립", "bull boundary")
    check(classifyRegime(-0.05) === "약세" && classifyRegime(-0.049) === "중립", "bear boundary")
    check(classifyRegime(null) == null, "missing regime")
  })

  it("draws a seeded sample without reading future prices", () => {
    const eligible = Array.from({ length: 30 }, (_, index) => index)
    const first = sampleIndexes(eligible, 10, 38)
    const second = sampleIndexes(eligible, 10, 38)
    check(first.join() === second.join(), "same seed")
    check(sampleIndexes(eligible, 10, 39).join() !== first.join(), "different seed")
    check(first.every((index) => index >= 0 && index <= 29), "sample stays inside the eligible days")
  })

  it("requires the full edge before calling the buy signal valid", () => {
    const strong = {
      buy: { 60: cell(0.08, 0.06, 0.64, -0.08), 120: cell(0.15, 0.11, 0.68, -0.11) },
      random: { 60: cell(0.03, 0.02, 0.54, -0.09), 120: cell(0.06, 0.04, 0.56, -0.12) },
      ci: { 60: { meanLow: 0.02, medianLow: 0.01 }, 120: { meanLow: 0.03, medianLow: 0.02 } },
      permutation: { 60: { p: 0.01 }, 120: { p: 0.01 } },
      reach10: 0.7,
      randomReach10: 0.4,
      breadth: { qualified: 20, better: 16 },
    }
    check(judgeBuy(strong).label.startsWith("A."), "confirmed edge")
    check(judgeBuy(strong).improvement === "변경하지 않음", "A does not retune")
    check(judgeBuy(strong).selectedStrategy === null, "A keeps null")
    const weak = {
      ...strong,
      ci: { 60: { meanLow: -0.01, medianLow: -0.02 }, 120: { meanLow: -0.01, medianLow: 0.01 } },
    }
    check(judgeBuy(weak).label.startsWith("B."), "positive bounce without a confirmed edge")
    const meanOnly = {
      ...strong,
      buy: { 60: cell(0.08, 0.01, 0.64, -0.08), 120: cell(0.15, 0.03, 0.68, -0.11) },
    }
    check(judgeBuy(meanOnly).label.startsWith("B."), "mean alone is not enough")
    const poor = {
      ...strong,
      buy: { 60: cell(0.01, -0.02, 0.42, -0.2), 120: cell(-0.04, -0.05, 0.4, -0.25) },
    }
    check(judgeBuy(poor).label.startsWith("C."), "insufficient performance")
    check(judgeBuy(poor).improvement === "성능은 불충분하나 조건을 변경하지 않음", "C still does not retune")
    check(judgeBuy(poor).sellResearch === "재개하지 않음", "sell stays closed")
  })

  it("matches the stored 1380 episodes and stops on a different count", () => {
    const prior = JSON.parse(readFileSync(join(root, "data", "equity-weekly-trend-sell-v1.json"), "utf8"))
    check(prior.selectedStrategy === null, "stored strategy")
    const counts = {}
    for (const symbol of ORDER) {
      const raw = JSON.parse(readFileSync(join(root, ".cache", "eq-ohlcv", `${symbol}.json`), "utf8"))
      counts[symbol] = existingBuyIndexes(raw.bars).length
    }
    assertEpisodeIdentity(counts, prior.buy.counts)
    check(Object.values(counts).reduce((sum, value) => sum + value, 0) === EXPECTED_EPISODES, "1380 episodes")
    let threw = false
    try {
      assertEpisodeIdentity({ ...counts, AMZN: counts.AMZN + 1 }, prior.buy.counts)
    } catch (error) {
      threw = error.lines.some((line) => line.includes("AMZN"))
    }
    check(threw, "count mismatch reports the ticker")
  })
})
