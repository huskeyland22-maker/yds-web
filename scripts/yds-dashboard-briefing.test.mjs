import assert from "node:assert/strict"
import {
  buildWeekEventStrip,
  eventBriefLabel,
  importanceTierLabel,
} from "../vite-project/src/content/ydsInvestmentCalendarEngine.js"
import { buildDashboardActionGuideReport } from "../vite-project/src/content/ydsDashboardActionGuide.js"

assert.equal(importanceTierLabel(3), "상")
assert.equal(importanceTierLabel(2), "중")
assert.equal(importanceTierLabel(1), "하")

assert.equal(
  eventBriefLabel({
    kind: "macro",
    category: "fomc",
    region: "US",
    title: "FOMC 금리 결정",
  }),
  "FOMC 회의",
)
assert.equal(
  eventBriefLabel({
    kind: "stock",
    category: "earnings",
    name: "엔비디아",
    title: "",
  }),
  "엔비디아 실적",
)

const strip = buildWeekEventStrip(null, 5, new Date("2026-06-22T12:00:00"))
assert.ok(strip.stripItems.length > 0)
assert.ok(strip.stripItems.length <= 5)
assert.ok(strip.stripItems.every((e) => e.briefLabel && e.importanceTier))

const panicData = { fearGreed: 62, vix: 16, bofa: 6.2, putCall: 0.72, highYield: 4.1 }
const guide = buildDashboardActionGuideReport(panicData, [{ date: "2026-06-21", fearGreed: 70, vix: 15, bofa: 6.5 }], {
  score: 87,
  verdict: { id: "favorable", label: "우호", tone: "favorable" },
  summary: "",
  headline: "",
  styleSignal: "",
  ratesSignal: "",
  volatilitySignal: "",
  creditSignal: "",
  metrics: [],
})
assert.equal(guide.visible, true)
assert.ok(guide.checklist.length >= 3 && guide.checklist.length <= 5)
assert.ok(guide.checklist.some((l) => /추격|분할|성장|현금|선별/.test(l)))

console.log("yds-dashboard-briefing.test.mjs OK")
