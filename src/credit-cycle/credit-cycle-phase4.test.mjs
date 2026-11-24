import test from "node:test"
import assert from "node:assert/strict"
import {
  classifyWarningLevel,
  ruleFromWarnThreshold,
  applyWarningPath,
  evaluateWarningPerformance,
} from "./warningRules.js"
import { QUALITY } from "./config.js"
import { computeCci } from "./cci.js"

test("HOLD when coverage below policy / cci null", () => {
  const r = classifyWarningLevel(
    { cci: null, coverage: 0.5, cciStatus: "HOLD_LOW_COVERAGE" },
    ruleFromWarnThreshold(50),
  )
  assert.equal(r.level, "HOLD")
})

test("Missing cci is not treated as zero NORMAL", () => {
  const r = classifyWarningLevel(
    { cci: null, coverage: 1 },
    ruleFromWarnThreshold(40),
  )
  assert.equal(r.level, "HOLD")
  assert.notEqual(r.level, "NORMAL")
})

test("Threshold bands order watch < warning < high", () => {
  const rule = ruleFromWarnThreshold(50)
  assert.equal(
    classifyWarningLevel({ cci: 42, coverage: 1 }, rule).level,
    "WATCH",
  )
  assert.equal(
    classifyWarningLevel({ cci: 52, coverage: 1 }, rule).level,
    "WARNING",
  )
  assert.equal(
    classifyWarningLevel({ cci: 62, coverage: 1 }, rule).level,
    "HIGH_RISK",
  )
})

test("Momentum gate can cap at WATCH", () => {
  const rule = ruleFromWarnThreshold(50, { requireMomentum: true, momentumMin: 0 })
  const r = classifyWarningLevel(
    { cci: 55, cciMomentum: -2, coverage: 1 },
    rule,
  )
  assert.equal(r.level, "WATCH")
})

test("Post-event alert is not counted as pre-event lead", () => {
  const path = applyWarningPath(
    [
      { asOf: "2020-03-31", cci: 55, coverage: 1, status: "OK" },
      { asOf: "2020-06-30", cci: 60, coverage: 1, status: "OK" },
    ],
    ruleFromWarnThreshold(50),
    1,
  )
  const perf = evaluateWarningPerformance(path, "2020-03-15")
  assert.equal(perf.status, "NOT_EVALUATED")
  assert.equal(perf.reason, "no_pre_event_asof_points_on_path")
  assert.ok(perf.postAlertCount >= 1)
})

test("Pre-event warning yields positive leadDays", () => {
  const path = applyWarningPath(
    [
      { asOf: "2022-06-30", cci: 52, coverage: 1, status: "OK" },
      { asOf: "2022-12-31", cci: 53, coverage: 1, status: "OK" },
      { asOf: "2023-06-30", cci: 40, coverage: 1, status: "OK" },
    ],
    ruleFromWarnThreshold(50),
    1,
  )
  const perf = evaluateWarningPerformance(path, "2023-03-10")
  assert.equal(perf.status, "COMPUTED")
  assert.equal(perf.missedPreEventWarning, false)
  assert.ok(perf.leadDays > 0)
  assert.equal(perf.firstAlertIsPostEvent, false)
})

test("Confirm steps delay WARNING escalation", () => {
  const rows = [
    { asOf: "2022-06-30", cci: 52, coverage: 1, status: "OK" },
    { asOf: "2022-09-30", cci: 53, coverage: 1, status: "OK" },
  ]
  const fast = applyWarningPath(rows, ruleFromWarnThreshold(50), 1)
  const slow = applyWarningPath(rows, ruleFromWarnThreshold(50), 2)
  assert.equal(fast[0].level, "WARNING")
  assert.notEqual(slow[0].level, "WARNING")
  assert.equal(slow[1].level, "WARNING")
})

test("License-safe CCI still excludes HY when validating warning inputs", () => {
  const out = computeCci(
    [
      { id: "hy", score: 99, quality: QUALITY.VALID },
      { id: "sloos", score: 40, quality: QUALITY.VALID },
      { id: "cpff", score: 40, quality: QUALITY.VALID },
      { id: "bank", score: 40, quality: QUALITY.VALID },
      { id: "cre", score: 40, quality: QUALITY.VALID },
      { id: "corp_delinq", score: 40, quality: QUALITY.VALID },
    ],
    { mode: "license_safe", asOfDate: "2020-06-30" },
  )
  assert.ok(out.licenseRestrictedIndicators.includes("hy"))
  assert.ok(out.cci < 90)
})

test("NOT_TESTABLE path rows become HOLD in warning path", () => {
  const path = applyWarningPath(
    [{ asOf: "2008-09-30", status: "NOT_TESTABLE" }],
    ruleFromWarnThreshold(50),
    1,
  )
  assert.equal(path[0].level, "HOLD")
})
