/**
 * DBB signal-strength v8 — 3-of-4 vs 4-of-4.
 * node --test scripts/dbb-chart-quality-v8.test.mjs
 */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import { DAILY_BOTTOM_THRESHOLDS } from "../api/_lib/dailyBottomBuyEngine.js"
import { FROZEN_THRESHOLDS } from "./lib/daily-bottom-split-buy-sim.mjs"
import {
  STRENGTH_RULE,
  VERDICT_LEVELS,
  analyzeSignalStrength,
  classifyStrengthGroup,
  countMetConditions,
  sameDayStrengthGaps,
  summarizeGroup,
  verifySignalCounts,
  wilsonSuccessCi,
} from "./lib/dbb-chart-quality-v8.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const dataDir = join(root, "vite-project", "public", "data")

function read(rel) {
  return readFileSync(join(root, rel), "utf8")
}

function hash(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

function horizon(priceReturnPct, maxDrawdownPct, excessQqqPct = null, status = "complete") {
  return {
    tradingDays: 60,
    priceReturnPct,
    priceReturnStatus: status,
    maxDrawdownPct,
    maxDrawdownStatus: status === "complete" ? "complete" : "incomplete",
    excessQqqPct,
  }
}

function row({ id, symbol, signalDate, signalCount, ret60, mae60, excess = null }) {
  return {
    id,
    symbol,
    signalDate,
    signalCount,
    entryDate: signalDate,
    entryPrice: 100,
    horizons: {
      "20": horizon(ret60 != null ? ret60 * 0.5 : null, mae60, excess, ret60 == null ? "incomplete" : "complete"),
      "60": horizon(ret60, mae60, excess, ret60 == null ? "incomplete" : "complete"),
      "120": horizon(ret60 != null ? ret60 * 1.2 : null, mae60, excess, ret60 == null ? "incomplete" : "complete"),
    },
  }
}

describe("dbb chart quality v8 strength", () => {
  it("counts four frozen conditions and classifies 3 vs 4 groups", () => {
    assert.equal(FROZEN_THRESHOLDS.rsiMax, 36)
    assert.equal(FROZEN_THRESHOLDS.stochKMax, 15.4)
    assert.equal(FROZEN_THRESHOLDS.bbPctBMax, 0.01)
    assert.equal(FROZEN_THRESHOLDS.ma20DevMax, -4.2)
    const four = countMetConditions({
      rsi14: 30,
      stochK: 10,
      bbPctB: -0.05,
      ma20DevPct: -5,
    })
    assert.equal(four.count, 4)
    assert.equal(classifyStrengthGroup(four.count), "four")

    const three = countMetConditions({
      rsi14: 30,
      stochK: 10,
      bbPctB: -0.05,
      ma20DevPct: -3, // fails MA20
    })
    assert.equal(three.count, 3)
    assert.equal(three.ma, false)
    assert.equal(classifyStrengthGroup(3), "three")
    assert.equal(classifyStrengthGroup(2), "below_signal")
    assert.equal(classifyStrengthGroup(null), "unclassified")
  })

  it("uses next-open style rows for success, MAE, and incomplete handling", () => {
    const rows = [
      row({ id: "a", symbol: "AAA", signalDate: "2020-01-02", signalCount: 3, ret60: 5, mae60: 4 }),
      row({ id: "b", symbol: "BBB", signalDate: "2020-01-02", signalCount: 3, ret60: -2, mae60: 8 }),
      row({ id: "c", symbol: "CCC", signalDate: "2020-01-03", signalCount: 3, ret60: 0, mae60: 1 }),
      row({ id: "d", symbol: "DDD", signalDate: "2020-01-04", signalCount: 3, ret60: null, mae60: null }),
    ]
    const summary = summarizeGroup(rows, 60)
    assert.equal(summary.signals, 4)
    assert.equal(summary.complete, 3)
    assert.equal(summary.incomplete, 1)
    assert.equal(summary.successCount, 1)
    assert.equal(summary.lossCount, 1)
    assert.equal(summary.zeroCount, 1)
    assert.equal(summary.successRate, roundish((1 / 3) * 100))
    assert.equal(summary.maeMedian, 4)
    assert.ok(summary.successRateCi.lo != null)
    assert.ok(summary.successRateCi.hi != null)
  })

  it("does not treat incomplete as failure in success-rate denominator", () => {
    const ci = wilsonSuccessCi(2, 4)
    assert.ok(ci.lo < 50 && ci.hi > 50)
    const incompleteHeavy = summarizeGroup(
      [
        row({ id: "1", symbol: "A", signalDate: "2021-01-01", signalCount: 4, ret60: 10, mae60: 2 }),
        row({ id: "2", symbol: "B", signalDate: "2021-01-02", signalCount: 4, ret60: null, mae60: null }),
        row({ id: "3", symbol: "C", signalDate: "2021-01-03", signalCount: 4, ret60: null, mae60: null }),
      ],
      60,
    )
    assert.equal(incompleteHeavy.complete, 1)
    assert.equal(incompleteHeavy.successRate, 100)
  })

  it("compares same-day gaps without assuming independence across symbols", () => {
    const three = [
      row({ id: "t1", symbol: "A", signalDate: "2022-01-10", signalCount: 3, ret60: 1, mae60: 5 }),
      row({ id: "t2", symbol: "B", signalDate: "2022-01-11", signalCount: 3, ret60: 2, mae60: 4 }),
    ]
    const four = [
      row({ id: "f1", symbol: "C", signalDate: "2022-01-10", signalCount: 4, ret60: 8, mae60: 3 }),
      row({ id: "f2", symbol: "D", signalDate: "2022-01-12", signalCount: 4, ret60: 3, mae60: 2 }),
    ]
    const gaps = sameDayStrengthGaps(three, four, 60)
    assert.equal(gaps.pairedDates, 1)
    assert.equal(gaps.returnGapMedian, 7)
    assert.equal(gaps.only3Dates, 1)
    assert.equal(gaps.only4Dates, 1)
  })

  it("keeps train/val split and matches frozen v1 signalCount when bars verify", () => {
    const paths = [1, 2, 3, 4, 5, 6, 7].map((n) => join(dataDir, `dbb-chart-quality-v${n}.json`))
    const before = paths.map(hash)
    const v1 = JSON.parse(readFileSync(paths[0], "utf8"))
    const report = JSON.parse(readFileSync(join(dataDir, "dbb-chart-quality-v8.json"), "utf8"))

    assert.equal(report.counts.signals, 1380)
    assert.equal(report.counts.three + report.counts.four + report.counts.unclassified, 1380)
    assert.equal(report.counts.unclassified, 0)
    assert.equal(report.split.trainEndDate, v1.split.trainEndDate)
    assert.equal(report.split.validationStartDate, v1.split.validationStartDate)
    assert.equal(VERDICT_LEVELS.includes(report.verdict.level), true)
    assert.match(STRENGTH_RULE.noOptimize, /바꾸지/)

    const trainDates = new Set(
      v1.rows.filter((row) => row.signalDate <= v1.split.trainEndDate).map((row) => row.signalDate),
    )
    const valDates = new Set(
      v1.rows.filter((row) => row.signalDate >= v1.split.validationStartDate).map((row) => row.signalDate),
    )
    for (const date of trainDates) assert.equal(valDates.has(date), false)

    assert.equal(report.verification.ok, true)
    assert.equal(report.verification.mismatched, 0)
    assert.ok(report.verification.matched > 0)

    assert.equal(typeof analyzeSignalStrength, "function")
    assert.equal(typeof verifySignalCounts, "function")
    assert.deepEqual(paths.map(hash), before)
  })

  it("wires route and leaves prior research screens and buy thresholds unchanged", () => {
    assert.match(read("vite-project/src/App.jsx"), /path="\/dbb-chart-quality-v8"/)
    assert.match(read("vite-project/src/utils/ydsUiLabels.js"), /신호 강도 검증 v8/)
    for (const page of [
      "vite-project/src/pages/DbbChartQualityV7Page.jsx",
      "vite-project/src/pages/DbbChartQualityV6Page.jsx",
      "vite-project/src/content/dbbChartQualityV7.js",
      "vite-project/src/pages/DailyBottomBuyPage.jsx",
      "vite-project/src/content/ydsTradeRecords.js",
      "api/_lib/dailyBottomBuyEngine.js",
    ]) {
      assert.equal(read(page).includes("dbbChartQualityV8"), false)
      assert.equal(read(page).includes("dbb-chart-quality-v8"), false)
    }
    assert.equal(DAILY_BOTTOM_THRESHOLDS.rsiMax, 36)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.ma20DevMax, -4.2)
    assert.equal(FROZEN_THRESHOLDS.rsiMax, 36)
  })
})

function roundish(value) {
  return Math.round(value * 100) / 100
}
