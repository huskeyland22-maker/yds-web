import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { buildMarketCycleFlowReport } from "../vite-project/src/content/ydsMarketCycleFlow.js"
import {
  buildCycleEtfReturnAudit,
  CYCLE_LABEL_ADJUSTMENT_STABLE,
  CYCLE_LABEL_RECOVERY_WARNING,
  resolveEtfCycleDowngrade,
  trailingEtfReturnPct,
} from "../vite-project/src/content/ydsMarketCycleEtfSensitivity.js"
import { resolveCycleProgressIndex } from "../vite-project/src/content/ydsMarketCycleProgress.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const qqq = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../vite-project/public/data/qqq-daily.json"), "utf8"),
).prices
const soxx = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../vite-project/public/data/soxx-daily.json"), "utf8"),
).prices

assert.equal(resolveCycleProgressIndex("조정회복(경고)"), 2)
assert.equal(resolveCycleProgressIndex(CYCLE_LABEL_ADJUSTMENT_STABLE), 1)

const audit = buildCycleEtfReturnAudit(qqq, soxx, "2026-06-18")
assert.ok(audit.qqq.d3 != null)
assert.ok(audit.soxx.d3 != null)
assert.ok(audit.qqq.d5 != null)
assert.ok(audit.soxx.d5 != null)

const mockQqq = {
  "2026-05-27": 100,
  "2026-05-28": 99,
  "2026-05-29": 98,
  "2026-06-02": 97,
  "2026-06-03": 95,
}
const mockSoxx = {
  "2026-05-27": 200,
  "2026-05-28": 198,
  "2026-05-29": 196,
  "2026-06-02": 192,
  "2026-06-03": 186,
}
assert.ok(trailingEtfReturnPct(mockQqq, "2026-06-03", 3) <= -3)
assert.ok(trailingEtfReturnPct(mockSoxx, "2026-06-03", 3) <= -5)

const warnOnlyQqq = {
  "2026-05-20": 100,
  "2026-05-21": 100,
  "2026-05-22": 100,
  "2026-06-02": 99.5,
  "2026-06-03": 99.5,
}
const warnOnlySoxx = {
  "2026-05-20": 200,
  "2026-05-21": 200,
  "2026-05-22": 200,
  "2026-06-02": 191,
  "2026-06-03": 189,
}

const warnOnly = resolveEtfCycleDowngrade(
  "조정회복",
  buildCycleEtfReturnAudit(warnOnlyQqq, warnOnlySoxx, "2026-06-03"),
)
assert.equal(warnOnly.applied, true)
assert.equal(warnOnly.tier, "warning")
assert.equal(warnOnly.label, CYCLE_LABEL_RECOVERY_WARNING)

const stable = resolveEtfCycleDowngrade(
  "조정회복",
  buildCycleEtfReturnAudit(mockQqq, mockSoxx, "2026-06-03"),
)
assert.equal(stable.applied, true)
assert.equal(stable.tier, "stable")
assert.equal(stable.label, CYCLE_LABEL_ADJUSTMENT_STABLE)

const recoveryRows = [
  { date: "2026-05-20", fearGreed: 48, vix: 19, bofa: 5.4 },
  { date: "2026-05-21", fearGreed: 47, vix: 19, bofa: 5.3 },
  { date: "2026-05-22", fearGreed: 46, vix: 18, bofa: 5.2 },
  { date: "2026-05-23", fearGreed: 45, vix: 18, bofa: 5.1 },
  { date: "2026-05-26", fearGreed: 44, vix: 18, bofa: 5.0 },
  { date: "2026-05-27", fearGreed: 43, vix: 17, bofa: 4.9 },
  { date: "2026-05-28", fearGreed: 42, vix: 17, bofa: 4.8 },
  { date: "2026-05-29", fearGreed: 41, vix: 16, bofa: 4.7 },
  { date: "2026-06-02", fearGreed: 40, vix: 16, bofa: 4.6 },
  { date: "2026-06-03", fearGreed: 52, vix: 14, bofa: 6.2 },
]

const baseFlow = buildMarketCycleFlowReport(recoveryRows, 30)
const adjustedFlow = buildMarketCycleFlowReport(recoveryRows, 30, {
  qqqPrices: mockQqq,
  soxxPrices: mockSoxx,
  asOfDate: "2026-06-03",
})

assert.ok(adjustedFlow.visible)
assert.ok(/조정/.test(adjustedFlow.currentCycleLabel))
assert.ok(adjustedFlow.etfSensitivity != null || adjustedFlow.recoveryGate != null)

console.log("yds-market-cycle-etf-sensitivity.test.mjs OK")
