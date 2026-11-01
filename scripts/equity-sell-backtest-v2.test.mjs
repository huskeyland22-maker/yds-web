/**
 * node --test scripts/equity-sell-backtest-v2.test.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
import { equityUniverse } from "./lib/equity-daily-bottom-buy.mjs"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import {
  HIGH_MIN,
  LOCKED_DEEP_EVENTS,
  MID_MIN,
  SELECTED_STRATEGY,
  analyzeGroups,
  attachLeadership,
  eventIdentity,
  featurePack,
  hasExactDate,
  indexBefore,
  leadershipFromPercentiles,
  leadershipGroup,
  percentileRank,
  prepareSeries,
  summarizeStockWeighted,
} from "./lib/equity-sell-backtest-v2.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function seriesFromCloses(closes, start = "2020-01-01") {
  const dates = closes.map((_, index) => {
    const day = new Date(`${start}T00:00:00Z`)
    day.setUTCDate(day.getUTCDate() + index)
    return day.toISOString().slice(0, 10)
  })
  return { dates, closes }
}

describe("equity sell backtest v2", () => {
  it("keeps the 31-name list, Fortinet, and a null strategy", () => {
    const symbols = EQUITY_SELL_RESEARCH_UNIVERSE.map((row) => row.symbol)
    assert.equal(SELECTED_STRATEGY, null)
    assert.equal(symbols.length, 31)
    assert.equal(new Set(symbols).size, 31)
    assert.equal(symbols.includes("FNTN"), false)
    assert.equal(EQUITY_SELL_RESEARCH_UNIVERSE.find((row) => row.symbol === "FTNT").name, "Fortinet")
    assert.deepEqual(equityUniverse().map((row) => row.symbol), symbols.slice(0, 20))
  })

  it("measures leadership only from closes before the correction", () => {
    const closes = Array.from({ length: 80 }, (_, index) => 100 + index)
    const dated = seriesFromCloses(closes)
    const correction = dated.dates[70]
    const prev = indexBefore(dated.dates, correction)
    assert.equal(prev, 69)
    assert.equal(hasExactDate(dated.dates, correction), true)
    const features = featurePack(closes, prev)
    assert.equal(features.ret60, closes[prev] / closes[prev - 60] - 1)
    assert.equal(features.ret120, null)
    const crashed = closes.slice()
    crashed[prev + 1] = 1
    crashed[prev + 2] = 1
    assert.deepEqual(featurePack(crashed, prev), features)
    const flat = Array.from({ length: 80 }, () => 50)
    assert.equal(featurePack(flat, 70).position60, null)
  })

  it("ranks peers on the same date and keeps the score inside 0 to 100", () => {
    const low = seriesFromCloses(Array.from({ length: 80 }, () => 100))
    const mid = seriesFromCloses(Array.from({ length: 80 }, (_, index) => 100 + index))
    const high = seriesFromCloses(Array.from({ length: 80 }, (_, index) => 100 + index * 3))
    const date = low.dates[70]
    const packs = [low, mid, high].map((series) => featurePack(series.closes, indexBefore(series.dates, date)))
    const ret = percentileRank(packs[1].ret60, packs.map((row) => row.ret60))
    assert.equal(ret, 50)
    assert.equal(percentileRank(packs[0].ret60, packs.map((row) => row.ret60)), 0)
    assert.equal(percentileRank(packs[2].ret60, packs.map((row) => row.ret60)), 100)
    const score = leadershipFromPercentiles([80, null, 40])
    assert.equal(score, 60)
    assert.equal(leadershipFromPercentiles([80]), null)
    assert.equal(leadershipGroup(HIGH_MIN), "HIGH")
    assert.equal(leadershipGroup(MID_MIN), "MID")
    assert.equal(leadershipGroup(MID_MIN - 0.01), "LOW")
    assert.ok(score >= 0 && score <= 100)
  })

  it("gives each stock one vote and keeps group counts on the scored events", () => {
    const row = (ticker, score, end) => ({
      ticker,
      leadershipScore: score,
      leadershipGroup: leadershipGroup(score),
      t20: { vsEntry: end },
      windowEnd: { vsEntry: end },
      entryRecovered: end > 0,
      peakRecovered: false,
      additionalDrawdown: 0.01,
      maxDrawdown: 0.1,
      t5: { vsEntry: end },
      t10: { vsEntry: end },
      t40: null,
    })
    const events = [row("AMD", 90, 0.3), row("AMD", 90, 0.1), row("AAPL", 10, 0)]
    const stock = summarizeStockWeighted(events)
    assert.equal(stock.windowEnd.avg, 10)
    assert.equal(stock.stocks, 2)
    const grouped = analyzeGroups([
      row("AMD", 80, 0.1),
      row("NVDA", 50, 0.1),
      row("AAPL", 10, 0.1),
      { ...row("MSFT", null, 0.1), leadershipGroup: null, leadershipScore: null },
    ])
    assert.equal(grouped.scored, 3)
    assert.equal(grouped.unscored, 1)
    assert.equal(grouped.counts.HIGH + grouped.counts.MID + grouped.counts.LOW, grouped.scored)
  })

  it("matches the stored v1 +10/-10 event list", () => {
    const v1 = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", ".cache", "equity-sell-backtest-v1-result.json"), "utf8"))
    const symbols = EQUITY_SELL_RESEARCH_UNIVERSE.map((row) => row.symbol)
    const series = new Map(
      symbols.map((symbol) => {
        const raw = JSON.parse(
          fs.readFileSync(path.join(ROOT, "scripts", ".cache", "eq-ohlcv", `${symbol}.json`), "utf8"),
        )
        return [symbol, prepareSeries(raw.bars)]
      }),
    )
    const events = attachLeadership(v1.events, series)
    const left = v1.events.filter((event) => event.correctionDepth === 0.1).map((event) => eventIdentity(event).join("|"))
    const right = events.map((event) => eventIdentity(event).join("|"))
    assert.equal(left.length, LOCKED_DEEP_EVENTS)
    assert.deepEqual(right, left)
    assert.equal(events.filter((event) => event.correctionDepth !== 0.1).length, 0)
    const groups = analyzeGroups(events)
    assert.equal(groups.counts.HIGH + groups.counts.MID + groups.counts.LOW, groups.scored)
    for (const event of events) {
      if (event.leadershipScore == null) continue
      assert.ok(event.leadershipScore >= 0 && event.leadershipScore <= 100)
    }
  })
})
