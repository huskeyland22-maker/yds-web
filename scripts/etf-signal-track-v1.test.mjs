/**
 * ETF actual-signal tracker v1.
 * node --test scripts/etf-signal-track-v1.test.mjs
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import {
  DAILY_BOTTOM_BUY_ETFS,
  DAILY_BOTTOM_BUY_ETFS_RESEARCH_V1,
  DAILY_BOTTOM_BUY_WATCHLIST,
  DAILY_BOTTOM_THRESHOLDS,
  buildEpisodes,
  buildTrackReport,
  evaluateBars,
  measureEntry,
  mergeEpisodes,
  scoreBars,
  summarizeEpisodes,
  trackSymbol,
} from "./lib/etf-signal-track-v1.mjs"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import { provisionalFromCard, provisionalSignals } from "../vite-project/src/content/etfSignalTrack.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

function read(rel) {
  return readFileSync(join(root, rel), "utf8")
}

function day(index, close, extras = {}) {
  return {
    date: `2024-01-${String(index + 1).padStart(2, "0")}`,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    ...extras,
  }
}

function scoredDay(index, count, extras = {}) {
  const bar = day(index, 100)
  return {
    index,
    date: bar.date,
    ok: true,
    close: bar.close,
    count,
    flags: { rsi: false, stoch: false, bb: false, ma20: false },
    rsi14: 30,
    stochK: 10,
    bbPctB: 0.2,
    ma20DevPct: -1,
    ...extras,
  }
}

const meta = { symbol: "VOO", theme: "Vanguard S&P 500 ETF", themeShort: "S&P 500", role: "미국 대형주" }

describe("etf signal track v1", () => {
  it("keeps the product six watchlist, frozen research nine, the 31-name equity list, and frozen thresholds", () => {
    assert.deepEqual(
      DAILY_BOTTOM_BUY_WATCHLIST.map((row) => row.symbol),
      ["SMH", "GRID", "IGV", "BOTZ", "CIBR", "VOO"],
    )
    assert.deepEqual(
      DAILY_BOTTOM_BUY_ETFS.map((row) => row.symbol),
      ["SMH", "GRID", "IGV", "BOTZ", "CIBR", "VOO"],
    )
    assert.deepEqual(
      DAILY_BOTTOM_BUY_ETFS_RESEARCH_V1.map((row) => row.symbol),
      ["SMH", "GRID", "QQQ", "IGV", "CIBR", "BOTZ", "ITA", "URA", "IBB"],
    )
    assert.equal(EQUITY_SELL_RESEARCH_UNIVERSE.length, 31)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.rsiMax, 36)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.stochKMax, 15.4)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.bbPctBMax, 0.01)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.ma20DevMax, -4.2)
  })

  it("matches the production evaluator and does not score a broken bar as 0/4", () => {
    const bars = []
    for (let i = 0; i < 40; i++) {
      const close = 100 - i * 1.2
      bars.push({
        date: `2024-03-${String((i % 28) + 1).padStart(2, "0")}`,
        open: close,
        high: close * 1.01,
        low: close * 0.99,
        close,
      })
    }
    bars.forEach((bar, index) => {
      bar.date = `2024-${String(Math.floor(index / 28) + 3).padStart(2, "0")}-${String((index % 28) + 1).padStart(2, "0")}`
    })
    const scored = scoreBars(bars)
    const last = evaluateBars(bars)
    const got = scored[scored.length - 1]
    assert.equal(got.ok, true)
    assert.equal(got.count, last.count)
    assert.equal(got.rsi14, last.rsi14)
    assert.equal(got.stochK, last.stochK)
    assert.equal(got.bbPctB, last.bbPctB)
    assert.equal(got.ma20DevPct, last.ma20DevPct)
    assert.deepEqual(got.flags, last.flags)
    const mid = evaluateBars(bars.slice(0, 30))
    assert.equal(scored[29].count, mid.count)
    assert.equal(scored[29].rsi14, mid.rsi14)

    const broken = bars.slice()
    broken[35] = { ...broken[35], close: null }
    const failed = scoreBars(broken)[35]
    assert.equal(failed.ok, false)
    assert.equal(failed.reason, "missing_bar")
    assert.equal(Object.hasOwn(failed, "count"), false)
  })

  it("records one episode for a continuous signal and a new episode after it drops below 3", () => {
    const bars = Array.from({ length: 8 }, (_, index) => day(index, 100 + index))
    const counts = [0, 3, 4, 3, 1, 3, 4, 2]
    const scored = counts.map((count, index) => scoredDay(index, count))
    const first = buildEpisodes(meta, bars, scored)
    const second = buildEpisodes(meta, bars, scored)
    assert.deepEqual(first, second)
    assert.deepEqual(first.map((episode) => episode.signalDate), ["2024-01-02", "2024-01-06"])
    assert.deepEqual(first.map((episode) => episode.count), [3, 3])
    assert.equal(first[0].closed, true)
    assert.equal(first[0].entryStatus, "confirmed")
    assert.equal(first[0].entryPrice, bars[2].open)
    assert.equal(first[1].origin, "historical")
    assert.equal(mergeEpisodes(first, second).added, 0)
    assert.equal(mergeEpisodes(first, second).episodes.length, 2)
  })

  it("keeps the same episode across a missing day and leaves the next open pending", () => {
    const bars = Array.from({ length: 4 }, (_, index) => day(index, 50))
    const scored = [
      scoredDay(0, 3),
      { index: 1, date: bars[1].date, ok: false, reason: "missing_indicator" },
      scoredDay(2, 4),
      scoredDay(3, 3),
    ]
    const episodes = buildEpisodes(meta, bars, scored)
    assert.equal(episodes.length, 1)
    assert.equal(episodes[0].id, "VOO:2024-01-01")
    assert.equal(episodes[0].closed, false)
    assert.equal(episodes[0].origin, "historical")

    const pendingBars = [day(0, 80)]
    const pending = buildEpisodes(meta, pendingBars, [scoredDay(0, 4)])
    assert.equal(pending.length, 1)
    assert.equal(pending[0].entryStatus, "pending")
    assert.equal(pending[0].entryPrice, null)
    assert.equal(pending[0].horizons["20"].status, "incomplete")
    assert.equal(pending[0].horizons["20"].priceReturnPct, null)
    assert.equal(pending[0].horizons["60"].priceReturnPct, null)
    assert.equal(pending[0].horizons["120"].priceReturnPct, null)
    assert.equal(pending[0].recovery.status, "unavailable")
    assert.equal(pending[0].recovery.tradingDays, null)
  })

  it("measures 20, 60, and 120 day price returns and drawdowns without filling incomplete periods", () => {
    const bars = []
    for (let i = 0; i <= 70; i++) {
      const close = i === 20 ? 110 : i === 0 ? 95 : 100
      const low = i === 5 ? 80 : 99
      bars.push({
        date: `2024-06-${String(i + 1).padStart(2, "0")}`,
        open: i === 0 ? 100 : 100,
        high: 120,
        low,
        close,
      })
    }
    bars[0].date = "2024-04-01"
    for (let i = 1; i < bars.length; i++) {
      const date = new Date(Date.UTC(2024, 3, i))
      bars[i].date = date.toISOString().slice(0, 10)
    }
    const measured = measureEntry(bars, 0, 100)
    assert.equal(measured.horizons["20"].status, "complete")
    assert.equal(measured.horizons["20"].priceReturnPct, 10)
    assert.equal(measured.horizons["20"].pnl, "profit")
    assert.equal(measured.horizons["20"].maxDrawdownPct, 20)
    assert.equal(measured.horizons["20"].totalReturnStatus, "unavailable")
    assert.equal(measured.horizons["20"].totalReturnPct, null)
    assert.equal(measured.horizons["60"].priceReturnPct, 0)
    assert.equal(measured.horizons["60"].pnl, "flat")
    assert.equal(measured.horizons["120"].status, "incomplete")
    assert.equal(measured.horizons["120"].priceReturnPct, null)
    assert.equal(measured.horizons["120"].maxDrawdownPct, null)
    assert.equal(measured.horizons["120"].pnl, null)
    assert.equal(measured.recovery.status, "recovered")
    assert.equal(measured.recovery.tradingDays, 1)

    const stillDown = bars.map((bar, index) => ({ ...bar, close: index === 0 ? 90 : 90, low: 80 }))
    const openRecovery = measureEntry(stillDown, 0, 100)
    assert.equal(openRecovery.recovery.status, "open")
    assert.equal(openRecovery.recovery.tradingDays, null)

    const hole = bars.map((bar) => ({ ...bar }))
    hole[3] = { ...hole[3], low: null }
    const partial = measureEntry(hole, 0, 100)
    assert.equal(partial.horizons["20"].priceReturnStatus, "complete")
    assert.equal(partial.horizons["20"].maxDrawdownStatus, "incomplete")
    assert.equal(partial.horizons["20"].maxDrawdownPct, null)
    assert.equal(partial.horizons["20"].status, "incomplete")
  })

  it("excludes incomplete returns from the median and skips a missing series", () => {
    const bars = Array.from({ length: 3 }, (_, index) => day(index, 10))
    const episodes = buildEpisodes(meta, bars, [scoredDay(0, 3), scoredDay(1, 1), scoredDay(2, 0)])
    const summary = summarizeEpisodes(episodes)
    assert.equal(summary.episodes, 1)
    assert.equal(summary.horizons["20"].incomplete, 1)
    assert.equal(summary.horizons["20"].medianPriceReturnPct, null)
    const report = buildTrackReport(
      [meta, { symbol: "SCHD", theme: "dividend", themeShort: "배당", role: "배당" }],
      { VOO: bars },
    )
    assert.equal(report.symbols.find((row) => row.symbol === "SCHD").ok, false)
    assert.equal(report.symbols.find((row) => row.symbol === "SCHD").reason, "missing_series")
    assert.equal(report.episodes.some((episode) => episode.symbol === "SCHD"), false)
    assert.equal(report.separateFromTradeRecords, true)
  })

  it("does not invent a live signal from a failed card, a 0/4 card, or an open episode", () => {
    const episodes = [{ id: "URA:2026-10-01", symbol: "URA", closed: false }]
    assert.equal(provisionalFromCard({ ok: false, symbol: "QQQ", count: 0, error: "fetch_failed" }, episodes), null)
    assert.equal(provisionalFromCard({ ok: true, symbol: "QQQ", count: 0, asOfDate: "2026-10-13", rsi14: 1, stochK: 1, bbPctB: 0, ma20DevPct: -5 }, episodes), null)
    assert.equal(provisionalFromCard({ ok: true, symbol: "URA", count: 3, asOfDate: "2026-10-13", rsi14: 30, stochK: 10, bbPctB: 0, ma20DevPct: -5, close: 40 }, episodes), null)
    const added = provisionalSignals([
      { ok: true, symbol: "VOO", count: 3, asOfDate: "2026-10-13", rsi14: 20, stochK: 10, bbPctB: 0, ma20DevPct: -6, close: 700, themeShort: "S&P 500", stage: { id: "primary", label: "1차 매수" } },
      { ok: true, symbol: "VOO", count: 3, asOfDate: "2026-10-13", rsi14: 20, stochK: 10, bbPctB: 0, ma20DevPct: -6, close: 700 },
    ], [])
    assert.equal(added.length, 1)
    assert.equal(added[0].entryStatus, "pending")
    assert.equal(added[0].horizons["20"].priceReturnPct, null)
    assert.equal(added[0].provisional, true)
    assert.equal(provisionalSignals(added.map((row) => ({ ...row, ok: true, asOfDate: row.signalDate })), added).length, 0)
  })

  it("leaves the buy screen, trade records, and screen episodes untouched", () => {
    const page = read("vite-project/src/pages/DailyBottomBuyPage.jsx")
    const trackPage = read("vite-project/src/pages/EtfSignalTrackPage.jsx")
    const app = read("vite-project/src/App.jsx")
    const records = read("vite-project/src/content/ydsTradeRecords.js")
    const episodes = read("vite-project/src/content/ydsDailyBottomBuyEpisodes.js")
    assert.equal(page.includes("EtfSignalTrack"), false)
    assert.equal(page.includes("etf-signal-track"), false)
    assert.match(app, /path="\/etf-signal-track"/)
    assert.match(trackPage, /미완료/)
    assert.match(trackPage, /추정하지 않습니다/)
    assert.equal(trackPage.includes("ydsTradeRecords"), false)
    assert.equal(trackPage.includes("syncDailyBottomEpisodes"), false)
    assert.equal(records.includes('yds.tradeRecords.v1'), true)
    assert.equal(episodes.includes("yds.dailyBottomBuy.episodes.v1"), true)
    const tracked = trackSymbol(meta, [day(0, 10)])
    assert.equal(tracked.episodes.length, 0)
    assert.equal(tracked.ok, true)
  })
})
