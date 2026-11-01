/**
 * ETF signal chronological validation v5.
 * node --test scripts/etf-signal-validation-v5.test.mjs
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import { DAILY_BOTTOM_THRESHOLDS } from "../api/_lib/dailyBottomBuyEngine.js"
import {
  VALIDATION_RULE,
  analyzeValidation,
  compareSplitMedian,
  splitBySignalDate,
  targetTrainCount,
} from "../vite-project/src/content/etfSignalValidationV5.js"

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
    totalReturnStatus: extra.total == null ? "unavailable" : "complete",
    totalReturnPct: extra.total ?? null,
  }
}

function episode(symbol, date, pct, extra = {}) {
  return {
    id: `${symbol}:${date}:${extra.suffix || "a"}`,
    symbol,
    themeShort: symbol,
    signalDate: date,
    horizons: {
      20: horizon(pct, extra),
      60: horizon(pct, extra),
      120: horizon(extra.long == null ? null : extra.long, extra),
    },
  }
}

describe("etf signal validation v5", () => {
  it("keeps the 70 percent date cut and the 5 point comparison fixed", () => {
    assert.equal(VALIDATION_RULE.trainFraction, 0.7)
    assert.equal(VALIDATION_RULE.smallSampleComplete, 30)
    assert.equal(VALIDATION_RULE.medianGapPct, 5)
    assert.equal(VALIDATION_RULE.environmentGapPct, 10)
    assert.equal(targetTrainCount(905), 634)
    const enough = (median) => ({ horizons: { 60: { complete: 30, priceMedian: median } } })
    assert.equal(compareSplitMedian(enough(10), { horizons: { 60: { complete: 29, priceMedian: 20 } } }).status, "비교 불가")
    assert.equal(compareSplitMedian(enough(4), enough(10)).status, "검증 구간이 더 높음")
    assert.equal(compareSplitMedian(enough(10), enough(6)).gapPct, -4)
    assert.equal(compareSplitMedian(enough(10), enough(6)).status, "비슷함")
  })

  it("keeps same-day signals together and does not use returns to place the cut", () => {
    const day = (date, count, pct) => Array.from({ length: count }, (_, index) => episode("ETF", date, pct, { suffix: String(index), drawdown: 1, total: pct }))
    const episodes = [...day("2020-01-02", 3, 1), ...day("2020-01-03", 3, 50), ...day("2020-01-06", 4, -20)]
    const split = splitBySignalDate(episodes, 0.7)
    assert.equal(split.target, 7)
    assert.equal(split.train.length, 6)
    assert.equal(split.validation.length, 4)
    assert.equal(split.trainEndDate, "2020-01-03")
    assert.equal(split.validationStartDate, "2020-01-06")
    const trainDates = new Set(split.train.map((row) => row.signalDate))
    const validationDates = new Set(split.validation.map((row) => row.signalDate))
    for (const date of trainDates) assert.equal(validationDates.has(date), false)
    episodes[0].horizons["60"].priceReturnPct = 99
    const again = splitBySignalDate(episodes, 0.7)
    assert.equal(again.trainEndDate, split.trainEndDate)
    const oversized = splitBySignalDate([...day("2021-02-01", 8, 1), ...day("2021-02-02", 2, 2)], 0.7)
    assert.equal(oversized.train.length, 8)
    assert.equal(new Set(oversized.train.map((row) => row.signalDate)).size, 1)
  })

  it("calculates complete counts and return stats without filling gaps with zero", () => {
    const report = {
      universe: ["AAA", "BBB"],
      episodes: [
        episode("AAA", "2020-01-02", 10, { drawdown: 2, total: 11 }),
        episode("BBB", "2020-01-02", 30, { drawdown: 4, total: 33 }),
        episode("AAA", "2020-06-01", -5, { drawdown: 8, total: -4 }),
        episode("BBB", "2024-03-04", null),
      ],
    }
    const bars = Array.from({ length: 260 }, (_, index) => ({
      date: new Date(Date.UTC(2018, 0, 1 + index)).toISOString().slice(0, 10),
      close: 100 + index,
    }))
    const analysis = analyzeValidation(report, bars)
    assert.equal(analysis.counts.assigned, 4)
    const train = analysis.train.summary.horizons["60"]
    assert.equal(train.complete + train.incomplete, analysis.train.signals)
    assert.equal(train.complete, 3)
    assert.equal(train.priceMean, 11.67)
    assert.equal(train.priceMedian, 10)
    assert.equal(train.positiveRate, 66.67)
    assert.equal(train.drawdownMean, 4.67)
    assert.equal(train.drawdownMedian, 4)
    assert.equal(train.totalCount, 3)
    assert.equal(train.totalMedian, 11)
    const validation = analysis.validation.summary.horizons["60"]
    assert.equal(validation.complete, 0)
    assert.equal(validation.priceMean, null)
    assert.equal(validation.priceMedian, null)
    assert.equal(validation.positiveRate, null)
  })

  it("splits all 905 stored signals without shared dates or a future-price cut", () => {
    const report = JSON.parse(read("vite-project/public/data/etf-signal-track-v1.json"))
    const qqq = JSON.parse(read("scripts/.cache/dbb-qqq-daily-ohlcv.json")).bars
    const analysis = analyzeValidation(report, qqq)
    const later = analyzeValidation(report, qqq.concat([{ date: "2027-01-04", close: 1 }]))
    assert.equal(report.episodes.length, 905)
    assert.equal(analysis.counts.total, 905)
    assert.equal(analysis.counts.train + analysis.counts.validation + analysis.undated, 905)
    assert.equal(analysis.undated, 0)
    assert.equal(analysis.trainEndDate < analysis.validationStartDate, true)
    assert.equal(later.trainEndDate, analysis.trainEndDate)
    assert.equal(later.validationStartDate, analysis.validationStartDate)
    const trainDates = new Set(report.episodes.filter((row) => row.signalDate <= analysis.trainEndDate).map((row) => row.signalDate))
    const validationDates = new Set(report.episodes.filter((row) => row.signalDate >= analysis.validationStartDate).map((row) => row.signalDate))
    for (const date of trainDates) assert.equal(validationDates.has(date), false)
    for (const side of [analysis.train, analysis.validation]) {
      for (const days of ["20", "60", "120"]) {
        const row = side.summary.horizons[days]
        assert.equal(row.complete + row.incomplete, side.signals)
      }
      assert.equal(side.symbols.reduce((sum, row) => sum + row.signals, 0), side.signals)
      const regimeSum = ["bull", "bear", "sideways", "unclassified"].reduce((sum, regime) => sum + side.regimes[regime].signals, 0)
      assert.equal(regimeSum, side.signals)
    }
    assert.equal(analysis.independentSamples, false)
    assert.equal(analysis.guaranteesFuture, false)
  })

  it("does not change the earlier research screens or the buy thresholds", () => {
    const pages = [
      "vite-project/src/pages/EtfSignalTrackPage.jsx",
      "vite-project/src/pages/EtfSignalComparePage.jsx",
      "vite-project/src/pages/EtfSignalRegimePage.jsx",
      "vite-project/src/pages/EtfSignalStabilityPage.jsx",
      "vite-project/src/pages/DailyBottomBuyPage.jsx",
    ]
    for (const page of pages) assert.equal(read(page).includes("etfSignalValidationV5"), false)
    const app = read("vite-project/src/App.jsx")
    const labels = read("vite-project/src/utils/ydsUiLabels.js")
    const screen = read("vite-project/src/pages/EtfSignalValidationPage.jsx")
    assert.match(app, /path="\/etf-signal-validation-v5"/)
    assert.match(labels, /ETF 신호 시간순 검증/)
    assert.match(screen, /주의/)
    assert.equal(screen.includes("ydsTradeRecords"), false)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.rsiMax, 36)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.stochKMax, 15.4)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.bbPctBMax, 0.01)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.ma20DevMax, -4.2)
  })
})
