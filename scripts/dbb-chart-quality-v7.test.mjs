/**
 * DBB practical utility v7.
 * node --test scripts/dbb-chart-quality-v7.test.mjs
 */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import { DAILY_BOTTOM_THRESHOLDS } from "../api/_lib/dailyBottomBuyEngine.js"
import {
  UTILITY_RULE,
  VERDICT_LEVELS,
  analyzePracticalUtility,
  evaluateStopOnBar,
  simulateRiskTrade,
} from "./lib/dbb-chart-quality-v7.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const dataDir = join(root, "vite-project", "public", "data")

function read(rel) {
  return readFileSync(join(root, rel), "utf8")
}

function hash(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

function barsFrom(specs) {
  return specs.map((spec, index) => ({
    date: `2020-01-${String(index + 1).padStart(2, "0")}`,
    open: spec.o,
    high: spec.h,
    low: spec.l,
    close: spec.c,
    volume: 1_000_000,
  }))
}

describe("dbb chart quality v7 utility", () => {
  it("keeps rules fixed and separates stop gap vs touch fills", () => {
    assert.deepEqual(UTILITY_RULE.stopPcts, [-8, -12, -16])
    assert.equal(UTILITY_RULE.trendMa, 20)
    assert.match(UTILITY_RULE.noOptimize, /다시 고르지/)
    assert.deepEqual(VERDICT_LEVELS.length, 4)
    const gap = evaluateStopOnBar({ open: 90, high: 95, low: 88, close: 92 }, 92)
    assert.equal(gap.kind, "gap")
    assert.equal(gap.exitPrice, 90)
    const touch = evaluateStopOnBar({ open: 100, high: 101, low: 91, close: 95 }, 92)
    assert.equal(touch.kind, "touch")
    assert.equal(touch.exitPrice, 92)
    const adverse = evaluateStopOnBar({ open: 100, high: 101, low: 91, close: 95 }, 92, "adverseTouch")
    assert.equal(adverse.exitPrice, 91)
    const miss = evaluateStopOnBar({ open: 100, high: 105, low: 99, close: 102 }, 92)
    assert.equal(miss.hit, false)
  })

  it("simulates horizon hold, stop, and next-open trend exit without inventing zero returns", () => {
    const bars = barsFrom([
      { o: 100, h: 101, l: 99, c: 100 }, // entry idx 0
      { o: 100, h: 102, l: 98, c: 101 },
      { o: 101, h: 103, l: 100, c: 102 },
      { o: 102, h: 104, l: 101, c: 103 },
      { o: 103, h: 105, l: 102, c: 104 },
    ])
    const hold = simulateRiskTrade(bars, 0, 4, {})
    assert.equal(hold.status, "complete")
    assert.equal(hold.exitReason, "horizon")
    assert.equal(hold.grossReturnPct, 4)

    const stopBars = barsFrom([
      { o: 100, h: 101, l: 99, c: 100 },
      { o: 99, h: 100, l: 90, c: 91 },
      { o: 92, h: 95, l: 91, c: 94 },
    ])
    const stopped = simulateRiskTrade(stopBars, 0, 2, { stopPct: -8 })
    assert.equal(stopped.exitReason, "stop")
    assert.equal(stopped.stopKind, "touch")
    assert.equal(stopped.grossReturnPct, -8)

    const incomplete = simulateRiskTrade(bars, 0, 40, {})
    assert.equal(incomplete.status, "incomplete")
    assert.equal(incomplete.grossReturnPct, undefined)
  })

  it("prioritizes stop over trend on the same path and uses next open for trend", () => {
    // Build enough bars for SMA20: flat then break below.
    const specs = []
    for (let i = 0; i < 25; i++) specs.push({ o: 100, h: 101, l: 99, c: 100 })
    specs[21] = { o: 100, h: 100, l: 98, c: 98 } // close < sma ~100
    specs[22] = { o: 97, h: 98, l: 96, c: 97 }
    const bars = barsFrom(specs)
    const trend = simulateRiskTrade(bars, 0, 24, { trendMa: 20, trendExitMode: "nextOpen" })
    assert.equal(trend.exitReason, "trend_next_open")
    assert.equal(trend.exitPrice, 97)

    // Gap through stop on trend exit day → stop wins.
    specs[22] = { o: 90, h: 91, l: 89, c: 90 }
    const mixed = simulateRiskTrade(barsFrom(specs), 0, 24, {
      stopPct: -8,
      trendMa: 20,
      trendExitMode: "nextOpen",
    })
    assert.equal(mixed.exitReason, "stop")
    assert.equal(mixed.stopKind, "gap")
  })

  it("analyzes frozen v1 without rewriting v1~v6 and keeps train/val dates split", () => {
    const paths = [1, 2, 3, 4, 5, 6].map((n) => join(dataDir, `dbb-chart-quality-v${n}.json`))
    const before = paths.map(hash)
    const v1 = JSON.parse(readFileSync(paths[0], "utf8"))
    const report = JSON.parse(readFileSync(join(dataDir, "dbb-chart-quality-v7.json"), "utf8"))
    assert.equal(report.counts.signals, 1380)
    assert.equal(report.split.trainEndDate, v1.split.trainEndDate)
    assert.equal(report.split.validationStartDate, v1.split.validationStartDate)
    assert.equal(report.studyA.eReference.rankEligible, false)
    assert.equal(VERDICT_LEVELS.includes(report.overall.studyA.level), true)
    assert.equal(VERDICT_LEVELS.includes(report.overall.studyB.level), true)
    assert.equal(UTILITY_RULE.stopPcts.includes(-12), true)
    assert.equal(typeof analyzePracticalUtility, "function")

    const trainDates = new Set(
      v1.rows.filter((row) => row.signalDate <= v1.split.trainEndDate).map((row) => row.signalDate),
    )
    const valDates = new Set(
      v1.rows.filter((row) => row.signalDate >= v1.split.validationStartDate).map((row) => row.signalDate),
    )
    for (const date of trainDates) assert.equal(valDates.has(date), false)

    assert.deepEqual(paths.map(hash), before)
  })

  it("wires route and leaves prior research screens and buy thresholds unchanged", () => {
    assert.match(read("vite-project/src/App.jsx"), /path="\/dbb-chart-quality-v7"/)
    assert.match(read("vite-project/src/utils/ydsUiLabels.js"), /실전 효용 검증 v7/)
    for (const page of [
      "vite-project/src/pages/DbbChartQualityV6Page.jsx",
      "vite-project/src/pages/DbbChartQualityV5Page.jsx",
      "vite-project/src/content/dbbChartQualityV6.js",
      "vite-project/src/pages/DailyBottomBuyPage.jsx",
      "vite-project/src/content/ydsTradeRecords.js",
    ]) {
      assert.equal(read(page).includes("dbbChartQualityV7"), false)
    }
    assert.equal(DAILY_BOTTOM_THRESHOLDS.rsiMax, 36)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.ma20DevMax, -4.2)
  })
})
