/**
 * DBB chart quality final judgment v5.
 * node --test scripts/dbb-chart-quality-v5.test.mjs
 */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import { DAILY_BOTTOM_THRESHOLDS } from "../api/_lib/dailyBottomBuyEngine.js"
import {
  JUDGE_RULE,
  synthesizeChartQualityJudgment,
} from "./lib/dbb-chart-quality-v5.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const dataDir = join(root, "vite-project", "public", "data")

function readJson(name) {
  return JSON.parse(readFileSync(join(dataDir, name), "utf8"))
}

function read(rel) {
  return readFileSync(join(root, rel), "utf8")
}

function hash(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

describe("dbb chart quality v5 judgment", () => {
  it("uses only the three evidence levels and does not invent buy rules", () => {
    assert.deepEqual(JUDGE_RULE.levels, ["추가 검증", "판단 유보", "현재 근거 부족"])
    assert.match(JUDGE_RULE.levelNote, /단정 표현/)
    assert.match(JUDGE_RULE.purpose, /매수 규칙/)
  })

  it("matches frozen v1~v4 numbers and keeps missing values null", () => {
    const v1Path = join(dataDir, "dbb-chart-quality-v1.json")
    const v2Path = join(dataDir, "dbb-chart-quality-v2.json")
    const v3Path = join(dataDir, "dbb-chart-quality-v3.json")
    const v4Path = join(dataDir, "dbb-chart-quality-v4.json")
    const before = [v1Path, v2Path, v3Path, v4Path].map(hash)

    const v1 = readJson("dbb-chart-quality-v1.json")
    const v2 = readJson("dbb-chart-quality-v2.json")
    const v3 = readJson("dbb-chart-quality-v3.json")
    const v4 = readJson("dbb-chart-quality-v4.json")
    const report = synthesizeChartQualityJudgment({ v1, v2, v3, v4 })

    assert.equal(report.counts.signals, 1380)
    assert.equal(report.counts.components.C.available, 1361)
    assert.equal(report.counts.components.C.missing, 19)
    assert.equal(report.counts.components.E.available, 1380)
    assert.equal(report.counts.eZero, 1362)
    assert.equal(report.counts.eNonzero, 18)

    const c = report.judgments.C.citations
    assert.equal(c.topMedian60, 10.81)
    assert.equal(c.bottomMedian60, 8.47)
    assert.equal(c.sameDayUsable, 237)
    assert.equal(c.sameDayGap, -0.9)
    assert.equal(c.bootstrapLo, -3.74)
    assert.equal(c.bootstrapHi, 1.58)
    assert.equal(c.bootstrapExcludesZero, false)
    assert.equal(c.trainGap, 0.22)
    assert.equal(c.validationGap, -4.54)

    const e = report.judgments.E
    assert.equal(e.evidenceLevel, "판단 유보")
    assert.equal(v4.e.correlations.return60.rho, 0)
    assert.match(e.practicalReason, /1362/)

    const b = report.judgments.B
    assert.equal(b.citations.sameDayGap, -3.16)
    assert.equal(b.citations.bootstrapExcludesZero, true)
    assert.equal(b.evidenceLevel, "현재 근거 부족")

    assert.equal(report.judgments.A.evidenceLevel, "현재 근거 부족")
    assert.equal(report.judgments.C.evidenceLevel, "추가 검증")
    assert.equal(report.judgments.D.evidenceLevel, "추가 검증")

    assert.equal(report.tableD.overallScoreSystem.verdict.includes("입증되지 않음"), true)
    assert.equal(report.tableA.every((row) => JUDGE_RULE.levels.includes(row.evidenceLevel)), true)
    const body = JSON.stringify({
      tableA: report.tableA,
      tableD: report.tableD,
      judgments: Object.fromEntries(
        Object.entries(report.judgments).map(([key, row]) => [
          key,
          { evidenceLevel: row.evidenceLevel, practical: row.practical, reason: row.practicalReason },
        ]),
      ),
    })
    assert.equal(body.includes("검증 완료"), false)
    assert.equal(body.includes("실전 유효"), false)

    const saved = readJson("dbb-chart-quality-v5.json")
    assert.equal(saved.judgments.C.citations.sameDayGap, -0.9)
    assert.equal(saved.counts.eNonzero, 18)

    assert.deepEqual([v1Path, v2Path, v3Path, v4Path].map(hash), before)
  })

  it("keeps whole-sample and same-day results separate and does not fill gaps with zero", () => {
    const report = readJson("dbb-chart-quality-v5.json")
    const eRow = report.tableA.find((row) => row.component === "E")
    assert.match(eRow.sameDay, /10그룹/)
    assert.match(eRow.overallRelation, /v4 ρ/)
    assert.equal(eRow.sameDay.includes("전체"), false)
    const reliability = report.tableC.find((row) => row.topic === "미완성 성과")
    assert.match(reliability.detail, /채우지 않음/)
    assert.equal(report.judgments.E.citations.bootstrapLo, null)
    assert.equal(report.judgments.E.citations.bootstrapHi, null)
  })

  it("wires the new route and leaves v1~v4 screens and buy thresholds unchanged", () => {
    assert.match(read("vite-project/src/App.jsx"), /path="\/dbb-chart-quality-v5"/)
    assert.match(read("vite-project/src/utils/ydsUiLabels.js"), /항목별 최종 판정/)
    for (const page of [
      "vite-project/src/pages/DbbChartQualityPage.jsx",
      "vite-project/src/pages/DbbChartQualityV2Page.jsx",
      "vite-project/src/pages/DbbChartQualityV3Page.jsx",
      "vite-project/src/pages/DbbChartQualityV4Page.jsx",
      "vite-project/src/content/dbbChartQualityV1.js",
      "vite-project/src/content/dbbChartQualityV2.js",
      "vite-project/src/content/dbbChartQualityV3.js",
      "vite-project/src/content/dbbChartQualityV4.js",
      "vite-project/src/pages/DailyBottomBuyPage.jsx",
      "vite-project/src/content/ydsTradeRecords.js",
    ]) {
      assert.equal(read(page).includes("dbbChartQualityV5"), false)
    }
    assert.equal(DAILY_BOTTOM_THRESHOLDS.rsiMax, 36)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.ma20DevMax, -4.2)
  })
})
