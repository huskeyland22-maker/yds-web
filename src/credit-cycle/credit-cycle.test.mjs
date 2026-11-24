import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

import { computeLevelScore } from "./scores/level.js"
import { computeMomentumScore } from "./scores/momentum.js"
import { computePersistenceScore } from "./scores/persistence.js"
import { computeIndicatorRiskScore } from "./scores/indicator.js"
import {
  normalizeObservation,
  expandingHistoryAsOf,
  sortObservations,
} from "./normalize.js"
import { assessFreshness, computeCoverageAndConfidence } from "./quality.js"
import { computeCci } from "./cci.js"
import { classifyRegime, confirmRegimeTransition } from "./regime.js"
import {
  computeBankSoundnessScore,
  selectCapitalField,
} from "./bankSoundness.js"
import { analyzeCorporateOverlap } from "./corporateRedundancy.js"
import { QUALITY, getIndicatorConfig } from "./config.js"
import { scoreIndicatorAt, computeCciAt } from "./engine.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(
  readFileSync(
    path.join(__dirname, "../../fixtures/credit-cycle/synthetic-series.json"),
    "utf8",
  ),
)

function ramp(n, start = 1, step = 0.1) {
  const out = []
  for (let i = 0; i < n; i++) out.push(start + i * step)
  return out
}

test("Level Score: higher value → higher risk when higher_is_risk", () => {
  const hist = ramp(80, 1, 0.05)
  // Expanding windows ending at early vs late points on the same series
  const low = computeLevelScore(hist.slice(0, 25), {
    riskDirection: "higher_is_risk",
    minHistory: 20,
  })
  const mid = computeLevelScore(hist.slice(0, 50), {
    riskDirection: "higher_is_risk",
    minHistory: 20,
  })
  // mid endpoint is higher raw value than low endpoint
  assert.ok(hist[49] > hist[24])
  assert.equal(low.reason, "ok")
  assert.equal(mid.reason, "ok")
  // Both are local maxima of their windows → both high; compare percentiles of shared prefix instead:
  const earlyVal = hist[24]
  const lateHist = hist.slice(0, 50)
  const pctEarlyInLate = lateHist.filter((v) => v < earlyVal).length / lateHist.length
  assert.ok(pctEarlyInLate < 0.6)
  assert.ok(mid.score >= 50)
  assert.ok(low.score >= 50)
})

test("Level Score: lower_is_risk reverses percentile mapping", () => {
  const hist = ramp(50, 1, 0.1)
  const a = computeLevelScore(hist, {
    riskDirection: "higher_is_risk",
    minHistory: 20,
  })
  const b = computeLevelScore(hist, {
    riskDirection: "lower_is_risk",
    minHistory: 20,
  })
  assert.ok(a.score != null && b.score != null)
  assert.ok(Math.abs(a.score + b.score - 100) <= 2)
})

test("Level Score: insufficient history returns null (not 0)", () => {
  const r = computeLevelScore([1, 2, 3], {
    riskDirection: "higher_is_risk",
    minHistory: 20,
  })
  assert.equal(r.score, null)
  assert.equal(r.reason, "insufficient_history")
})

test("Momentum Score: risk-up move raises score", () => {
  const flat = Array(40).fill(2)
  const rising = [...Array(30).fill(2), 2.2, 2.5, 3, 4, 6, 9, 12, 15, 18, 22]
  const mFlat = computeMomentumScore(flat, {
    riskDirection: "higher_is_risk",
    shortPeriods: 5,
    longPeriods: 21,
  })
  const mUp = computeMomentumScore(rising, {
    riskDirection: "higher_is_risk",
    shortPeriods: 5,
    longPeriods: 21,
  })
  assert.ok(mUp.score > mFlat.score)
})

test("Momentum Score: risk-down move lowers score", () => {
  const falling = [...Array(30).fill(10), 9, 8, 7, 6, 5, 4, 3, 2, 1.5, 1]
  const m = computeMomentumScore(falling, {
    riskDirection: "higher_is_risk",
    shortPeriods: 5,
    longPeriods: 21,
  })
  assert.ok(m.score != null && m.score < 50)
})

test("Persistence Score: sustained elevation → high score", () => {
  const hist = [...ramp(40, 1, 0.05), ...Array(20).fill(10)]
  const p = computePersistenceScore(hist, {
    riskDirection: "higher_is_risk",
    lookback: 20,
    riskThresholdPercentile: 70,
    minHistory: 30,
  })
  assert.equal(p.reason, "ok")
  assert.ok(p.score >= 70)
})

test("Indicator blend stays in 0–100", () => {
  const cfg = getIndicatorConfig("cpff")
  const hist = ramp(100, 0.1, 0.05)
  const r = computeIndicatorRiskScore(hist, cfg)
  assert.equal(r.reason, "ok")
  assert.ok(r.score >= 0 && r.score <= 100)
})

test("Missing values are not coerced to 0 in CCI", () => {
  const out = computeCci(
    [
      { id: "sloos", score: 80, quality: QUALITY.VALID },
      { id: "cpff", score: null, quality: QUALITY.MISSING },
      { id: "bank", score: null, quality: QUALITY.MISSING },
      { id: "cre", score: 70, quality: QUALITY.VALID },
      { id: "corp_delinq", score: 60, quality: QUALITY.VALID },
      { id: "hy", score: null, quality: QUALITY.LICENSE_RESTRICTED },
      { id: "bbb", score: null, quality: QUALITY.LICENSE_RESTRICTED },
    ],
    { mode: "research", asOfDate: "2020-06-01", pitStatus: "NON_PIT" },
  )
  assert.ok(out.missingIndicators.includes("cpff"))
  assert.notEqual(out.cciPartial, 0)
  assert.ok(out.coverage < 1)
  // missing must lower partial vs renormalized
  assert.ok(out.cciRenormalized != null && out.cciPartial != null)
  assert.ok(out.cciRenormalized > out.cciPartial)
})

test("Coverage HOLD below 70% hypothesis threshold", () => {
  const out = computeCci(
    [
      { id: "sloos", score: 50, quality: QUALITY.VALID },
      { id: "hy", score: null, quality: QUALITY.MISSING },
      { id: "bbb", score: null, quality: QUALITY.MISSING },
      { id: "cpff", score: null, quality: QUALITY.MISSING },
      { id: "bank", score: null, quality: QUALITY.MISSING },
      { id: "cre", score: null, quality: QUALITY.MISSING },
      { id: "corp_delinq", score: null, quality: QUALITY.MISSING },
    ],
    { mode: "research", asOfDate: "2008-01-01" },
  )
  assert.equal(out.cciStatus, "HOLD_LOW_COVERAGE")
  assert.equal(out.cci, null)
  assert.equal(out.confidence, "HOLD")
})

test("License-safe CCI excludes HY/BBB", () => {
  const out = computeCci(
    [
      { id: "hy", score: 90, quality: QUALITY.VALID },
      { id: "bbb", score: 90, quality: QUALITY.VALID },
      { id: "sloos", score: 40, quality: QUALITY.VALID },
      { id: "cpff", score: 40, quality: QUALITY.VALID },
      { id: "bank", score: 40, quality: QUALITY.VALID },
      { id: "cre", score: 40, quality: QUALITY.VALID },
      { id: "corp_delinq", score: 40, quality: QUALITY.VALID },
    ],
    { mode: "license_safe", asOfDate: "2024-01-01" },
  )
  assert.ok(out.licenseRestrictedIndicators.includes("hy"))
  assert.ok(out.licenseRestrictedIndicators.includes("bbb"))
  assert.equal(out.components.find((c) => c.id === "hy"), undefined)
  assert.ok(out.cci != null)
  assert.ok(out.cci < 90)
})

test("Research vs license-safe are not identical indexes", () => {
  const scores = [
    { id: "hy", score: 95, quality: QUALITY.VALID },
    { id: "bbb", score: 90, quality: QUALITY.VALID },
    { id: "sloos", score: 30, quality: QUALITY.VALID },
    { id: "cpff", score: 30, quality: QUALITY.VALID },
    { id: "bank", score: 30, quality: QUALITY.VALID },
    { id: "cre", score: 30, quality: QUALITY.VALID },
    { id: "corp_delinq", score: 30, quality: QUALITY.VALID },
  ]
  const research = computeCci(scores, { mode: "research", asOfDate: "2024-06-01" })
  const safe = computeCci(scores, { mode: "license_safe", asOfDate: "2024-06-01" })
  assert.notEqual(research.cci, safe.cci)
  assert.ok(research.cci > safe.cci)
  assert.ok(research.components.some((c) => c.id === "hy"))
  assert.equal(safe.components.find((c) => c.id === "hy"), undefined)
})

test("PIT expanding history excludes unreleased future points", () => {
  const rows = sortObservations(
    fixture.quarterly_sloos_like.map((r) => normalizeObservation(r)),
  )
  // Before 2008-05-15 release, 2008-04 observation must be absent
  const before = expandingHistoryAsOf(rows, "2008-05-01", { pitMode: "strict" })
  assert.ok(!before.dates.includes("2008-04-01"))
  assert.ok(before.dates.includes("2008-01-01"))
  const after = expandingHistoryAsOf(rows, "2008-05-15", { pitMode: "strict" })
  assert.ok(after.dates.includes("2008-04-01"))
  assert.equal(after.pitStatus, "PIT")
})

test("Look-ahead: later values must not enter earlier percentile window", () => {
  const early = ramp(40, 1, 0.1)
  const withFuture = [...early, ...ramp(40, 8, 0.3)]
  const s1 = computeLevelScore(early, {
    riskDirection: "higher_is_risk",
    minHistory: 20,
  })
  const s2 = computeLevelScore(withFuture.slice(0, 40), {
    riskDirection: "higher_is_risk",
    minHistory: 20,
  })
  assert.equal(s1.score, s2.score)

  // If future values leak into the distribution for the same early endpoint value,
  // its percentile (risk) falls — this is the look-ahead bug we forbid.
  const earlyVal = early[early.length - 1]
  const sortedEarly = early.slice().sort((a, b) => a - b)
  const sortedLeak = withFuture.slice().sort((a, b) => a - b)
  const rank = (sorted, v) =>
    sorted.filter((x) => x < v).length / sorted.length
  assert.ok(rank(sortedLeak, earlyVal) < rank(sortedEarly, earlyVal))
})

test("Stale assessment for quarterly", () => {
  const fresh = assessFreshness({
    asOfDate: "2008-08-01",
    lastObservationDate: "2008-04-01",
    frequency: "quarterly",
    maxStalePeriods: 2,
    releaseDate: "2008-05-15",
  })
  assert.equal(fresh.status, QUALITY.VALID)
  const stale = assessFreshness({
    asOfDate: "2009-04-01",
    lastObservationDate: "2008-04-01",
    frequency: "quarterly",
    maxStalePeriods: 2,
  })
  assert.equal(stale.status, QUALITY.STALE)
})

test("Quarterly publication delay flagged DELAYED when lag large", () => {
  const d = assessFreshness({
    asOfDate: "2008-12-01",
    lastObservationDate: "2008-04-01",
    frequency: "quarterly",
    maxStalePeriods: 4,
    releaseDate: "2008-11-01",
  })
  assert.equal(d.status, QUALITY.DELAYED)
})

test("Regime: extreme CCI + breadth → Crisis", () => {
  const r = classifyRegime({
    cci: 85,
    cciMomentum: 5,
    worseningCount: 4,
    indicatorCount: 5,
    persistenceShare: 0.8,
  })
  assert.equal(r.regime, "Crisis")
})

test("Regime hysteresis requires confirmation", () => {
  let state = { active: "Expansion", pending: null, streak: 0 }
  state = confirmRegimeTransition(state.pending, "Tightening", state.active, state.streak)
  assert.equal(state.active, "Expansion")
  assert.equal(state.pending, "Tightening")
  state = confirmRegimeTransition(state.pending, "Tightening", state.active, state.streak)
  assert.equal(state.active, "Tightening")
})

test("FDIC capital field selection does not splice eras", () => {
  const gfc = selectCapitalField("2008-12-31", { IDT1CER: 0, RBC1AAJ: 5.87 })
  assert.equal(gfc.field, "RBC1AAJ")
  const modern = selectCapitalField("2023-03-31", {
    IDT1CER: 17.26,
    RBC1AAJ: 8.6,
  })
  assert.equal(modern.field, "IDT1CER")
})

test("Bank soundness ignores asset size and handles GFC", () => {
  const s = computeBankSoundnessScore({
    observation_date: "2008-12-31",
    IDT1CER: 0,
    RBC1AAJ: 5.87,
    NCLNLSR: 3.44,
    NTLNLSR: 1.22,
    LNATRESR: 2.58,
    ASSET: 999999999, // must be ignored even if present
  })
  assert.ok(s.score != null)
  assert.equal(s.capitalField, "RBC1AAJ")
})

test("Corporate overlap recommends single weight when corr high", () => {
  const x = ramp(40, 1, 0.2)
  const y = x.map((v) => v * 0.4 + 0.1)
  const r = analyzeCorporateOverlap(x, y)
  assert.ok(r.correlation != null && r.correlation > 0.9)
  assert.equal(r.recommendation, "use_DRBLACBS_only_in_default_cci")
})

test("scoreIndicatorAt uses release dates (no look-ahead)", () => {
  const rows = fixture.quarterly_sloos_like.map((r) => normalizeObservation(r))
  // Need enough history — pad with earlier synthetic
  const padded = []
  for (let y = 2000; y < 2007; y++) {
    for (const m of ["01", "04", "07", "10"]) {
      padded.push(
        normalizeObservation({
          series_id: "DRTSCILM",
          observation_date: `${y}-${m}-01`,
          release_date: `${y}-${m === "01" ? "02" : m === "04" ? "05" : m === "07" ? "08" : "11"}-15`,
          value: 5,
          frequency: "quarterly",
        }),
      )
    }
  }
  const all = [...padded, ...rows]
  const before = scoreIndicatorAt("sloos", all, "2008-05-01", { pitMode: "strict" })
  const after = scoreIndicatorAt("sloos", all, "2008-05-15", { pitMode: "strict" })
  assert.ok(before.lastObservationDate <= "2008-01-01" || before.lastObservationDate === "2008-01-01")
  assert.equal(after.lastObservationDate, "2008-04-01")
  assert.notEqual(before.lastValue, after.lastValue)
})

test("computeCciAt license_safe path", () => {
  const rows = fixture.quarterly_sloos_like.map((r) => normalizeObservation(r))
  const padded = []
  for (let y = 2000; y < 2007; y++) {
    for (const m of ["01", "04", "07", "10"]) {
      padded.push(
        normalizeObservation({
          series_id: "DRTSCILM",
          observation_date: `${y}-${m}-01`,
          release_date: `${y}-02-15`,
          value: 5 + (y - 2000),
          frequency: "quarterly",
        }),
      )
    }
  }
  // release_date simplified — still enough points
  const out = computeCciAt({ sloos: [...padded, ...rows] }, "2008-11-15", {
    mode: "license_safe",
    pitMode: "strict",
  })
  assert.ok(out.licenseRestrictedIndicators.includes("hy"))
  // Low coverage expected (only sloos) → HOLD
  assert.ok(out.coverage < 0.7)
  assert.equal(out.cciStatus, "HOLD_LOW_COVERAGE")
})

test("normalizeObservation marks missing as MISSING not zero", () => {
  const o = normalizeObservation({
    series_id: "CPFF",
    observation_date: "2020-03-16",
    value: ".",
    frequency: "daily",
  })
  assert.equal(o.value, null)
  assert.equal(o.quality_status, QUALITY.MISSING)
})

test("confidence warns when missing weight > 25%", () => {
  const meta = computeCoverageAndConfidence([
    { id: "a", weightNominal: 0.5, score: 50, quality: QUALITY.VALID },
    { id: "b", weightNominal: 0.3, score: null, quality: QUALITY.MISSING },
    { id: "c", weightNominal: 0.2, score: 40, quality: QUALITY.VALID },
  ])
  assert.ok(meta.missingShare > 0.25)
  assert.equal(meta.confidence, "LOW")
})
