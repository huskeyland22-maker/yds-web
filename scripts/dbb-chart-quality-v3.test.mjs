/**
 * DBB chart quality component validity v3.
 * node --test scripts/dbb-chart-quality-v3.test.mjs
 */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import { DAILY_BOTTOM_THRESHOLDS } from "../api/_lib/dailyBottomBuyEngine.js"
import { scoreChartAtSignal } from "./lib/dbb-chart-quality-v1.mjs"
import {
  COMPONENT_RULE,
  COMPONENTS,
  analyzeComponentValidity,
  enrichRowsWithPartDetails,
  sameDayComponentGaps,
  spearman,
  tertileBands,
} from "./lib/dbb-chart-quality-v3.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const v1Path = join(root, "vite-project/public/data/dbb-chart-quality-v1.json")
const v2Path = join(root, "vite-project/public/data/dbb-chart-quality-v2.json")

function read(rel) {
  return readFileSync(join(root, rel), "utf8")
}

function risingBars(n = 260, start = 100) {
  return Array.from({ length: n }, (_, index) => {
    const close = start + index * 0.35
    return {
      date: new Date(Date.UTC(2018, 0, 1 + index)).toISOString().slice(0, 10),
      open: close - 0.1,
      high: close + 0.6,
      low: close - 0.6,
      close,
      volume: 1_000_000 + (index % 7) * 20_000,
    }
  })
}

function row(symbol, date, parts, ret60 = 5, dd60 = 3) {
  return {
    id: `${symbol}:${date}`,
    symbol,
    signalDate: date,
    sectorBenchmark: "SMH",
    parts,
    partStatus: Object.fromEntries(Object.keys(parts).map((key) => [key, parts[key] == null ? "unavailable" : "complete"])),
    horizons: {
      60: {
        priceReturnStatus: ret60 == null ? "incomplete" : "complete",
        priceReturnPct: ret60,
        maxDrawdownStatus: dd60 == null ? "incomplete" : "complete",
        maxDrawdownPct: dd60,
        excessQqqPct: ret60 == null ? null : ret60 - 1,
        excessSectorPct: ret60 == null ? null : ret60 - 2,
      },
    },
  }
}

describe("dbb chart quality v3 components", () => {
  it("keeps the analysis methods fixed and ignores future bars in scores", () => {
    assert.equal(COMPONENT_RULE.smallSample, 30)
    assert.equal(COMPONENTS.join(""), "ABCDE")
    const bars = risingBars(260)
    const score = scoreChartAtSignal(bars, 240, { qqqByDate: new Map(bars.map((bar) => [bar.date, bar.close])) })
    const mutated = bars.map((bar, index) => (index > 240 ? { ...bar, close: 1, high: 1, low: 1, volume: 1 } : bar))
    const again = scoreChartAtSignal(mutated, 240, { qqqByDate: new Map(bars.map((bar) => [bar.date, bar.close])) })
    assert.equal(again.parts.A.score, score.parts.A.score)
    assert.equal(again.parts.B.score, score.parts.B.score)
    assert.equal(again.parts.E.score, score.parts.E.score)
  })

  it("treats missing part scores as missing and keeps incomplete returns out of gaps", () => {
    const rows = [
      {
        ...row("AAA", "2020-01-02", { A: 20, B: 10, C: 8, D: 4, E: 3 }, null, null),
        partDetails: { A: { score: 20 }, B: { score: 10 }, C: { score: 8 }, D: { score: 4 }, E: { score: 3 } },
      },
      {
        ...row("BBB", "2020-01-02", { A: 10, B: 10, C: 5, D: 2, E: 1 }, 4, 2),
        partDetails: { A: { score: 10 }, B: { score: 10 }, C: { score: 5 }, D: { score: 2 }, E: { score: 1 } },
      },
      {
        ...row("CCC", "2020-01-03", { A: null, B: 12, C: 4, D: 2, E: 0 }, 8, 3),
        partDetails: { A: { score: null }, B: { score: 12 }, C: { score: 4 }, D: { score: 2 }, E: { score: 0 } },
      },
    ]
    const gaps = sameDayComponentGaps(rows, "A")
    assert.equal(gaps.usableGroups, 0)
    assert.equal(gaps.gapMedian, null)
    const bands = tertileBands(rows.filter((item) => item.parts.B != null), "B")
    assert.equal(Array.isArray(bands.top), true)
    const corr = spearman([
      { x: 1, y: 10 },
      { x: 2, y: 20 },
      { x: 3, y: 30 },
      { x: 4, y: 40 },
      { x: 5, y: 50 },
    ])
    assert.equal(corr.rho, 1)
    assert.equal(spearman([{ x: 1, y: 1 }]).status, "표본 부족")
  })

  it("keeps same-day ties together and respects v1 train/validation dates", () => {
    const rows = [
      {
        ...row("AAA", "2020-01-02", { A: 25 }, 12, 4),
        partDetails: { A: { score: 25, detail: { vs200: 1 } } },
      },
      {
        ...row("BBB", "2020-01-02", { A: 25 }, 2, 5),
        partDetails: { A: { score: 25, detail: { vs200: 1 } } },
      },
      {
        ...row("CCC", "2020-01-02", { A: 10 }, 1, 6),
        partDetails: { A: { score: 10, detail: { vs200: -2 } } },
      },
    ]
    const gaps = sameDayComponentGaps(rows, "A")
    assert.equal(gaps.usableGroups, 1)
    assert.equal(gaps.gapMedian, 6)
    const v1 = JSON.parse(readFileSync(v1Path, "utf8"))
    assert.equal(v1.split.trainEndDate < v1.split.validationStartDate, true)
  })

  it("recomputes part details to match frozen v1 scores without rewriting v1 or v2", () => {
    const beforeV1 = createHash("sha256").update(readFileSync(v1Path)).digest("hex")
    const beforeV2 = createHash("sha256").update(readFileSync(v2Path)).digest("hex")
    const v1 = JSON.parse(readFileSync(v1Path, "utf8"))
    const sample = v1.rows.slice(0, 40)
    const series = {}
    const benches = {}
    for (const row of sample) {
      if (!series[row.symbol]) {
        series[row.symbol] = JSON.parse(read(`scripts/.cache/eq-ohlcv/${row.symbol}.json`)).bars
      }
      const sector = row.sectorBenchmark
      if (sector && !benches[sector]) {
        const path = existsSync(join(root, `scripts/.cache/dbb-${sector.toLowerCase()}-daily-ohlcv.json`))
          ? `scripts/.cache/dbb-${sector.toLowerCase()}-daily-ohlcv.json`
          : null
        if (path) benches[sector] = JSON.parse(read(path)).bars
      }
    }
    benches.QQQ = JSON.parse(read("scripts/.cache/dbb-qqq-daily-ohlcv.json")).bars
    const enriched = enrichRowsWithPartDetails(sample, series, benches)
    assert.equal(enriched.verification.mismatched, 0)
    assert.equal(enriched.verification.matched, sample.length)
    const report = JSON.parse(read("vite-project/public/data/dbb-chart-quality-v3.json"))
    assert.equal(report.verification.ok, true)
    assert.equal(report.counts.signals, 1380)
    assert.equal(report.tableA.length, 5)
    assert.equal(report.tableB.length, 5)
    assert.equal(report.tableC.length, 5)
    assert.equal(createHash("sha256").update(readFileSync(v1Path)).digest("hex"), beforeV1)
    assert.equal(createHash("sha256").update(readFileSync(v2Path)).digest("hex"), beforeV2)
    assert.equal(typeof analyzeComponentValidity, "function")
  })

  it("does not change v1/v2 screens, buy thresholds, or trade records", () => {
    for (const page of [
      "vite-project/src/pages/DbbChartQualityPage.jsx",
      "vite-project/src/pages/DbbChartQualityV2Page.jsx",
      "vite-project/src/content/dbbChartQualityV1.js",
      "vite-project/src/content/dbbChartQualityV2.js",
      "vite-project/src/pages/DailyBottomBuyPage.jsx",
      "vite-project/src/content/ydsTradeRecords.js",
    ]) {
      assert.equal(read(page).includes("dbbChartQualityV3"), false)
    }
    assert.match(read("vite-project/src/App.jsx"), /path="\/dbb-chart-quality-v3"/)
    assert.match(read("vite-project/src/utils/ydsUiLabels.js"), /항목별 유효성/)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.rsiMax, 36)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.ma20DevMax, -4.2)
  })
})
