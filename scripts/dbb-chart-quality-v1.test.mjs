/**
 * DBB chart quality v1.
 * node --test scripts/dbb-chart-quality-v1.test.mjs
 */
import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import { DAILY_BOTTOM_THRESHOLDS } from "../api/_lib/dailyBottomBuyEngine.js"
import { FROZEN_THRESHOLDS } from "./lib/daily-bottom-split-buy-sim.mjs"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import {
  SCORE_RULE,
  SECTOR_BENCHMARK,
  analyzeChartQuality,
  benchmarkReturns,
  measureNextOpenEntry,
  scoreChartAtSignal,
  scoreQuartiles,
  splitBySignalDate,
  summarizeOutcomes,
  targetTrainCount,
} from "./lib/dbb-chart-quality-v1.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

function read(rel) {
  return readFileSync(join(root, rel), "utf8")
}

function risingBars(n = 260, start = 100) {
  return Array.from({ length: n }, (_, index) => {
    const close = start + index * 0.4
    return {
      date: new Date(Date.UTC(2018, 0, 1 + index)).toISOString().slice(0, 10),
      open: close - 0.1,
      high: close + 0.5,
      low: close - 0.5,
      close,
      volume: 1_000_000 + (index % 5) * 10_000,
    }
  })
}

describe("dbb chart quality v1", () => {
  it("keeps the score weights and sector map fixed before outcomes", () => {
    assert.equal(SCORE_RULE.A.weight, 30)
    assert.equal(SCORE_RULE.B.weight, 25)
    assert.equal(SCORE_RULE.C.weight, 25)
    assert.equal(SCORE_RULE.D.weight, 10)
    assert.equal(SCORE_RULE.E.weight, 10)
    assert.equal(SECTOR_BENCHMARK.LRCX, "SMH")
    assert.equal(SECTOR_BENCHMARK.AMAT, "SMH")
    assert.equal(SECTOR_BENCHMARK.MU, "SMH")
    assert.equal(SECTOR_BENCHMARK.TSM, "SMH")
    assert.equal(SECTOR_BENCHMARK.VRT, "GRID")
    assert.equal(SECTOR_BENCHMARK.FCX, null)
    assert.equal(EQUITY_SELL_RESEARCH_UNIVERSE.length, 31)
    assert.equal(targetTrainCount(1380), 966)
  })

  it("does not use future closes in the chart score", () => {
    const bars = risingBars(260)
    const score = scoreChartAtSignal(bars, 240)
    assert.equal(score.asOf, bars[240].date)
    const mutated = bars.map((bar, index) => (index > 240 ? { ...bar, close: 1, high: 1, low: 1, open: 1 } : bar))
    const again = scoreChartAtSignal(mutated, 240)
    assert.equal(again.totalScore, score.totalScore)
    assert.equal(again.parts.A.score, score.parts.A.score)
    assert.equal(again.parts.B.score, score.parts.B.score)
  })

  it("marks missing volume and short history without inventing zero scores", () => {
    const short = risingBars(50)
    const early = scoreChartAtSignal(short, 40)
    assert.equal(early.totalStatus, "unavailable")
    assert.equal(early.parts.A.score, null)
    const bars = risingBars(260).map((bar) => ({ ...bar, volume: null }))
    const scored = scoreChartAtSignal(bars, 240)
    assert.equal(scored.parts.D.score, null)
    assert.equal(scored.parts.D.status, "unavailable")
    if (scored.totalScore != null) assert.equal(scored.weightPct < 100, true)
  })

  it("uses the next open as entry and keeps incomplete horizons null", () => {
    const bars = risingBars(80)
    const pending = measureNextOpenEntry(bars, 79)
    assert.equal(pending.entryStatus, "pending")
    assert.equal(pending.horizons["20"].priceReturnPct, null)
    const measured = measureNextOpenEntry(bars, 10)
    assert.equal(measured.entryStatus, "confirmed")
    assert.equal(measured.entryDate, bars[11].date)
    assert.equal(measured.entryPrice, Math.round(bars[11].open * 100) / 100)
    assert.equal(measured.horizons["20"].priceReturnStatus, "complete")
    const shortHorizon = measureNextOpenEntry(bars, 30)
    assert.equal(shortHorizon.horizons["20"].priceReturnStatus, "complete")
    assert.equal(shortHorizon.horizons["60"].priceReturnStatus, "incomplete")
    assert.equal(shortHorizon.horizons["60"].priceReturnPct, null)
  })

  it("aligns benchmark returns to the same end date and keeps same-day signals together", () => {
    const bars = risingBars(100)
    const map = new Map(bars.map((bar) => [bar.date, bar.close]))
    const date = bars[80].date
    const ret = benchmarkReturns(map, date, [20, 60])
    assert.equal(Number.isFinite(ret[20]), true)
    assert.equal(Number.isFinite(ret[60]), true)
    const missing = benchmarkReturns(map, "2099-01-01", [20])
    assert.equal(missing[20], null)
    const rows = [
      { id: "A:2020-01-02", symbol: "A", signalDate: "2020-01-02" },
      { id: "B:2020-01-02", symbol: "B", signalDate: "2020-01-02" },
      { id: "A:2020-01-03", symbol: "A", signalDate: "2020-01-03" },
      { id: "A:2020-01-06", symbol: "A", signalDate: "2020-01-06" },
    ]
    const split = splitBySignalDate(rows, 0.7)
    const trainDates = new Set(split.train.map((row) => row.signalDate))
    const validationDates = new Set(split.validation.map((row) => row.signalDate))
    for (const dateKey of trainDates) assert.equal(validationDates.has(dateKey), false)
    assert.equal(split.train.filter((row) => row.signalDate === "2020-01-02").length, 2)
  })

  it("summarizes complete outcomes without filling gaps as zero", () => {
    const rows = [
      { horizons: { 60: { priceReturnStatus: "complete", priceReturnPct: 10, maxDrawdownStatus: "complete", maxDrawdownPct: 4, excessQqqPct: 2 } } },
      { horizons: { 60: { priceReturnStatus: "complete", priceReturnPct: -2, maxDrawdownStatus: "complete", maxDrawdownPct: 8, excessQqqPct: -1 } } },
      { horizons: { 60: { priceReturnStatus: "incomplete", priceReturnPct: null, maxDrawdownStatus: "incomplete", maxDrawdownPct: null } } },
    ]
    const summary = summarizeOutcomes(rows, 60)
    assert.equal(summary.complete, 2)
    assert.equal(summary.incomplete, 1)
    assert.equal(summary.priceMean, 4)
    assert.equal(summary.priceMedian, 4)
    assert.equal(summary.positiveRate, 50)
    assert.equal(summary.drawdownMedian, 6)
    const empty = summarizeOutcomes([], 60)
    assert.equal(empty.priceMean, null)
    assert.equal(empty.positiveRate, null)
    const quartiles = scoreQuartiles([
      ...Array.from({ length: 8 }, (_, index) => ({ totalStatus: "complete", totalScore: 80 - index, signalDate: `2020-01-${String(index + 1).padStart(2, "0")}`, symbol: "A", horizons: { 60: { priceReturnStatus: "complete", priceReturnPct: 10 - index, maxDrawdownStatus: "complete", maxDrawdownPct: index + 1 } } })),
    ])
    assert.equal(quartiles.top.count + quartiles.mid.count + quartiles.bottom.count, 8)
  })

  it("reuses 1380 frozen equity DBB episodes and leaves buy thresholds unchanged", () => {
    assert.equal(existsSync(join(root, "vite-project/public/data/dbb-chart-quality-v1.json")), true)
    const report = JSON.parse(read("vite-project/public/data/dbb-chart-quality-v1.json"))
    assert.equal(report.counts.signals, 1380)
    assert.equal(report.universeCount, 31)
    assert.equal(report.split.trainCount + report.split.validationCount, 1380)
    assert.equal(report.overall.complete + report.overall.incomplete, 1380)
    assert.equal(report.counts.scored + report.counts.unavailableScore, 1380)
    for (const symbol of ["LRCX", "AMAT", "MU", "TSM", "VRT"]) {
      assert.equal(report.rows.some((row) => row.symbol === symbol), true)
    }
    const trainDates = new Set(report.rows.filter((row) => row.signalDate <= report.split.trainEndDate).map((row) => row.signalDate))
    const validationDates = new Set(report.rows.filter((row) => row.signalDate >= report.split.validationStartDate).map((row) => row.signalDate))
    for (const date of trainDates) assert.equal(validationDates.has(date), false)
    assert.equal(FROZEN_THRESHOLDS.rsiMax, 36)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.rsiMax, 36)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.stochKMax, 15.4)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.bbPctBMax, 0.01)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.ma20DevMax, -4.2)
  })

  it("does not change earlier research screens, the buy engine, or trade records", () => {
    const pages = [
      "vite-project/src/pages/EtfSignalTrackPage.jsx",
      "vite-project/src/pages/EtfSignalComparePage.jsx",
      "vite-project/src/pages/EtfSignalRegimePage.jsx",
      "vite-project/src/pages/EtfSignalStabilityPage.jsx",
      "vite-project/src/pages/EtfSignalValidationPage.jsx",
      "vite-project/src/pages/DailyBottomBuyPage.jsx",
      "vite-project/src/content/ydsTradeRecords.js",
    ]
    for (const page of pages) assert.equal(read(page).includes("dbbChartQualityV1"), false)
    assert.equal(read("vite-project/src/content/ydsTradeRecords.js").includes("yds.tradeRecords.v1"), true)
    const app = read("vite-project/src/App.jsx")
    const labels = read("vite-project/src/utils/ydsUiLabels.js")
    assert.match(app, /path="\/dbb-chart-quality-v1"/)
    assert.match(labels, /DBB 차트 품질 분석 v1/)
    assert.equal(analyzeChartQuality({}, {}).counts.signals, 0)
  })
})
