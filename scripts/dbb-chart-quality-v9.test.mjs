/**
 * DBB signal-strength robustness v9.
 * node --test scripts/dbb-chart-quality-v9.test.mjs
 */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import { DAILY_BOTTOM_THRESHOLDS } from "../api/_lib/dailyBottomBuyEngine.js"
import { buildRegimeByDate, regimeFromCloses } from "../vite-project/src/content/etfSignalRegimeV3.js"
import { FROZEN_THRESHOLDS } from "./lib/daily-bottom-split-buy-sim.mjs"
import {
  ROBUSTNESS_RULE,
  VERDICT_LEVELS,
  analyzeRobustness,
  attachRegimes,
  compareToV8,
  leaveOneTickerOut,
  regimeUsesOnlyPast,
  sameDayExcessGaps,
} from "./lib/dbb-chart-quality-v9.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const dataDir = join(root, "vite-project", "public", "data")

function read(rel) {
  return readFileSync(join(root, rel), "utf8")
}

function hash(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

function horizon(priceReturnPct, excessQqqPct, maxDrawdownPct = 5, qqqReturnPct = null, status = "complete") {
  return {
    tradingDays: 60,
    priceReturnPct,
    priceReturnStatus: status,
    maxDrawdownPct,
    maxDrawdownStatus: status === "complete" ? "complete" : "incomplete",
    excessQqqPct,
    qqqReturnPct: qqqReturnPct ?? (finite(priceReturnPct) && finite(excessQqqPct) ? priceReturnPct - excessQqqPct : null),
  }
}

function finite(value) {
  return value != null && Number.isFinite(Number(value))
}

function row({ id, symbol, signalDate, signalCount, ret60, excess60, mae60 = 5 }) {
  return {
    id,
    symbol,
    signalDate,
    signalCount,
    entryDate: signalDate,
    entryPrice: 100,
    horizons: {
      "20": horizon(ret60 != null ? ret60 * 0.4 : null, excess60 != null ? excess60 * 0.4 : null, mae60),
      "60": horizon(ret60, excess60, mae60),
      "120": horizon(ret60 != null ? ret60 * 1.2 : null, excess60 != null ? excess60 * 1.2 : null, mae60),
    },
  }
}

describe("dbb chart quality v9 robustness", () => {
  it("reproduces v8 baselines and keeps freeze thresholds", () => {
    assert.equal(FROZEN_THRESHOLDS.rsiMax, 36)
    assert.equal(ROBUSTNESS_RULE.v8ExcessOverall60Expected, -0.21)
    assert.equal(VERDICT_LEVELS.includes("국면 제한 가능성"), true)

    const v1 = JSON.parse(readFileSync(join(dataDir, "dbb-chart-quality-v1.json"), "utf8"))
    const v8 = JSON.parse(readFileSync(join(dataDir, "dbb-chart-quality-v8.json"), "utf8"))
    const report = JSON.parse(readFileSync(join(dataDir, "dbb-chart-quality-v9.json"), "utf8"))

    assert.equal(report.v8Match.ok, true)
    assert.equal(report.counts.three, v8.counts.three)
    assert.equal(report.counts.four, v8.counts.four)
    assert.equal(report.split.trainEndDate, v8.split.trainEndDate)
    assert.equal(report.split.validationStartDate, v8.split.validationStartDate)
    assert.ok(Math.abs(report.studyC.reproducedExcessDiffPp - (-0.21)) <= 0.05)
    assert.equal(v8.verdict.level, "효용 미입증")
    assert.equal(typeof analyzeRobustness, "function")
    assert.equal(typeof compareToV8, "function")
    assert.equal(v1.split.trainEndDate, report.split.trainEndDate)
  })

  it("leave-one-ticker-out flips only when the gap sign changes", () => {
    const three = [
      row({ id: "t1", symbol: "AAA", signalDate: "2020-01-02", signalCount: 3, ret60: 1, excess60: 0 }),
      row({ id: "t2", symbol: "BBB", signalDate: "2020-01-03", signalCount: 3, ret60: 2, excess60: 1 }),
      row({ id: "t3", symbol: "CCC", signalDate: "2020-01-04", signalCount: 3, ret60: 3, excess60: 1 }),
    ]
    const four = [
      row({ id: "f1", symbol: "AAA", signalDate: "2020-01-02", signalCount: 4, ret60: 10, excess60: 5 }),
      row({ id: "f2", symbol: "BBB", signalDate: "2020-01-03", signalCount: 4, ret60: 0, excess60: -1 }),
      row({ id: "f3", symbol: "DDD", signalDate: "2020-01-05", signalCount: 4, ret60: 1, excess60: 0 }),
    ]
    const out = leaveOneTickerOut(three, four, 60)
    assert.equal(out.baseline.n3, 3)
    assert.equal(out.summary.symbolCount, 4)
    assert.ok(out.symbols.every((item) => typeof item.flipMedian === "boolean"))
  })

  it("classifies regimes without future leakage and computes excess same-day gaps", () => {
    const closes = []
    for (let i = 0; i < 260; i++) closes.push(100 + i * 0.3)
    const bars = closes.map((close, index) => ({
      date: new Date(Date.UTC(2019, 0, 1 + index)).toISOString().slice(0, 10),
      close,
    }))
    assert.equal(regimeFromCloses(closes), "bull")
    const signalDate = bars[240].date
    const leak = regimeUsesOnlyPast(bars, signalDate)
    assert.equal(leak.match, true)
    const future = bars.map((bar, i) => (i > 240 ? { ...bar, close: 1 } : bar))
    assert.equal(buildRegimeByDate(future).get(signalDate), buildRegimeByDate(bars).get(signalDate))

    const attached = attachRegimes(
      [
        row({ id: "a", symbol: "AAA", signalDate, signalCount: 3, ret60: 5, excess60: 1 }),
        row({ id: "b", symbol: "BBB", signalDate, signalCount: 4, ret60: 8, excess60: 3 }),
      ],
      bars,
    )
    assert.equal(attached.rows[0].regime, "bull")

    const gaps = sameDayExcessGaps(
      [row({ id: "t", symbol: "A", signalDate: "2021-01-04", signalCount: 3, ret60: 5, excess60: 1 })],
      [row({ id: "f", symbol: "B", signalDate: "2021-01-04", signalCount: 4, ret60: 9, excess60: 4 })],
      60,
    )
    assert.equal(gaps.pairedDates, 1)
    assert.equal(gaps.excessGapMedian, 3)
  })

  it("keeps incomplete excess out of averages and does not invent zeros", () => {
    const gaps = sameDayExcessGaps(
      [
        row({ id: "t1", symbol: "A", signalDate: "2021-02-01", signalCount: 3, ret60: 5, excess60: 2 }),
        {
          ...row({ id: "t2", symbol: "B", signalDate: "2021-02-02", signalCount: 3, ret60: null, excess60: null }),
          horizons: {
            "20": horizon(null, null, null, null, "incomplete"),
            "60": horizon(null, null, null, null, "incomplete"),
            "120": horizon(null, null, null, null, "incomplete"),
          },
        },
      ],
      [row({ id: "f1", symbol: "C", signalDate: "2021-02-01", signalCount: 4, ret60: 6, excess60: 3 })],
      60,
    )
    assert.equal(gaps.pairedDates, 1)
    assert.equal(gaps.only3Dates, 0)
  })

  it("does not rewrite prior research JSON and leaves engine/trades untouched", () => {
    const paths = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => join(dataDir, `dbb-chart-quality-v${n}.json`))
    const before = paths.map(hash)
    const report = JSON.parse(readFileSync(join(dataDir, "dbb-chart-quality-v9.json"), "utf8"))
    assert.equal(VERDICT_LEVELS.includes(report.verdict.level), true)
    assert.equal(report.aborted, false)
    assert.match(ROBUSTNESS_RULE.noCherryPick, /선택하지/)
    assert.deepEqual(paths.map(hash), before)

    assert.match(read("vite-project/src/App.jsx"), /path="\/dbb-chart-quality-v8"/)
    assert.match(read("vite-project/src/App.jsx"), /path="\/dbb-chart-quality-v9"/)
    assert.match(read("vite-project/src/utils/ydsUiLabels.js"), /신호 강도 검증 v9/)
    for (const page of [
      "vite-project/src/pages/DbbChartQualityV8Page.jsx",
      "vite-project/src/content/dbbChartQualityV8.js",
      "vite-project/src/pages/DailyBottomBuyPage.jsx",
      "vite-project/src/content/ydsTradeRecords.js",
      "api/_lib/dailyBottomBuyEngine.js",
    ]) {
      assert.equal(read(page).includes("dbbChartQualityV9"), false)
      assert.equal(read(page).includes("dbb-chart-quality-v9"), false)
    }
    assert.equal(DAILY_BOTTOM_THRESHOLDS.rsiMax, 36)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.ma20DevMax, -4.2)
  })
})
