/**
 * DBB v10 audit (v11).
 * node --test scripts/dbb-chart-quality-v11.test.mjs
 */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import { DAILY_BOTTOM_THRESHOLDS } from "../api/_lib/dailyBottomBuyEngine.js"
import { SAME_DAY_RULE } from "./lib/dbb-chart-quality-v2.mjs"
import {
  AUDIT_RULE,
  VERDICT_LEVELS,
  analyzeV10Audit,
  auditDateClusterBootstrap,
  blockBootstrapDateGaps,
  orderedDateGaps,
} from "./lib/dbb-chart-quality-v11.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const dataDir = join(root, "vite-project", "public", "data")

function read(rel) {
  return readFileSync(join(root, rel), "utf8")
}

function hash(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

describe("dbb chart quality v11 audit", () => {
  it("freezes audit rules and pre-specified block lengths", () => {
    assert.equal(AUDIT_RULE.blockBootstrap.primaryBlockDates, 60)
    assert.deepEqual(AUDIT_RULE.blockBootstrap.sensitivityBlockDates, [40, 90])
    assert.match(AUDIT_RULE.noRetune, /바꾸지/)
    assert.equal(VERDICT_LEVELS.includes("감사 통과, 효용 미입증 유지"), true)
    assert.equal(SAME_DAY_RULE.bootstrapReps, 1000)
    assert.equal(SAME_DAY_RULE.bootstrapSeed, 20261016)
  })

  it("reproduces frozen v10 core numbers without rewriting v1~v10", () => {
    const paths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => join(dataDir, `dbb-chart-quality-v${n}.json`))
    const before = paths.map(hash)
    const v10 = JSON.parse(readFileSync(paths[9], "utf8"))
    const report = JSON.parse(readFileSync(join(dataDir, "dbb-chart-quality-v11.json"), "utf8"))

    assert.equal(report.reproduce.ok, true)
    assert.equal(report.counts.signalsAttempted, 1379)
    assert.equal(report.counts.matched, 1243)
    assert.equal(report.counts.unmatched, 136)
    assert.equal(report.counts.trainMatched, 872)
    assert.equal(report.counts.validationMatched, 371)
    assert.equal(v10.tables["60"].sameDay.gapMedian, 1.37)
    assert.equal(report.core.overall.sameDay.gapMedian, 1.37)
    assert.equal(report.core.overall.sameDay.bootstrap.lo, -0.23)
    assert.equal(report.core.overall.sameDay.bootstrap.hi, 3)
    assert.equal(report.core.validation.returnMedian, 5.36)
    assert.equal(report.core.validation.sameDay.bootstrap.lo, -0.72)
    assert.equal(report.core.validation.sameDay.bootstrap.hi, 6.55)
    assert.equal(report.balance.matchesReported, true)
    assert.deepEqual(paths.map(hash), before)
  })

  it("separates matched vs unmatched and keeps incomplete out of gaps", () => {
    const report = JSON.parse(readFileSync(join(dataDir, "dbb-chart-quality-v11.json"), "utf8"))
    assert.equal(report.matchingBias.matchedN, 1243)
    assert.equal(report.matchingBias.unmatchedN, 136)
    assert.ok(report.matchingBias.reasons.no_caliper_match >= 1)
    assert.match(report.matchingBias.postHocOutcomes.warning, /사후/)
    assert.equal(report.independence.duplicateControls, 0)
    assert.equal(report.bootstrap.trainValDateOverlap, 0)
  })

  it("preserves pair and same-day structure in date-cluster bootstrap", () => {
    const pairs = [
      {
        signalDate: "2022-01-03",
        symbol: "AAA",
        signalHorizons: { "60": { priceReturnStatus: "complete", priceReturnPct: 5 } },
        controlHorizons: { "60": { priceReturnStatus: "complete", priceReturnPct: 1 } },
      },
      {
        signalDate: "2022-01-03",
        symbol: "BBB",
        signalHorizons: { "60": { priceReturnStatus: "complete", priceReturnPct: 7 } },
        controlHorizons: { "60": { priceReturnStatus: "complete", priceReturnPct: 2 } },
      },
      {
        signalDate: "2022-01-04",
        symbol: "AAA",
        signalHorizons: { "60": { priceReturnStatus: "incomplete", priceReturnPct: null } },
        controlHorizons: { "60": { priceReturnStatus: "complete", priceReturnPct: 3 } },
      },
    ]
    const ordered = orderedDateGaps(pairs, 60)
    assert.equal(ordered.length, 1)
    assert.equal(ordered[0].gap, 4.5)
    const audit = auditDateClusterBootstrap(pairs, 60)
    assert.equal(audit.unit.includes("signalDate"), true)
    assert.equal(audit.pairDiffPreserved, true)
    assert.equal(audit.maxPairsPerSignalDate, 2)
  })

  it("uses contiguous circular blocks and is seed-reproducible", () => {
    const ordered = []
    for (let i = 0; i < 80; i++) {
      ordered.push({ date: `2020-${String((i % 12) + 1).padStart(2, "0")}-01`, gap: (i % 7) - 3 })
    }
    const a = blockBootstrapDateGaps(ordered, 60, 200, 42)
    const b = blockBootstrapDateGaps(ordered, 60, 200, 42)
    assert.equal(a.status, "ok")
    assert.equal(a.lo, b.lo)
    assert.equal(a.hi, b.hi)
    assert.equal(a.blockLen, 60)
    const short = blockBootstrapDateGaps(ordered.slice(0, 10), 60)
    assert.equal(short.status, "표본 부족")
  })

  it("wires route and leaves engine/trades and prior research pages untouched", () => {
    assert.equal(typeof analyzeV10Audit, "function")
    const report = JSON.parse(readFileSync(join(dataDir, "dbb-chart-quality-v11.json"), "utf8"))
    assert.equal(VERDICT_LEVELS.includes(report.verdict.level), true)
    assert.match(read("vite-project/src/App.jsx"), /path="\/dbb-chart-quality-v11"/)
    assert.match(read("vite-project/src/utils/ydsUiLabels.js"), /v10 매칭 감사/)
    for (const page of [
      "vite-project/src/pages/DbbChartQualityV10Page.jsx",
      "vite-project/src/content/dbbChartQualityV10.js",
      "vite-project/src/pages/DailyBottomBuyPage.jsx",
      "vite-project/src/content/ydsTradeRecords.js",
      "api/_lib/dailyBottomBuyEngine.js",
    ]) {
      assert.equal(read(page).includes("dbbChartQualityV11"), false)
      assert.equal(read(page).includes("dbb-chart-quality-v11"), false)
    }
    assert.equal(DAILY_BOTTOM_THRESHOLDS.rsiMax, 36)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.ma20DevMax, -4.2)
  })
})
