/**
 * ETF signal regime comparison v3.
 * node --test scripts/etf-signal-regime-v3.test.mjs
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import { DAILY_BOTTOM_THRESHOLDS } from "../api/_lib/dailyBottomBuyEngine.js"
import { classifyTrendRegime } from "./lib/daily-bottom-buy-trend-regime-validation.mjs"
import {
  REGIME_RULE,
  analyzeSignalRegimes,
  buildRegimeByDate,
  regimeFromCloses,
} from "../vite-project/src/content/etfSignalRegimeV3.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

function read(rel) {
  return readFileSync(join(root, rel), "utf8")
}

function closesFrom(start, count, step) {
  const out = []
  for (let i = 0; i < count; i++) out.push(start + i * step)
  return out
}

describe("etf signal regime v3", () => {
  it("matches the pre-fixed trend rule and ignores closes after the signal day", () => {
    const rising = closesFrom(100, 260, 0.4)
    const falling = closesFrom(200, 260, -0.3)
    assert.equal(regimeFromCloses(rising), "bull")
    assert.equal(regimeFromCloses(falling), "bear")
    assert.equal(regimeFromCloses(rising.slice(0, 30)), "unclassified")

    const flat = Array.from({ length: 260 }, () => 100)
    const last = flat.length - 1
    const ma200 = 100
    const mapped = classifyTrendRegime({
      aboveMa200: flat[last] > ma200,
      ma200Slope: 0,
      ma50AboveMa200: false,
    })
    assert.equal(mapped, "down")
    assert.equal(regimeFromCloses(flat), "bear")

    const bars = rising.map((close, index) => ({
      date: `2020-01-${String((index % 28) + 1).padStart(2, "0")}`,
      close,
    }))
    for (let i = 0; i < bars.length; i++) {
      const month = String(Math.floor(i / 28) + 1).padStart(2, "0")
      bars[i].date = `2020-${month}-${String((i % 28) + 1).padStart(2, "0")}`
    }
    const byDate = buildRegimeByDate(bars)
    const index = 240
    assert.equal(byDate.get(bars[index].date), regimeFromCloses(rising.slice(0, index + 1)))
    const future = bars.map((bar, i) => (i > index ? { ...bar, close: 1 } : bar))
    assert.equal(buildRegimeByDate(future).get(bars[index].date), byDate.get(bars[index].date))
    assert.notEqual(buildRegimeByDate(future).get(bars[bars.length - 1].date), byDate.get(bars[bars.length - 1].date))
  })

  it("leaves a missing signal date unclassified and keeps incomplete returns out of the average", () => {
    const closes = closesFrom(100, 260, 0.2)
    const bars = closes.map((close, index) => ({
      date: new Date(Date.UTC(2021, 0, 1 + index)).toISOString().slice(0, 10),
      close,
    }))
    const known = bars[250].date
    const report = {
      universe: ["AAA"],
      episodes: [
        {
          id: "AAA:known",
          symbol: "AAA",
          themeShort: "AAA",
          signalDate: known,
          horizons: {
            20: { priceReturnStatus: "complete", priceReturnPct: 10, maxDrawdownStatus: "complete", maxDrawdownPct: 2, totalReturnStatus: "unavailable", totalReturnPct: null },
            60: { priceReturnStatus: "incomplete", priceReturnPct: null, maxDrawdownStatus: "incomplete", maxDrawdownPct: null, totalReturnStatus: "unavailable", totalReturnPct: null },
            120: { priceReturnStatus: "complete", priceReturnPct: null, maxDrawdownStatus: "incomplete", maxDrawdownPct: null, totalReturnStatus: "complete", totalReturnPct: 4 },
          },
        },
        {
          id: "AAA:missing",
          symbol: "AAA",
          themeShort: "AAA",
          signalDate: "1999-01-01",
          horizons: {
            20: { priceReturnStatus: "complete", priceReturnPct: -5, maxDrawdownStatus: "complete", maxDrawdownPct: 8, totalReturnStatus: "complete", totalReturnPct: -4 },
            60: { priceReturnStatus: "complete", priceReturnPct: 0, maxDrawdownStatus: "complete", maxDrawdownPct: 1, totalReturnStatus: "unavailable", totalReturnPct: null },
            120: { priceReturnStatus: "incomplete", priceReturnPct: null, maxDrawdownStatus: "incomplete", maxDrawdownPct: null, totalReturnStatus: "unavailable", totalReturnPct: null },
          },
        },
      ],
    }
    const analysis = analyzeSignalRegimes(report, bars)
    assert.equal(analysis.counts.total, 2)
    assert.equal(analysis.counts.bull + analysis.counts.bear + analysis.counts.sideways + analysis.counts.unclassified, 2)
    assert.equal(analysis.counts.unclassified, 1)
    const bull = analysis.regimes.bull
    assert.equal(bull.total.signals, 1)
    assert.equal(bull.total.horizons["20"].priceMean, 10)
    assert.equal(bull.total.horizons["60"].complete, 0)
    assert.equal(bull.total.horizons["60"].incomplete, 1)
    assert.equal(bull.total.horizons["60"].priceMean, null)
    assert.equal(bull.total.horizons["60"].positiveRate, null)
    assert.equal(bull.total.horizons["120"].complete, 0)
    assert.equal(bull.total.horizons["120"].totalCount, 1)
    assert.equal(bull.total.horizons["120"].totalMean, 4)
    const missing = analysis.regimes.unclassified
    assert.equal(missing.total.horizons["60"].priceMean, 0)
    assert.equal(missing.total.horizons["60"].positiveRate, 0)
    assert.equal(missing.total.horizons["60"].totalCount, 0)
    assert.equal(missing.total.horizons["60"].totalMean, null)
    assert.equal(missing.rows[0].horizons["60"].complete + missing.rows[0].horizons["60"].incomplete, 1)
    assert.equal(REGIME_RULE.smallSampleComplete, 30)
    assert.equal(REGIME_RULE.maSlow, 200)
    assert.equal(REGIME_RULE.slopeLookback, 20)
  })

  it("splits all 905 stored signals across regimes without changing v1 or v2", () => {
    const report = JSON.parse(read("vite-project/public/data/etf-signal-track-v1.json"))
    const qqq = JSON.parse(read("scripts/.cache/dbb-qqq-daily-ohlcv.json")).bars
    const analysis = analyzeSignalRegimes(report, qqq)
    assert.equal(report.episodes.length, 905)
    assert.equal(analysis.counts.total, 905)
    assert.equal(
      analysis.counts.bull + analysis.counts.bear + analysis.counts.sideways + analysis.counts.unclassified,
      905,
    )
    for (const regime of ["bull", "bear", "sideways", "unclassified"]) {
      const block = analysis.regimes[regime]
      assert.equal(block.rows.reduce((sum, row) => sum + row.signals, 0), block.total.signals)
      assert.equal(block.rows.length, 17)
      for (const row of block.rows) {
        for (const days of [20, 60, 120]) {
          const horizon = row.horizons[String(days)]
          assert.equal(horizon.complete + horizon.incomplete, row.signals, `${regime} ${row.symbol} ${days}`)
        }
      }
    }
    const track = read("vite-project/src/pages/EtfSignalTrackPage.jsx")
    const compare = read("vite-project/src/pages/EtfSignalComparePage.jsx")
    const page = read("vite-project/src/pages/EtfSignalRegimePage.jsx")
    const app = read("vite-project/src/App.jsx")
    assert.equal(track.includes("etfSignalRegimeV3"), false)
    assert.equal(compare.includes("etfSignalRegimeV3"), false)
    assert.match(app, /path="\/etf-signal-regime-v3"/)
    assert.match(page, /분류 불가/)
    assert.equal(page.includes("ydsTradeRecords"), false)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.rsiMax, 36)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.ma20DevMax, -4.2)
  })
})
