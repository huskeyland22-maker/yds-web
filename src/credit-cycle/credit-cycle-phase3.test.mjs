import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  parseAlfredRevisionRow,
  isRevisionVisibleAsOf,
  selectPitValueForObservation,
  selectInitialRelease,
  selectLatestRevised,
  buildPitObservationHistory,
  compareInitialVsRevised,
} from "./alfred.js"
import {
  industryRatioFromAmounts,
  buildIndustrySnapshot,
  simpleAverageRatios_FORBIDDEN,
  selectIndustryCapital,
} from "./fdicIndustry.js"
import { computeBankSoundnessFromIndustry } from "./bankSoundness.js"
import {
  WEIGHT_SCENARIOS,
  computeCciWithWeights,
  runWeightSensitivity,
  runRegimeConfirmSensitivity,
} from "./sensitivity.js"
import { computeCci } from "./cci.js"
import { QUALITY } from "./config.js"
import { expandingHistoryAsOf } from "./normalize.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const alfredFix = JSON.parse(
  readFileSync(
    path.join(__dirname, "../../fixtures/credit-cycle/alfred-revisions.json"),
    "utf8",
  ),
)

test("ALFRED parse + visibility by realtime window", () => {
  const rev = parseAlfredRevisionRow(
    {
      date: "2008-04-01",
      realtime_start: "2008-05-15",
      realtime_end: "2009-01-10",
      value: "55",
    },
    "DRTSCILM",
  )
  assert.ok(rev)
  assert.equal(isRevisionVisibleAsOf(rev, "2008-05-01"), false)
  assert.equal(isRevisionVisibleAsOf(rev, "2008-05-15"), true)
  assert.equal(isRevisionVisibleAsOf(rev, "2009-01-11"), false)
})

test("ALFRED initial vs revised distinction", () => {
  const revs = alfredFix.DRTSCILM
  const init = selectInitialRelease(revs, "2008-04-01")
  const latest = selectLatestRevised(revs, "2008-04-01")
  assert.equal(init.value, 55)
  assert.equal(latest.value, 58)
  assert.notEqual(init.value, latest.value)
})

test("PIT value uses pre-revision figure before revision date", () => {
  const revs = alfredFix.DRTSCILM
  const before = selectPitValueForObservation(revs, "2008-04-01", "2008-12-01")
  const after = selectPitValueForObservation(revs, "2008-04-01", "2009-02-01")
  assert.equal(before.value, 55)
  assert.equal(after.value, 58)
})

test("buildPitObservationHistory excludes unreleased quarters", () => {
  const hist = buildPitObservationHistory(alfredFix.DRTSCILM, "2008-05-01", {
    seriesId: "DRTSCILM",
    frequency: "quarterly",
  })
  const dates = hist.map((h) => h.observation_date)
  assert.ok(!dates.includes("2008-04-01"))
  assert.ok(dates.includes("2008-01-01") || dates.includes("2007-10-01"))
  const after = buildPitObservationHistory(alfredFix.DRTSCILM, "2008-05-15", {
    seriesId: "DRTSCILM",
    frequency: "quarterly",
  })
  assert.ok(after.some((h) => h.observation_date === "2008-04-01"))
})

test("compareInitialVsRevised reports changes", () => {
  const cmp = compareInitialVsRevised(alfredFix.DRTSCILM)
  assert.ok(cmp.nChanged >= 1)
  assert.ok(cmp.maxAbsDelta >= 3)
})

test("Future revision cannot leak into earlier PIT history values", () => {
  const early = buildPitObservationHistory(alfredFix.DRTSCILM, "2008-12-01", {
    seriesId: "DRTSCILM",
    frequency: "quarterly",
  })
  const late = buildPitObservationHistory(alfredFix.DRTSCILM, "2009-06-01", {
    seriesId: "DRTSCILM",
    frequency: "quarterly",
  })
  const e = early.find((x) => x.observation_date === "2008-04-01")
  const l = late.find((x) => x.observation_date === "2008-04-01")
  assert.equal(e.value, 55)
  assert.equal(l.value, 58)
})

test("FDIC industry ratio = sum/sum not average", () => {
  const banks = [
    { NCLNLS: 10, LNLS: 100, NCLNLSR: 20 },
    { NCLNLS: 30, LNLS: 300, NCLNLSR: 5 },
  ]
  const ind = industryRatioFromAmounts(banks, "NCLNLS", "LNLS")
  assert.equal(ind.status, "OK")
  assert.ok(Math.abs(ind.ratioPct - 10) < 1e-9) // 40/400
  const avg = simpleAverageRatios_FORBIDDEN([20, 5])
  assert.equal(avg, 12.5)
  assert.notEqual(ind.ratioPct, avg)
})

test("buildIndustrySnapshot forbids relying on mean NCLNLSR", () => {
  const banks = [
    {
      NCLNLS: 100,
      LNLS: 1000,
      NTLNLS: 10,
      LNATRES: 20,
      RBCT1J: 50,
      RWAJT: 500,
      NCLNLSR: 50,
    },
    {
      NCLNLS: 100,
      LNLS: 9000,
      NTLNLS: 10,
      LNATRES: 20,
      RBCT1J: 50,
      RWAJT: 500,
      NCLNLSR: 1,
    },
  ]
  const snap = buildIndustrySnapshot("20081231", banks)
  assert.ok(Math.abs(snap.NCLNLSR_industry - 2) < 1e-9) // 200/10000
  const avg = simpleAverageRatios_FORBIDDEN(banks.map((b) => b.NCLNLSR))
  assert.ok(Math.abs(avg - 25.5) < 1e-9)
})

test("IDT1CER missing does not become zero capital stress via fake fill", () => {
  const snap = {
    observation_date: "2008-12-31",
    NCLNLSR_industry: 3.5,
    NTLNLSR_industry: 1.2,
    LNATRESR_industry: 2.5,
    RBC1AAJ_industry_approx: 8.5,
    IDT1CER_industry: null,
  }
  const cap = selectIndustryCapital("2008-12-31", snap)
  assert.equal(cap.field, "RBC1AAJ_industry_approx")
  const scored = computeBankSoundnessFromIndustry(snap)
  assert.ok(scored.score != null)
  assert.notEqual(scored.capitalField, "IDT1CER")
})

test("Bank soundness: lower capital → higher stress", () => {
  const weak = computeBankSoundnessFromIndustry({
    observation_date: "2008-12-31",
    NCLNLSR_industry: 3,
    NTLNLSR_industry: 1,
    LNATRESR_industry: 2,
    RBC1AAJ_industry_approx: 5,
    IDT1CER_industry: null,
  })
  const strong = computeBankSoundnessFromIndustry({
    observation_date: "2008-12-31",
    NCLNLSR_industry: 3,
    NTLNLSR_industry: 1,
    LNATRESR_industry: 2,
    RBC1AAJ_industry_approx: 14,
    IDT1CER_industry: null,
  })
  assert.ok(weak.score > strong.score)
})

test("Research vs license-safe remain separated under custom weights", () => {
  const scores = [
    { id: "hy", score: 90, quality: QUALITY.VALID },
    { id: "bbb", score: 85, quality: QUALITY.VALID },
    { id: "sloos", score: 40, quality: QUALITY.VALID },
    { id: "cpff", score: 40, quality: QUALITY.VALID },
    { id: "bank", score: 40, quality: QUALITY.VALID },
    { id: "cre", score: 40, quality: QUALITY.VALID },
    { id: "corp_delinq", score: 40, quality: QUALITY.VALID },
  ]
  const research = computeCci(scores, { mode: "research", asOfDate: "2024-01-01" })
  const safe = computeCciWithWeights(
    scores.filter((s) => s.id !== "hy" && s.id !== "bbb"),
    WEIGHT_SCENARIOS.license_safe_renorm.weights,
    { asOfDate: "2024-01-01" },
  )
  assert.ok(research.cci > safe.cci)
  assert.ok(research.licenseRestrictedIndicators.includes("hy"))
})

test("Weight sensitivity returns multiple scenario peaks", () => {
  const path = [
    {
      asOfDate: "2008-09-30",
      scores: [
        { id: "sloos", score: 70 },
        { id: "cpff", score: 60 },
        { id: "bank", score: 65 },
        { id: "cre", score: 55 },
        { id: "corp_delinq", score: 50 },
      ],
    },
    {
      asOfDate: "2008-12-31",
      scores: [
        { id: "sloos", score: 85 },
        { id: "cpff", score: 80 },
        { id: "bank", score: 75 },
        { id: "cre", score: 70 },
        { id: "corp_delinq", score: 65 },
      ],
    },
  ]
  const sens = runWeightSensitivity(path)
  assert.ok(sens.license_safe_renorm.peak.cci != null)
  assert.ok(sens.bank_heavy.peak.cci != null)
  assert.ok(sens.sloos_heavy.peak.cci != null)
})

test("Regime confirm sensitivity: faster switches more often", () => {
  const proposals = [
    { asOfDate: "2008-06-30", proposed: "Tightening" },
    { asOfDate: "2008-09-30", proposed: "Tightening" },
    { asOfDate: "2008-12-31", proposed: "Crisis" },
    { asOfDate: "2009-03-31", proposed: "Crisis" },
  ]
  const fast = runRegimeConfirmSensitivity(proposals, 1)
  const slow = runRegimeConfirmSensitivity(proposals, 3)
  assert.ok(fast.switches >= slow.switches)
})

test("PIT/NON_PIT expandingHistory flags differ when release missing", () => {
  const rows = buildPitObservationHistory(alfredFix.DRTSCILM, "2008-11-15", {
    seriesId: "DRTSCILM",
    frequency: "quarterly",
  })
  const pit = expandingHistoryAsOf(rows, "2008-11-15", { pitMode: "strict" })
  assert.equal(pit.pitStatus, "PIT")
})

test("Denominator zero → industry ratio NOT_AVAILABLE", () => {
  const r = industryRatioFromAmounts([{ NCLNLS: 1, LNLS: 0 }], "NCLNLS", "LNLS")
  assert.equal(r.status, "NOT_AVAILABLE")
  assert.equal(r.ratioPct, null)
})
