import assert from "node:assert/strict"
import {
  auditPickD7Reliability,
  buildReliabilityAuditReport,
  returnsMatch,
  roundReturnPct,
} from "../vite-project/src/content/ydsPickReliabilityAudit.js"

assert.equal(roundReturnPct(12.34), 12.3)
assert.ok(returnsMatch(12.3, 12.3))
assert.ok(!returnsMatch(12.2, 12.4))

/** @type {import("../vite-project/src/content/ydsValidationStorage.js").ValidationPickRecord} */
const trusted = {
  id: "1",
  ticker: "NVDA",
  name: "엔비디아",
  country: "US",
  rank: 1,
  isTop3: true,
  recommendedAt: "2026-05-01",
  recommendedPrice: 100,
  recommendedScore: 92,
  qualityGrade: "A",
  timingGrade: "A",
  marketFitGrade: "A",
  statusId: "trend",
  statusLabel: "추세",
  currentPrice: null,
  returnPct: null,
  horizons: { d7: 12.5, d14: null, d30: null, d90: null, d180: null, d365: null },
  horizonPrices: { d7: 112.5, d14: null, d30: null, d90: null, d180: null, d365: null },
  priceLog: {},
  regimeId: "neutral",
  regimeLabel: "중립",
  strategyLabel: "—",
  recommendSnapshot: null,
  recordedAt: 1,
  lastUpdatedAt: 1,
}

const audit = auditPickD7Reliability(trusted)
assert.equal(audit.calcReturn, 12.5)
assert.equal(audit.systemReturn, 12.5)
assert.ok(audit.trusted)
assert.equal(audit.outcomeCalc, "success")

/** @type {import("../vite-project/src/content/ydsValidationStorage.js").ValidationPickRecord} */
const mismatch = { ...trusted, id: "2", horizons: { ...trusted.horizons, d7: 10 } }
assert.ok(!auditPickD7Reliability(mismatch).trusted)

const report = buildReliabilityAuditReport([trusted, mismatch])
assert.equal(report.totalWithD7, 2)
assert.equal(report.trustedCount, 1)
assert.equal(report.trustPct, 50)
assert.equal(report.samples.length, 2)

console.log("yds-pick-reliability-audit.test.mjs OK")
