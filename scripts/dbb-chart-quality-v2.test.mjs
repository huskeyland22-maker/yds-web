/**
 * DBB chart quality same-day comparison v2.
 * node --test scripts/dbb-chart-quality-v2.test.mjs
 */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import { DAILY_BOTTOM_THRESHOLDS } from "../api/_lib/dailyBottomBuyEngine.js"
import {
  SAME_DAY_RULE,
  analyzeSameDayComparison,
  buildSameDayGroups,
  isScoredRow,
  pickScoreQuartileBands,
  pickTopTied,
  rankByScore,
} from "./lib/dbb-chart-quality-v2.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const v1Path = join(root, "vite-project/public/data/dbb-chart-quality-v1.json")

function read(rel) {
  return readFileSync(join(root, rel), "utf8")
}

function row(symbol, date, score, ret60 = null, dd60 = null) {
  return {
    id: `${symbol}:${date}`,
    symbol,
    name: symbol,
    signalDate: date,
    totalScore: score,
    totalStatus: score == null ? "unavailable" : "complete",
    sectorBenchmark: symbol === "FCX" ? null : "SMH",
    entryDate: date,
    entryPrice: 10,
    horizons: {
      20: { priceReturnStatus: "incomplete", priceReturnPct: null, maxDrawdownStatus: "incomplete", maxDrawdownPct: null },
      60: {
        priceReturnStatus: ret60 == null ? "incomplete" : "complete",
        priceReturnPct: ret60,
        maxDrawdownStatus: dd60 == null ? "incomplete" : "complete",
        maxDrawdownPct: dd60,
      },
      120: { priceReturnStatus: "incomplete", priceReturnPct: null, maxDrawdownStatus: "incomplete", maxDrawdownPct: null },
    },
  }
}

describe("dbb chart quality v2 same-day", () => {
  it("keeps the comparison rules fixed and does not break score ties by ticker", () => {
    assert.equal(SAME_DAY_RULE.minScoredForCompare, 2)
    assert.equal(SAME_DAY_RULE.minScoredForQuartile, 4)
    assert.equal(SAME_DAY_RULE.smallSampleGroups, 30)
    assert.equal(SAME_DAY_RULE.bootstrapReps, 1000)
    const tied = pickTopTied([
      row("BBB", "2020-01-02", 50, 1, 2),
      row("AAA", "2020-01-02", 50, 3, 2),
      row("CCC", "2020-01-02", 40, 8, 5),
    ])
    assert.deepEqual(tied.tops.map((item) => item.symbol).sort(), ["AAA", "BBB"])
    assert.equal(tied.rest.length, 1)
    const ranks = rankByScore(tied.tops.concat(tied.rest))
    assert.equal(ranks.ranks.get("AAA:2020-01-02"), 1)
    assert.equal(ranks.ranks.get("BBB:2020-01-02"), 1)
    assert.equal(ranks.ranks.get("CCC:2020-01-02"), 3)
  })

  it("groups only the same signal date and excludes single-score days", () => {
    const rows = [
      row("AAA", "2020-01-02", 40, 10, 5),
      row("BBB", "2020-01-02", 30, 4, 6),
      row("CCC", "2020-01-03", 55, 8, 3),
      row("DDD", "2020-01-04", null, 1, 1),
      row("EEE", "2020-01-04", 20, null, null),
    ]
    const groups = buildSameDayGroups(rows)
    assert.equal(groups.length, 3)
    assert.equal(groups.every((group) => group.members.every((member) => rows.find((item) => item.id === member.id).signalDate === group.signalDate)), true)
    const day2 = groups.find((group) => group.signalDate === "2020-01-02")
    assert.equal(day2.comparable, true)
    assert.equal(day2.topSymbols[0], "AAA")
    assert.equal(day2.topVsRest["60"].gapReturn, 6)
    assert.equal(day2.topVsRest["60"].usable, true)
    const day3 = groups.find((group) => group.signalDate === "2020-01-03")
    assert.equal(day3.comparable, false)
    const day4 = groups.find((group) => group.signalDate === "2020-01-04")
    assert.equal(day4.scoredCount, 1)
    assert.equal(day4.comparable, false)
    assert.equal(day4.topVsRest["60"].usable, false)
    assert.equal(isScoredRow(row("X", "2020-01-01", null)), false)
  })

  it("keeps incomplete returns out of gaps and handles all-score ties", () => {
    const incomplete = buildSameDayGroups([
      row("AAA", "2021-02-01", 60, null, null),
      row("BBB", "2021-02-01", 40, 5, 2),
    ])[0]
    assert.equal(incomplete.topVsRest["60"].usable, false)
    assert.equal(incomplete.topVsRest["60"].gapReturn, null)
    const tied = buildSameDayGroups([
      row("AAA", "2021-03-01", 70, 10, 3),
      row("BBB", "2021-03-01", 70, 2, 4),
    ])[0]
    assert.equal(tied.allTied, true)
    assert.equal(tied.topVsRest["60"].usable, false)
    const quartile = pickScoreQuartileBands([
      row("A", "2021-04-01", 80),
      row("B", "2021-04-01", 70),
      row("C", "2021-04-01", 60),
      row("D", "2021-04-01", 50),
    ])
    assert.equal(quartile.eligible, true)
    assert.equal(quartile.top.length >= 1, true)
    assert.equal(quartile.bottom.length >= 1, true)
  })

  it("analyzes frozen v1 rows without changing the v1 JSON bytes", () => {
    assert.equal(existsSync(v1Path), true)
    const before = createHash("sha256").update(readFileSync(v1Path)).digest("hex")
    const v1 = JSON.parse(readFileSync(v1Path, "utf8"))
    const report = analyzeSameDayComparison(v1)
    const after = createHash("sha256").update(readFileSync(v1Path)).digest("hex")
    assert.equal(before, after)
    assert.equal(report.counts.signals, 1380)
    assert.equal(report.counts.groups, 650)
    assert.equal(report.counts.comparableGroups + report.counts.nonComparableGroups, 650)
    assert.equal(report.overall.topVsRest["60"].usableGroups + report.overall.topVsRest["60"].missingOutcome, report.overall.topVsRest["60"].groups)
    assert.equal(report.train.topVsRest["60"].usableGroups + report.validation.topVsRest["60"].usableGroups <= report.overall.topVsRest["60"].usableGroups + 5, true)
    const v2 = JSON.parse(read("vite-project/public/data/dbb-chart-quality-v2.json"))
    assert.equal(v2.counts.comparableGroups, report.counts.comparableGroups)
  })

  it("does not change v1 screens, buy thresholds, or trade records", () => {
    assert.equal(read("vite-project/src/pages/DbbChartQualityPage.jsx").includes("dbbChartQualityV2"), false)
    assert.equal(read("vite-project/src/content/dbbChartQualityV1.js").includes("v2"), false)
    assert.equal(read("scripts/lib/dbb-chart-quality-v1.mjs").includes("SAME_DAY_RULE"), false)
    const pages = [
      "vite-project/src/pages/EtfSignalTrackPage.jsx",
      "vite-project/src/pages/DailyBottomBuyPage.jsx",
      "vite-project/src/content/ydsTradeRecords.js",
    ]
    for (const page of pages) assert.equal(read(page).includes("dbbChartQualityV2"), false)
    assert.match(read("vite-project/src/App.jsx"), /path="\/dbb-chart-quality-v2"/)
    assert.match(read("vite-project/src/utils/ydsUiLabels.js"), /동일 신호일 비교/)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.rsiMax, 36)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.ma20DevMax, -4.2)
  })
})
