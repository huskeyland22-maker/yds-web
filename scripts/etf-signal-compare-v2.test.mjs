/**
 * ETF signal comparison v2.
 * node --test scripts/etf-signal-compare-v2.test.mjs
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import {
  DAILY_BOTTOM_BUY_ETFS,
  DAILY_BOTTOM_BUY_ETFS_RESEARCH_V1,
  DAILY_BOTTOM_THRESHOLDS,
} from "../api/_lib/dailyBottomBuyEngine.js"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import {
  compareSignalReport,
  mean,
  median,
  positiveRate,
  sortBy60DayMedian,
} from "../vite-project/src/content/etfSignalCompare.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

function read(rel) {
  return readFileSync(join(root, rel), "utf8")
}

function episode(symbol, horizons, recovery = { status: "open", tradingDays: null }) {
  return {
    id: `${symbol}:${horizons.id || "2024-01-01"}`,
    symbol,
    themeShort: symbol,
    signalDate: "2024-01-01",
    entryPrice: 100,
    horizons: {
      20: horizons.d20,
      60: horizons.d60,
      120: horizons.d120,
    },
    recovery,
  }
}

function price(pct, extra = {}) {
  return {
    priceReturnStatus: "complete",
    priceReturnPct: pct,
    maxDrawdownStatus: "complete",
    maxDrawdownPct: extra.drawdown ?? 1,
    totalReturnStatus: extra.totalStatus ?? "unavailable",
    totalReturnPct: extra.total ?? null,
    pnl: pct > 0 ? "profit" : pct < 0 ? "loss" : "flat",
  }
}

function incomplete() {
  return {
    priceReturnStatus: "incomplete",
    priceReturnPct: null,
    maxDrawdownStatus: "incomplete",
    maxDrawdownPct: null,
    totalReturnStatus: "unavailable",
    totalReturnPct: null,
    pnl: null,
  }
}

describe("etf signal compare v2", () => {
  it("averages only finite completed values and leaves an empty sample null", () => {
    assert.equal(mean([10, 20]), 15)
    assert.equal(median([10, 20, 30]), 20)
    assert.equal(median([1, 2, 3, 4]), 2.5)
    assert.equal(positiveRate([10, -5, 0]), 33.33)
    assert.equal(mean([]), null)
    assert.equal(median([null, undefined]), null)
    assert.equal(positiveRate([]), null)
    assert.equal(mean([0]), 0)
    assert.equal(positiveRate([0, -1]), 0)
  })

  it("drops incomplete, missing, and unavailable total returns instead of treating them as zero", () => {
    const report = {
      universe: ["AAA", "BBB"],
      episodes: [
        episode("AAA", {
          id: "a1",
          d20: price(10, { drawdown: 4, totalStatus: "complete", total: 12 }),
          d60: price(-2, { drawdown: 6, totalStatus: "unavailable", total: null }),
          d120: incomplete(),
        }, { status: "recovered", tradingDays: 0 }),
        episode("AAA", {
          id: "a2",
          d20: price(30, { drawdown: null, totalStatus: "complete", total: 31 }),
          d60: incomplete(),
          d120: { ...incomplete(), priceReturnStatus: "complete", priceReturnPct: null },
        }, { status: "open", tradingDays: null }),
        episode("BBB", {
          id: "b1",
          d20: incomplete(),
          d60: incomplete(),
          d120: incomplete(),
        }),
      ],
    }
    report.episodes[1].horizons["20"].maxDrawdownStatus = "incomplete"
    report.episodes[1].horizons["20"].maxDrawdownPct = null
    const compared = compareSignalReport(report)
    const aaa = compared.rows.find((row) => row.symbol === "AAA")
    const bbb = compared.rows.find((row) => row.symbol === "BBB")
    assert.equal(aaa.signals, 2)
    assert.equal(aaa.horizons["20"].complete + aaa.horizons["20"].incomplete, 2)
    assert.equal(aaa.horizons["20"].priceMean, 20)
    assert.equal(aaa.horizons["20"].priceMedian, 20)
    assert.equal(aaa.horizons["20"].positiveRate, 100)
    assert.equal(aaa.horizons["20"].drawdownCount, 1)
    assert.equal(aaa.horizons["20"].drawdownMean, 4)
    assert.equal(aaa.horizons["20"].totalCount, 2)
    assert.equal(aaa.horizons["20"].totalMean, 21.5)
    assert.equal(aaa.horizons["60"].complete, 1)
    assert.equal(aaa.horizons["60"].incomplete, 1)
    assert.equal(aaa.horizons["60"].priceMean, -2)
    assert.equal(aaa.horizons["60"].totalCount, 0)
    assert.equal(aaa.horizons["60"].totalMean, null)
    assert.equal(aaa.horizons["60"].totalMedian, null)
    assert.equal(aaa.horizons["120"].complete, 0)
    assert.equal(aaa.horizons["120"].incomplete, 2)
    assert.equal(aaa.horizons["120"].priceMean, null)
    assert.equal(aaa.horizons["120"].positiveRate, null)
    assert.equal(aaa.recoveryCount, 1)
    assert.equal(aaa.recoveryMedian, 0)
    assert.equal(bbb.signals, 1)
    assert.equal(bbb.horizons["60"].complete, 0)
    assert.equal(bbb.horizons["60"].priceMedian, null)
    assert.equal(bbb.recoveryMedian, null)
    const ordered = sortBy60DayMedian([bbb, aaa])
    assert.deepEqual(ordered.map((row) => row.symbol), ["AAA", "BBB"])
  })

  it("matches the stored v1 file: 17 ETFs and 905 signals, with complete plus incomplete equal to each symbol", () => {
    const report = JSON.parse(read("vite-project/public/data/etf-signal-track-v1.json"))
    const compared = compareSignalReport(report)
    assert.equal(report.episodes.length, 905)
    assert.equal(new Set(report.episodes.map((episode) => episode.id)).size, 905)
    assert.equal(compared.episodes, 905)
    assert.equal(compared.rows.length, 17)
    assert.equal(compared.rows.reduce((sum, row) => sum + row.signals, 0), 905)
    assert.equal(compared.independentSamples, false)
    for (const row of compared.rows) {
      for (const days of [20, 60, 120]) {
        const horizon = row.horizons[String(days)]
        assert.equal(horizon.complete + horizon.incomplete, row.signals, `${row.symbol} ${days}`)
        if (horizon.complete === 0) {
          assert.equal(horizon.priceMean, null)
          assert.equal(horizon.priceMedian, null)
          assert.equal(horizon.positiveRate, null)
        }
      }
    }
    const medians = compared.rows.map((row) => row.horizons["60"].priceMedian)
    const firstNull = medians.findIndex((value) => !Number.isFinite(value))
    if (firstNull >= 0) {
      assert.ok(medians.slice(firstNull).every((value) => !Number.isFinite(value)))
    }
  })

  it("leaves the v1 screen, buy thresholds, research lists, and trade records unchanged", () => {
    const track = read("vite-project/src/pages/EtfSignalTrackPage.jsx")
    const compare = read("vite-project/src/pages/EtfSignalComparePage.jsx")
    const compareLib = read("vite-project/src/content/etfSignalCompare.js")
    const buy = read("vite-project/src/pages/DailyBottomBuyPage.jsx")
    const app = read("vite-project/src/App.jsx")
    const labels = read("vite-project/src/utils/ydsUiLabels.js")
    assert.equal(track.includes("etfSignalCompare"), false)
    assert.equal(track.includes("ETF 신호 성과 비교"), false)
    assert.equal(buy.includes("etfSignalCompare"), false)
    assert.match(app, /path="\/etf-signal-compare"/)
    assert.match(labels, /ETF 신호 성과 비교/)
    assert.match(compare, /표본 없음/)
    assert.match(compare, /basis\.overlap/)
    assert.match(compareLib, /독립인 표본으로 합산하지 않는다/)
    assert.equal(compare.includes("ydsTradeRecords"), false)
    assert.equal(compare.includes("syncDailyBottomEpisodes"), false)
    assert.equal(DAILY_BOTTOM_BUY_ETFS.length, 6)
    assert.deepEqual(
      DAILY_BOTTOM_BUY_ETFS.map((e) => e.symbol),
      ["SMH", "GRID", "IGV", "BOTZ", "CIBR", "VOO"],
    )
    assert.equal(DAILY_BOTTOM_BUY_ETFS_RESEARCH_V1.length, 9)
    assert.equal(EQUITY_SELL_RESEARCH_UNIVERSE.length, 31)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.rsiMax, 36)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.stochKMax, 15.4)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.bbPctBMax, 0.01)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.ma20DevMax, -4.2)
  })
})
