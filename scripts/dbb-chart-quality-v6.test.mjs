/**
 * DBB chart quality selection-effect v6.
 * node --test scripts/dbb-chart-quality-v6.test.mjs
 */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import { DAILY_BOTTOM_THRESHOLDS } from "../api/_lib/dailyBottomBuyEngine.js"
import { scoreChartAtSignal } from "./lib/dbb-chart-quality-v1.mjs"
import {
  SELECT_RULE,
  VERDICT_RULE,
  analyzeSelectionEffect,
  outcomeSummary,
  pickDayTopThird,
  sameDaySelectionGaps,
} from "./lib/dbb-chart-quality-v6.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const dataDir = join(root, "vite-project", "public", "data")

function read(rel) {
  return readFileSync(join(root, rel), "utf8")
}

function hash(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
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
      volume: 1_000_000 + index * 1000,
    }
  })
}

function row(symbol, date, parts, ret60, dd60) {
  return {
    id: `${symbol}:${date}`,
    symbol,
    signalDate: date,
    sectorBenchmark: "SMH",
    parts,
    horizons: {
      20: {
        priceReturnStatus: ret60 == null ? "incomplete" : "complete",
        priceReturnPct: ret60 == null ? null : ret60 / 2,
        maxDrawdownStatus: dd60 == null ? "incomplete" : "complete",
        maxDrawdownPct: dd60 == null ? null : dd60 / 2,
        excessQqqPct: ret60 == null ? null : ret60 / 2 - 1,
        excessSectorPct: ret60 == null ? null : ret60 / 2 - 2,
      },
      60: {
        priceReturnStatus: ret60 == null ? "incomplete" : "complete",
        priceReturnPct: ret60,
        maxDrawdownStatus: dd60 == null ? "incomplete" : "complete",
        maxDrawdownPct: dd60,
        excessQqqPct: ret60 == null ? null : ret60 - 1,
        excessSectorPct: ret60 == null ? null : ret60 - 2,
      },
      120: {
        priceReturnStatus: "incomplete",
        priceReturnPct: null,
        maxDrawdownStatus: "incomplete",
        maxDrawdownPct: null,
      },
    },
  }
}

describe("dbb chart quality v6 selection effect", () => {
  it("keeps selection and verdict rules fixed and blocks future bars from C/D scores", () => {
    assert.match(SELECT_RULE.cArm, /1\/3/)
    assert.match(SELECT_RULE.noOptimize, /바꾸지/)
    assert.deepEqual(VERDICT_RULE.levels, ["선별 효과 미입증", "판단 유보"])
    assert.equal(VERDICT_RULE.promisingNeeds.length, 5)
    const bars = risingBars(260)
    const qqq = new Map(bars.map((bar) => [bar.date, bar.close]))
    const score = scoreChartAtSignal(bars, 240, { qqqByDate: qqq })
    const mutated = bars.map((bar, index) => (index > 240 ? { ...bar, close: 1, volume: 1 } : bar))
    const again = scoreChartAtSignal(mutated, 240, { qqqByDate: qqq })
    assert.equal(again.parts.C.score, score.parts.C.score)
    assert.equal(again.parts.D.score, score.parts.D.score)
  })

  it("handles top-third ties, incomplete returns, and same-day gaps", () => {
    const empty = outcomeSummary([])
    assert.equal(empty.priceMedian, null)
    const tied = pickDayTopThird(
      [
        row("AAA", "2020-01-02", { C: 10, D: 4 }, 5, 2),
        row("BBB", "2020-01-02", { C: 10, D: 4 }, 4, 3),
      ],
      "C",
    )
    assert.equal(tied.eligible, false)
    const pick = pickDayTopThird(
      [
        row("AAA", "2020-02-01", { C: 20, D: 8 }, 12, 3),
        row("BBB", "2020-02-01", { C: 10, D: 4 }, 4, 5),
        row("CCC", "2020-02-01", { C: 5, D: 2 }, 2, 6),
      ],
      "C",
    )
    assert.equal(pick.eligible, true)
    assert.equal(pick.selected.length, 1)
    assert.equal(pick.selected[0].symbol, "AAA")

    const incomplete = sameDaySelectionGaps(
      [
        row("AAA", "2020-03-01", { C: 20, D: 8 }, null, null),
        row("BBB", "2020-03-01", { C: 5, D: 2 }, 3, 4),
        row("CCC", "2020-03-01", { C: 1, D: 0 }, 1, 5),
      ],
      "C",
    )
    assert.equal(incomplete.horizons["60"].usableGroups, 0)

    const gaps = sameDaySelectionGaps(
      Array.from({ length: 36 }, (_, index) => {
        const date = `2021-02-${String((index % 28) + 1).padStart(2, "0")}`
        const month = String(Math.floor(index / 28) + 2).padStart(2, "0")
        const day = String((index % 28) + 1).padStart(2, "0")
        const signalDate = `2021-${month}-${day}`
        return [
          row(`A${index}`, signalDate, { C: 20, D: 10 }, 10, 3),
          row(`B${index}`, signalDate, { C: 8, D: 4 }, 4, 5),
          row(`C${index}`, signalDate, { C: 2, D: 2 }, 1, 6),
        ]
      }).flat(),
      "C",
    )
    assert.equal(gaps.horizons["60"].usableGroups >= 30, true)
    assert.equal(gaps.horizons["60"].bootstrapVsMatched.status, "ok")
  })

  it("analyzes frozen v1 without rewriting prior JSON and keeps train/val dates intact", () => {
    const paths = [1, 2, 3, 4, 5].map((n) => join(dataDir, `dbb-chart-quality-v${n}.json`))
    const before = paths.map(hash)
    const v1 = JSON.parse(readFileSync(paths[0], "utf8"))
    const report = analyzeSelectionEffect(v1)
    assert.equal(report.counts.signals, 1380)
    assert.equal(report.split.trainEndDate, "2023-10-03")
    assert.equal(report.split.validationStartDate, "2023-10-05")
    assert.equal(report.baseline.n, 1380)
    assert.equal(report.c.pooled.selectedN > 0, true)
    assert.equal(report.d.pooled.selectedN > 0, true)
    assert.equal(report.c.pooled.selectedN < report.baseline.n, true)
    assert.equal(VERDICT_RULE.levels.includes(report.c.judgment.verdict), true)
    assert.equal(VERDICT_RULE.levels.includes(report.d.judgment.verdict), true)
    const verdictText = JSON.stringify({
      c: report.c.judgment.verdict,
      d: report.d.judgment.verdict,
      overall: report.tableE.overall.verdict,
    })
    assert.equal(verdictText.includes("실전 유효"), false)
    assert.equal(VERDICT_RULE.levels.includes(report.tableE.overall.verdict), true)

    const trainDates = new Set(
      v1.rows.filter((row) => row.signalDate <= v1.split.trainEndDate).map((row) => row.signalDate),
    )
    const valDates = new Set(
      v1.rows.filter((row) => row.signalDate >= v1.split.validationStartDate).map((row) => row.signalDate),
    )
    for (const date of trainDates) assert.equal(valDates.has(date), false)

    const saved = JSON.parse(readFileSync(join(dataDir, "dbb-chart-quality-v6.json"), "utf8"))
    assert.equal(saved.counts.signals, 1380)
    assert.equal(saved.c.judgment.verdict, report.c.judgment.verdict)

    assert.deepEqual(paths.map(hash), before)
  })

  it("wires the route and leaves v1~v5 screens and buy thresholds unchanged", () => {
    assert.match(read("vite-project/src/App.jsx"), /path="\/dbb-chart-quality-v6"/)
    assert.match(read("vite-project/src/utils/ydsUiLabels.js"), /선별 효과 비교/)
    for (const page of [
      "vite-project/src/pages/DbbChartQualityPage.jsx",
      "vite-project/src/pages/DbbChartQualityV2Page.jsx",
      "vite-project/src/pages/DbbChartQualityV3Page.jsx",
      "vite-project/src/pages/DbbChartQualityV4Page.jsx",
      "vite-project/src/pages/DbbChartQualityV5Page.jsx",
      "vite-project/src/content/dbbChartQualityV1.js",
      "vite-project/src/content/dbbChartQualityV5.js",
      "vite-project/src/pages/DailyBottomBuyPage.jsx",
      "vite-project/src/content/ydsTradeRecords.js",
    ]) {
      assert.equal(read(page).includes("dbbChartQualityV6"), false)
    }
    assert.equal(DAILY_BOTTOM_THRESHOLDS.rsiMax, 36)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.ma20DevMax, -4.2)
  })
})
