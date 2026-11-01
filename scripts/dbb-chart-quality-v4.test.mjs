/**
 * DBB chart quality C/E risk validation v4.
 * node --test scripts/dbb-chart-quality-v4.test.mjs
 */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import { DAILY_BOTTOM_THRESHOLDS } from "../api/_lib/dailyBottomBuyEngine.js"
import { scoreChartAtSignal } from "./lib/dbb-chart-quality-v1.mjs"
import { enrichRowsWithPartDetails } from "./lib/dbb-chart-quality-v3.mjs"
import {
  RISK_RULE,
  analyzeRelativeBounceRisk,
  outcomeSummary,
  sameDayComponentMulti,
  spearmanTied,
} from "./lib/dbb-chart-quality-v4.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

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

function row(symbol, date, cScore, eScore, ret60, dd60) {
  return {
    id: `${symbol}:${date}`,
    symbol,
    signalDate: date,
    sectorBenchmark: "SMH",
    parts: { C: cScore, E: eScore },
    partDetails: {
      C: { score: cScore, detail: { excessQqq60: cScore - 10 } },
      E: { score: eScore, detail: { ret3: eScore, recovered: eScore * 10 } },
    },
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

describe("dbb chart quality v4 C/E risk", () => {
  it("keeps risk rules fixed and blocks future bars from C/E scores", () => {
    assert.equal(RISK_RULE.smallSample, 30)
    assert.match(RISK_RULE.risk, /합치지/)
    assert.match(RISK_RULE.correlation, /동점/)
    const tied = Array.from({ length: 100 }, (_, index) => ({ x: index < 98 ? 0 : 1, y: index }))
    const rho = spearmanTied(tied)
    assert.equal(Math.abs(rho.rho) < 0.3, true)
    const bars = risingBars(260)
    const qqq = new Map(bars.map((bar) => [bar.date, bar.close]))
    const score = scoreChartAtSignal(bars, 240, { qqqByDate: qqq })
    const mutated = bars.map((bar, index) => (index > 240 ? { ...bar, close: 1, high: 1, low: 1 } : bar))
    const again = scoreChartAtSignal(mutated, 240, { qqqByDate: qqq })
    assert.equal(again.parts.C.score, score.parts.C.score)
    assert.equal(again.parts.E.score, score.parts.E.score)
  })

  it("keeps incomplete returns null and handles E discrete ties on the same day", () => {
    const empty = outcomeSummary([])
    assert.equal(empty.priceMedian, null)
    assert.equal(empty.positiveRate, null)
    const incomplete = sameDayComponentMulti(
      [
        row("AAA", "2020-01-02", 20, 7, null, null),
        row("BBB", "2020-01-02", 10, 3, 5, 2),
      ],
      "C",
    )
    assert.equal(incomplete.horizons["60"].usableGroups, 0)
    assert.equal(incomplete.horizons["60"].gapMedian, null)
    const tiedE = sameDayComponentMulti(
      [
        row("AAA", "2020-02-01", 12, 7, 10, 4),
        row("BBB", "2020-02-01", 8, 7, 2, 5),
        row("CCC", "2020-02-01", 5, 3, 1, 6),
      ],
      "E",
    )
    assert.equal(tiedE.horizons["60"].usableGroups, 1)
    assert.equal(tiedE.horizons["60"].gapMedian, 5)
  })

  it("summarizes return and drawdown gaps with bootstrap metadata", () => {
    const rows = Array.from({ length: 40 }, (_, index) => {
      const month = String(Math.floor(index / 28) + 1).padStart(2, "0")
      const day = String((index % 28) + 1).padStart(2, "0")
      const date = `2021-${month}-${day}`
      return [
        row(`A${index}`, date, 20, 7, 8 + (index % 3), 3),
        row(`B${index}`, date, 5, 1, 2, 6),
      ]
    }).flat()
    const sameDay = sameDayComponentMulti(rows, "C")
    assert.equal(sameDay.horizons["60"].usableGroups >= 30, true)
    assert.equal(sameDay.horizons["60"].bootstrapReturn.status, "ok")
    assert.equal(finite(sameDay.horizons["60"].bootstrapReturn.lo), true)
    assert.equal(finite(sameDay.horizons["60"].bootstrapDrawdown.hi), true)
  })

  it("matches recomputed C/E scores to frozen v1 without rewriting prior JSON", () => {
    const v1Path = join(root, "vite-project/public/data/dbb-chart-quality-v1.json")
    const v2Path = join(root, "vite-project/public/data/dbb-chart-quality-v2.json")
    const v3Path = join(root, "vite-project/public/data/dbb-chart-quality-v3.json")
    const before = [v1Path, v2Path, v3Path].map(hash)
    const v1 = JSON.parse(readFileSync(v1Path, "utf8"))
    const sample = v1.rows.filter((row) => row.parts?.C != null || row.parts?.E != null).slice(0, 50)
    const series = {}
    const benches = { QQQ: JSON.parse(read("scripts/.cache/dbb-qqq-daily-ohlcv.json")).bars }
    for (const row of sample) {
      if (!series[row.symbol]) series[row.symbol] = JSON.parse(read(`scripts/.cache/eq-ohlcv/${row.symbol}.json`)).bars
      if (row.sectorBenchmark && !benches[row.sectorBenchmark]) {
        const p = `scripts/.cache/dbb-${row.sectorBenchmark.toLowerCase()}-daily-ohlcv.json`
        if (existsSync(join(root, p))) benches[row.sectorBenchmark] = JSON.parse(read(p)).bars
      }
    }
    const enriched = enrichRowsWithPartDetails(sample, series, benches)
    assert.equal(enriched.verification.mismatched, 0)
    const report = JSON.parse(read("vite-project/public/data/dbb-chart-quality-v4.json"))
    assert.equal(report.verification.ok, true)
    assert.equal(report.counts.signals, 1380)
    assert.equal(report.c.available >= 1300, true)
    assert.equal(report.e.available, 1380)
    assert.equal(v1.split.trainEndDate < v1.split.validationStartDate, true)
    assert.equal(typeof analyzeRelativeBounceRisk, "function")
    assert.deepEqual([v1Path, v2Path, v3Path].map(hash), before)
  })

  it("does not change v1~v3 screens, buy thresholds, or trade records", () => {
    for (const page of [
      "vite-project/src/pages/DbbChartQualityPage.jsx",
      "vite-project/src/pages/DbbChartQualityV2Page.jsx",
      "vite-project/src/pages/DbbChartQualityV3Page.jsx",
      "vite-project/src/content/dbbChartQualityV1.js",
      "vite-project/src/content/dbbChartQualityV2.js",
      "vite-project/src/content/dbbChartQualityV3.js",
      "vite-project/src/pages/DailyBottomBuyPage.jsx",
      "vite-project/src/content/ydsTradeRecords.js",
    ]) {
      assert.equal(read(page).includes("dbbChartQualityV4"), false)
    }
    assert.match(read("vite-project/src/App.jsx"), /path="\/dbb-chart-quality-v4"/)
    assert.match(read("vite-project/src/utils/ydsUiLabels.js"), /상대강도·반등 위험 검증/)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.rsiMax, 36)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.ma20DevMax, -4.2)
  })
})

function finite(value) {
  return value != null && Number.isFinite(Number(value))
}
