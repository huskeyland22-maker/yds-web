import assert from "node:assert/strict"
import {
  buildUnifiedWeekEventStrip,
  buildWeekEventStrip,
  classifyMacroMarketTier,
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

const strip = buildWeekEventStrip(null, 12, new Date("2026-06-22T12:00:00"))
assert.ok(strip.stripItems.length > 0)
assert.ok(strip.stripItems.every((e) => e.kind === "macro"))
assert.ok(strip.stripItems.every((e) => e.briefLabel && e.marketTier))
assert.ok(strip.stripItems.every((e) => classifyMacroMarketTier(e)))
const dates = strip.stripItems.map((e) => e.date)
assert.deepEqual(dates, [...dates].sort())
assert.ok(strip.stripItems.some((e) => /PCE|Core PCE/.test(e.briefLabel)))
assert.ok(strip.stripItems.some((e) => e.briefLabel === "FOMC 회의" && e.date === "2026-07-30"))
assert.ok(strip.stripItems.every((e) => e.marketTier === "S" || e.marketTier === "A"))
assert.ok(!strip.stripItems.some((e) => /옵션|실업수당/.test(`${e.briefLabel} ${e.title ?? ""}`)))

const unified = buildUnifiedWeekEventStrip(null, {}, new Date("2026-06-22T12:00:00"))
assert.ok(unified.hasEvents)
assert.ok(unified.macroItems.length > 0)
assert.ok(unified.stockItems.length > 0)
assert.ok(unified.flatItems.length >= unified.macroItems.length)
assert.equal(unified.macroPreviewLimit, 6)
assert.equal(unified.stockPreviewLimit, 5)
assert.equal(unified.previewLimit, 11)
assert.ok(unified.flatItems.every((e) => e.date))
const flatDates = unified.flatItems.map((e) => e.date)
assert.deepEqual(flatDates, [...flatDates].sort())
const stockDates = unified.stockItems.map((e) => e.date)
assert.deepEqual(stockDates, [...stockDates].sort())
assert.ok(unified.stockItems.every((e) => e.impactStars && e.impactRelation))

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
assert.ok(guide.buyStars.includes("★"))
assert.ok(guide.watchStars.includes("★"))
assert.ok(guide.cashStars.includes("★"))
assert.ok(guide.recommendedActions.length >= 3 && guide.recommendedActions.length <= 4)
assert.ok(guide.recommendedActions.some((l) => /추격|분할|관심/.test(l)))

console.log("yds-dashboard-briefing.test.mjs OK")
