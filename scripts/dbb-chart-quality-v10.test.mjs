/**
 * DBB signal vs matched non-signal control v10.
 * node --test scripts/dbb-chart-quality-v10.test.mjs
 */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import { DAILY_BOTTOM_THRESHOLDS } from "../api/_lib/dailyBottomBuyEngine.js"
import { buildRegimeByDate } from "../vite-project/src/content/etfSignalRegimeV3.js"
import { FROZEN_THRESHOLDS } from "./lib/daily-bottom-split-buy-sim.mjs"
import { enrichBarsWithIndicators } from "./lib/daily-bottom-indicators.mjs"
import {
  MATCH_RULE,
  VERDICT_LEVELS,
  analyzeSignalVsControl,
  featureAt,
  matchDistance,
  matchPairs,
  qqqRetThrough,
  sameDayPairedGaps,
} from "./lib/dbb-chart-quality-v10.mjs"

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
    open: spec.o ?? spec.c,
    high: spec.h ?? spec.c,
    low: spec.l ?? spec.c,
    close: spec.c,
    volume: 1_000_000,
  }))
}

describe("dbb chart quality v10 signal vs control", () => {
  it("freezes match rules before outcomes and keeps thresholds", () => {
    assert.equal(FROZEN_THRESHOLDS.rsiMax, 36)
    assert.equal(MATCH_RULE.calipers.dd20MaxAbsPp, 5)
    assert.equal(MATCH_RULE.exclusionTradingDays, 5)
    assert.match(MATCH_RULE.noOutcomeInMatch, /미래/)
    assert.match(MATCH_RULE.noCherryPick, /골라/)
    assert.equal(VERDICT_LEVELS.includes("효용 가능성"), true)
  })

  it("builds features without future bars and enforces calipers", () => {
    const specs = []
    for (let i = 0; i < 40; i++) specs.push({ c: 100 - i * 0.2, h: 101 - i * 0.2, l: 99 - i * 0.2 })
    const bars = barsFrom(specs)
    // fix dates sequentially beyond Jan
    for (let i = 0; i < bars.length; i++) {
      bars[i].date = new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10)
    }
    const enriched = enrichBarsWithIndicators(bars)
    const qqqByDate = new Map(bars.map((bar) => [bar.date, bar.close]))
    const regimeByDate = buildRegimeByDate(bars)
    const mid = 25
    const feat = featureAt(enriched, mid, qqqByDate, regimeByDate)
    assert.ok(feat)
    assert.equal(feat.date, bars[mid].date)

    const futurePoison = bars.map((bar, i) => (i > mid ? { ...bar, close: 1, high: 1, low: 1 } : bar))
    const enrichedPoison = enrichBarsWithIndicators(futurePoison)
    const featPoison = featureAt(enrichedPoison, mid, qqqByDate, regimeByDate)
    assert.equal(feat.dd20, featPoison.dd20)
    assert.equal(feat.vol20, featPoison.vol20)

    const scales = { dd20: 5, vol20: 1, qqqRet20: 3 }
    const near = matchDistance(feat, { ...feat, dd20: feat.dd20 + 1, vol20: feat.vol20, qqqRet20: feat.qqqRet20 }, scales)
    assert.ok(near != null && near > 0)
    const far = matchDistance(feat, { ...feat, dd20: feat.dd20 + 20 }, scales)
    assert.equal(far, null)
    assert.equal(matchDistance(feat, { ...feat, regime: "bull" === feat.regime ? "bear" : "bull" }, scales), null)
  })

  it("matches same symbol once and tracks unmatched without reusing controls", () => {
    const scales = { dd20: 1, vol20: 1, qqqRet20: 1 }
    const signals = [
      { symbol: "AAA", date: "2021-01-10", dd20: -8, vol20: 2, qqqRet20: 1, regime: "bull", signalCount: 3 },
      { symbol: "AAA", date: "2021-02-10", dd20: -7, vol20: 2.1, qqqRet20: 0.5, regime: "bull", signalCount: 4 },
    ]
    const controls = [
      { symbol: "AAA", date: "2021-01-05", dd20: -7.5, vol20: 2, qqqRet20: 0.8, regime: "bull", count: 1 },
      { symbol: "BBB", date: "2021-01-06", dd20: -7.5, vol20: 2, qqqRet20: 0.8, regime: "bull", count: 1 },
    ]
    const matched = matchPairs(signals, controls, scales)
    assert.equal(matched.pairs.length, 1)
    assert.equal(matched.pairs[0].controlDate, "2021-01-05")
    assert.equal(matched.unmatched.length, 1)
    assert.equal(matched.reusedControls, 0)
  })

  it("keeps incomplete pairs out of success denominators in date bootstrap input", () => {
    const pairs = [
      {
        signalDate: "2022-01-03",
        signalHorizons: { "60": { priceReturnStatus: "complete", priceReturnPct: 5 } },
        controlHorizons: { "60": { priceReturnStatus: "complete", priceReturnPct: 1 } },
      },
      {
        signalDate: "2022-01-04",
        signalHorizons: { "60": { priceReturnStatus: "incomplete", priceReturnPct: null } },
        controlHorizons: { "60": { priceReturnStatus: "complete", priceReturnPct: 2 } },
      },
    ]
    const gaps = sameDayPairedGaps(pairs, 60)
    assert.equal(gaps.pairedDates, 1)
    assert.equal(gaps.gapMedian, 4)
  })

  it("qqqRetThrough requires the end date to exist and ignores later map keys", () => {
    const map = new Map([
      ["2020-01-01", 100],
      ["2020-01-02", 101],
      ["2020-01-03", 102],
    ])
    // need 21 dates for 20-day return
    for (let i = 4; i <= 25; i++) map.set(`2020-01-${String(i).padStart(2, "0")}`, 100 + i)
    const end = "2020-01-25"
    const ret = qqqRetThrough(map, end, 20)
    assert.ok(Number.isFinite(ret))
    assert.equal(qqqRetThrough(map, "2020-01-10", 20), null)
  })

  it("loads frozen v10 report aligned with v1 split and does not rewrite v1~v9", () => {
    const paths = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => join(dataDir, `dbb-chart-quality-v${n}.json`))
    const before = paths.map(hash)
    const v1 = JSON.parse(readFileSync(paths[0], "utf8"))
    const report = JSON.parse(readFileSync(join(dataDir, "dbb-chart-quality-v10.json"), "utf8"))
    assert.equal(report.split.trainEndDate, v1.split.trainEndDate)
    assert.equal(report.split.validationStartDate, v1.split.validationStartDate)
    assert.equal(report.verification.ok, true)
    assert.ok(report.counts.matched > 0)
    assert.equal(VERDICT_LEVELS.includes(report.verdict.level), true)
    assert.equal(typeof analyzeSignalVsControl, "function")
    assert.deepEqual(paths.map(hash), before)

    assert.match(read("vite-project/src/App.jsx"), /path="\/dbb-chart-quality-v10"/)
    assert.match(read("vite-project/src/utils/ydsUiLabels.js"), /신호일 vs 비신호일/)
    for (const page of [
      "vite-project/src/pages/DbbChartQualityV9Page.jsx",
      "vite-project/src/content/dbbChartQualityV9.js",
      "vite-project/src/pages/DailyBottomBuyPage.jsx",
      "vite-project/src/content/ydsTradeRecords.js",
      "api/_lib/dailyBottomBuyEngine.js",
    ]) {
      assert.equal(read(page).includes("dbbChartQualityV10"), false)
      assert.equal(read(page).includes("dbb-chart-quality-v10"), false)
    }
    assert.equal(DAILY_BOTTOM_THRESHOLDS.rsiMax, 36)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.ma20DevMax, -4.2)
  })
})
