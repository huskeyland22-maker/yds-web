/**
 * Yahoo null-close backfill guards for Daily Bottom Buy.
 * node --test scripts/daily-bottom-buy-yahoo-backfill.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  barsFromYahooChartResult,
  shouldBackfillNullCloseFromQuote,
  tradingDayKeyAmericaNy,
} from "../api/_lib/dailyBottomBuyHandler.js"

/** 2026-09-22 13:30:00 UTC = US cash open (EDT) */
const BAR_2026_09_22_OPEN = 1_790_083_800
/** 2026-09-22 20:00:00 UTC = US regular close (EDT) */
const RMT_2026_09_22_CLOSE = 1_790_107_200
/** 2026-09-23 13:30 / 20:00 UTC */
const REG_2026_09_23_START = 1_790_170_200
const REG_2026_09_23_END = 1_790_193_600
/** Mid-session 2026-09-22 17:00 UTC = 13:00 EDT */
const RMT_2026_09_22_INTRADAY = 1_790_096_400
/** 2026-09-23 20:00 UTC */
const RMT_2026_09_23_CLOSE = 1_790_193_600
/** Now = Wed 2026-09-23 08:30 UTC (after Tue session) */
const NOW_2026_09_23_AM = 1_790_152_200
/** Now = Tue 2026-09-22 17:00 UTC (intraday) */
const NOW_2026_09_22_INTRADAY = 1_790_096_400
/** Now = Tue 2026-09-22 21:00 UTC (after close same day) */
const NOW_2026_09_22_AFTER = 1_790_110_800

describe("tradingDayKeyAmericaNy", () => {
  it("maps US cash open/close unix to NY trading day", () => {
    assert.equal(tradingDayKeyAmericaNy(BAR_2026_09_22_OPEN), "2026-09-22")
    assert.equal(tradingDayKeyAmericaNy(RMT_2026_09_22_CLOSE), "2026-09-22")
  })
})

describe("shouldBackfillNullCloseFromQuote", () => {
  it("Case 1 — null close + completed session quote (prior NY day)", () => {
    const ok = shouldBackfillNullCloseFromQuote({
      barUnix: BAR_2026_09_22_OPEN,
      nowUnix: NOW_2026_09_23_AM,
      meta: {
        regularMarketPrice: 214,
        regularMarketTime: RMT_2026_09_22_CLOSE,
        currentTradingPeriod: {
          regular: { start: REG_2026_09_23_START, end: REG_2026_09_23_END },
        },
      },
    })
    assert.equal(ok, true)
  })

  it("Case 1b — same NY day after regular.end", () => {
    const ok = shouldBackfillNullCloseFromQuote({
      barUnix: BAR_2026_09_22_OPEN,
      nowUnix: NOW_2026_09_22_AFTER,
      meta: {
        regularMarketPrice: 214,
        regularMarketTime: RMT_2026_09_22_CLOSE,
        currentTradingPeriod: {
          regular: { start: BAR_2026_09_22_OPEN, end: RMT_2026_09_22_CLOSE },
        },
      },
    })
    assert.equal(ok, true)
  })

  it("Case 2 — intraday quote before regular.end → no backfill", () => {
    const ok = shouldBackfillNullCloseFromQuote({
      barUnix: BAR_2026_09_22_OPEN,
      nowUnix: NOW_2026_09_22_INTRADAY,
      meta: {
        regularMarketPrice: 215.5,
        regularMarketTime: RMT_2026_09_22_INTRADAY,
        currentTradingPeriod: {
          regular: { start: BAR_2026_09_22_OPEN, end: RMT_2026_09_22_CLOSE },
        },
      },
    })
    assert.equal(ok, false)
  })

  it("Case 3 — quote trading day mismatch → no backfill", () => {
    const ok = shouldBackfillNullCloseFromQuote({
      barUnix: BAR_2026_09_22_OPEN,
      nowUnix: NOW_2026_09_23_AM,
      meta: {
        regularMarketPrice: 214,
        regularMarketTime: RMT_2026_09_23_CLOSE,
        currentTradingPeriod: {
          regular: { start: REG_2026_09_23_START, end: REG_2026_09_23_END },
        },
      },
    })
    assert.equal(ok, false)
  })

  it("rejects missing quote fields", () => {
    assert.equal(
      shouldBackfillNullCloseFromQuote({
        barUnix: BAR_2026_09_22_OPEN,
        nowUnix: NOW_2026_09_23_AM,
        meta: { regularMarketPrice: 214 },
      }),
      false,
    )
    assert.equal(
      shouldBackfillNullCloseFromQuote({
        barUnix: BAR_2026_09_22_OPEN,
        nowUnix: NOW_2026_09_22_INTRADAY,
        meta: {
          regularMarketPrice: 214,
          regularMarketTime: RMT_2026_09_22_INTRADAY,
        },
      }),
      false,
    )
  })
})

describe("barsFromYahooChartResult", () => {
  const baseTs = [
    1_789_997_400, // 2026-09-21 open
    BAR_2026_09_22_OPEN,
  ]
  const baseQuote = {
    open: [215.07, 217.68],
    high: [217.07, 217.76],
    low: [213.76, 211.43],
    close: [216.14, null],
    volume: [658_000, 1_190_061],
  }

  it("Case 1 — backfills null close to regularMarketPrice and asOf 2026-09-22", () => {
    const bars = barsFromYahooChartResult(
      {
        timestamp: baseTs,
        meta: {
          regularMarketPrice: 214,
          regularMarketTime: RMT_2026_09_22_CLOSE,
          currentTradingPeriod: {
            regular: { start: REG_2026_09_23_START, end: REG_2026_09_23_END },
          },
        },
        indicators: { quote: [baseQuote] },
      },
      NOW_2026_09_23_AM,
    )
    assert.equal(bars.length, 2)
    assert.equal(bars[0].date, "2026-09-21")
    assert.equal(bars[0].close, 216.14)
    assert.equal(bars[1].date, "2026-09-22")
    assert.equal(bars[1].close, 214)
  })

  it("Case 2 — intraday null close is not backfilled", () => {
    const bars = barsFromYahooChartResult(
      {
        timestamp: baseTs,
        meta: {
          regularMarketPrice: 215.5,
          regularMarketTime: RMT_2026_09_22_INTRADAY,
          currentTradingPeriod: {
            regular: { start: BAR_2026_09_22_OPEN, end: RMT_2026_09_22_CLOSE },
          },
        },
        indicators: { quote: [baseQuote] },
      },
      NOW_2026_09_22_INTRADAY,
    )
    assert.equal(bars.length, 1)
    assert.equal(bars[0].date, "2026-09-21")
    assert.equal(bars[0].close, 216.14)
  })

  it("Case 3 — mismatched quote day is not backfilled", () => {
    const bars = barsFromYahooChartResult(
      {
        timestamp: baseTs,
        meta: {
          regularMarketPrice: 214,
          regularMarketTime: RMT_2026_09_23_CLOSE,
          currentTradingPeriod: {
            regular: { start: REG_2026_09_23_START, end: REG_2026_09_23_END },
          },
        },
        indicators: { quote: [baseQuote] },
      },
      NOW_2026_09_23_AM,
    )
    assert.equal(bars.length, 1)
    assert.equal(bars[0].close, 216.14)
  })

  it("Case 4 — existing finite close is kept", () => {
    const bars = barsFromYahooChartResult(
      {
        timestamp: [1_789_997_400],
        meta: {
          regularMarketPrice: 999,
          regularMarketTime: RMT_2026_09_22_CLOSE,
        },
        indicators: {
          quote: [
            {
              open: [215.07],
              high: [217.07],
              low: [213.76],
              close: [216.14],
              volume: [658_000],
            },
          ],
        },
      },
      NOW_2026_09_23_AM,
    )
    assert.equal(bars.length, 1)
    assert.equal(bars[0].close, 216.14)
    assert.equal(bars[0].date, "2026-09-21")
  })
})
