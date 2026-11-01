/**
 * ETF signal stability v4.
 * node --test scripts/etf-signal-stability-v4.test.mjs
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import { DAILY_BOTTOM_THRESHOLDS } from "../api/_lib/dailyBottomBuyEngine.js"
import {
  STABILITY_RULE,
  analyzeStability,
  comparePeriodMedian,
  dateClusters,
  yearOf,
} from "../vite-project/src/content/etfSignalStabilityV4.js"
import { summarizeSymbol } from "../vite-project/src/content/etfSignalCompare.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

function read(rel) {
  return readFileSync(join(root, rel), "utf8")
}

function horizon(pct, extra = {}) {
  return {
    priceReturnStatus: pct == null ? "incomplete" : "complete",
    priceReturnPct: pct,
    maxDrawdownStatus: extra.drawdown == null ? "incomplete" : "complete",
    maxDrawdownPct: extra.drawdown ?? null,
    totalReturnStatus: "unavailable",
    totalReturnPct: null,
  }
}

function episode(symbol, date, pct) {
  return {
    id: `${symbol}:${date}`,
    symbol,
    themeShort: symbol,
    signalDate: date,
    horizons: { 20: horizon(pct), 60: horizon(pct, { drawdown: 1 }), 120: horizon(null) },
  }
}

describe("etf signal stability v4", () => {
  it("keeps the year rule and the 5 point, 30 sample comparison fixed", () => {
    assert.equal(yearOf("2020-03-16"), "2020")
    assert.equal(yearOf("03-16"), null)
    assert.equal(STABILITY_RULE.smallSampleComplete, 30)
    assert.equal(STABILITY_RULE.outlierGapPct, 5)
    assert.equal(STABILITY_RULE.concentrationShare, 0.5)
    const enough = (median) => ({ horizons: { 60: { complete: 30, priceMedian: median } } })
    const small = { horizons: { 60: { complete: 29, priceMedian: 20 } } }
    assert.equal(comparePeriodMedian(small, enough(0)).status, "비교 불가")
    assert.equal(comparePeriodMedian(enough(10), enough(4)).status, "이 구간이 더 높음")
    assert.equal(comparePeriodMedian(enough(6), enough(10)).gapPct, -4)
    assert.equal(comparePeriodMedian(enough(6), enough(10)).status, "비슷함")
  })

  it("counts every same-day signal once inside its date cluster and leaves an empty cluster null", () => {
    const episodes = [
      episode("AAA", "2024-01-02", 10),
      episode("BBB", "2024-01-02", 30),
      episode("CCC", "2024-01-03", null),
      episode("AAA", "2024-01-02", 20),
    ]
    episodes[3].id = "AAA:2024-01-02:b"
    const overlap = dateClusters(episodes, 60)
    assert.equal(overlap.dates, 2)
    assert.equal(overlap.clusters.reduce((sum, cluster) => sum + cluster.members, 0), 4)
    assert.equal(overlap.multiSignals, 3)
    assert.equal(overlap.clusters[0].complete, 3)
    assert.equal(overlap.clusters[0].priceMean, 20)
    assert.equal(overlap.clusters[1].complete, 0)
    assert.equal(overlap.clusters[1].priceMean, null)
    assert.equal(overlap.incompleteClusters, 1)
    const ids = overlap.clusters.flatMap((cluster) => cluster.symbols)
    assert.equal(ids.length, 4)
  })

  it("splits 905 stored signals by year and regime without dropping or double counting", () => {
    const report = JSON.parse(read("vite-project/public/data/etf-signal-track-v1.json"))
    const qqq = JSON.parse(read("scripts/.cache/dbb-qqq-daily-ohlcv.json")).bars
    const later = qqq.concat([{ date: "2027-01-04", close: 1 }])
    const analysis = analyzeStability(report, qqq)
    const shifted = analyzeStability(report, later)
    assert.equal(report.episodes.length, 905)
    assert.equal(analysis.counts.total, 905)
    assert.equal(analysis.counts.periods, 905)
    assert.equal(analysis.counts.regimes, 905)
    assert.deepEqual(
      analysis.periods.map((period) => period.summary.signals),
      shifted.periods.map((period) => period.summary.signals),
    )
    for (const regime of ["bull", "bear", "sideways", "unclassified"]) {
      assert.equal(analysis.regimes[regime].total.signals, shifted.regimes[regime].total.signals)
    }
    const seen = new Set()
    for (const episode of report.episodes) {
      assert.equal(seen.has(episode.id), false)
      seen.add(episode.id)
      const year = episode.signalDate.slice(0, 4)
      const bucket = analysis.periods.find((period) => period.year === year)
      assert.equal(bucket.summary.signals > 0, true)
    }
    for (const period of analysis.periods) {
      const row = period.summary.horizons["60"]
      assert.equal(row.complete + row.incomplete, period.summary.signals)
      if (row.complete === 0) assert.equal(row.priceMedian, null)
    }
    const memberSum = analysis.overlap.clusters.reduce((sum, cluster) => sum + cluster.members, 0) + analysis.overlap.undated
    assert.equal(memberSum, 905)
    assert.equal(analysis.symbols.reduce((sum, row) => sum + row.signals, 0), 905)
    assert.equal(analysis.independentSamples, false)
    const empty = summarizeSymbol({ symbol: "X", themeShort: "X" }, [])
    assert.equal(empty.horizons["60"].priceMean, null)
  })

  it("does not change the v1, v2, or v3 screens or the buy thresholds", () => {
    const track = read("vite-project/src/pages/EtfSignalTrackPage.jsx")
    const compare = read("vite-project/src/pages/EtfSignalComparePage.jsx")
    const regime = read("vite-project/src/pages/EtfSignalRegimePage.jsx")
    const page = read("vite-project/src/pages/EtfSignalStabilityPage.jsx")
    const app = read("vite-project/src/App.jsx")
    const labels = read("vite-project/src/utils/ydsUiLabels.js")
    assert.equal(track.includes("etfSignalStabilityV4"), false)
    assert.equal(compare.includes("etfSignalStabilityV4"), false)
    assert.equal(regime.includes("etfSignalStabilityV4"), false)
    assert.match(app, /path="\/etf-signal-stability-v4"/)
    assert.match(labels, /ETF 신호 안정성 검증/)
    assert.match(page, /주의/)
    assert.equal(page.includes("ydsTradeRecords"), false)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.rsiMax, 36)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.ma20DevMax, -4.2)
  })
})
