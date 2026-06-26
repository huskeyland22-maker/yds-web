import assert from "node:assert/strict"
import { buildMarketCycleFlowReport } from "../vite-project/src/content/ydsMarketCycleFlow.js"
import { buildMarketDeskSummary } from "../vite-project/src/content/ydsMarketDeskSummary.js"
import { buildDashboardActionGuideReport } from "../vite-project/src/content/ydsDashboardActionGuide.js"
import {
  resolveUnifiedMarketStateGuide,
  resolveUnifiedMarketStateLabel,
} from "../vite-project/src/content/ydsUnifiedMarketState.js"

const rows = [
  { date: "2026-05-20", fearGreed: 68, vix: 14, bofa: 7.2 },
  { date: "2026-05-22", fearGreed: 58, vix: 17, bofa: 6.2 },
  { date: "2026-05-26", fearGreed: 48, vix: 19, bofa: 5.4 },
  { date: "2026-05-29", fearGreed: 45, vix: 18, bofa: 5.1 },
  { date: "2026-06-02", fearGreed: 44, vix: 18, bofa: 5.0 },
  { date: "2026-06-03", fearGreed: 43, vix: 17, bofa: 4.9 },
]

const flow = buildMarketCycleFlowReport(rows, 30)
const unifiedLabel = resolveUnifiedMarketStateLabel(flow)
assert.ok(unifiedLabel.length > 0)

const guide = resolveUnifiedMarketStateGuide(unifiedLabel)
assert.ok(guide.actions.length >= 2)
assert.ok(guide.strategyPhase.length > 0)

const panicData = { fearGreed: 44, vix: 18, bofa: 5.0, putCall: 0.87, highYield: 3.2 }
const summary = buildMarketDeskSummary(panicData, null, flow)
assert.ok(summary?.lines[0].startsWith(unifiedLabel))

const actionGuide = buildDashboardActionGuideReport(panicData, rows, null, flow)
assert.ok(actionGuide.marketState.startsWith(unifiedLabel))
assert.ok(actionGuide.recommendedActions.length > 0)

const recoveryGuide = resolveUnifiedMarketStateGuide("조정회복")
assert.ok(recoveryGuide.actions.some((a) => /분할/.test(a)))

const stableGuide = resolveUnifiedMarketStateGuide("조정안정")
assert.ok(stableGuide.actions.some((a) => /발굴|관찰/.test(a)))

console.log("yds-unified-market-state.test.mjs OK")
