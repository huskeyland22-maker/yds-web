import assert from "node:assert/strict"
import { buildPanicScoreCompositionReport } from "../vite-project/src/content/ydsPanicScoreComposition.js"
import {
  buildMarketStateChangeTimeline,
  buildRecentMarketStateChanges,
} from "../vite-project/src/content/ydsMarketStateRecentChanges.js"
import { buildAiMarketBriefing } from "../vite-project/src/content/ydsAiMarketBriefing.js"
import { buildTodayMarketConclusion } from "../vite-project/src/content/ydsTodayMarketConclusion.js"
import { buildMarketCycleFlowReport } from "../vite-project/src/content/ydsMarketCycleFlow.js"
import { getFinalScore } from "../vite-project/src/utils/tradingScores.js"

const panicData = {
  vix: 18,
  fearGreed: 52,
  bofa: 5.2,
  putCall: 0.85,
  highYield: 4.1,
  updatedAt: "2026-06-22T12:00:00Z",
}

const composition = buildPanicScoreCompositionReport(panicData)
assert.equal(composition.visible, true)
assert.equal(composition.totalScore, Math.round(getFinalScore(panicData) ?? NaN))
assert.equal(composition.lines.length, 5)
assert.ok(composition.lines.every((line) => line.missing || line.display.startsWith("+")))

const historyRows = [
  { date: "2026-05-18", fearGreed: 55, vix: 17, bofa: 5.4, putCall: 0.9, highYield: 4.0 },
  { date: "2026-06-01", fearGreed: 48, vix: 20, bofa: 5.3, putCall: 0.88, highYield: 4.1 },
  { date: "2026-06-09", fearGreed: 45, vix: 21, bofa: 5.2, putCall: 0.86, highYield: 4.1 },
  { date: "2026-06-15", fearGreed: 48, vix: 20, bofa: 5.3, putCall: 0.85, highYield: 4.1 },
  { date: "2026-06-20", fearGreed: 42, vix: 22, bofa: 5.1, putCall: 0.85, highYield: 4.1 },
  { date: "2026-06-22", fearGreed: 52, vix: 18, bofa: 5.2, putCall: 0.85, highYield: 4.1 },
]
const cycleFlow = buildMarketCycleFlowReport(historyRows)
const timeline = buildMarketStateChangeTimeline(
  historyRows,
  cycleFlow,
  panicData,
  null,
  { refDate: new Date("2026-06-22T12:00:00") },
)
assert.ok(timeline.visible)
assert.ok(timeline.segments.length >= 1 && timeline.segments.length <= 5)
assert.ok(timeline.segments.every((seg) => seg.durationDays >= 1))
assert.ok(timeline.segments[timeline.segments.length - 1].isCurrent)
assert.ok(timeline.segments[timeline.segments.length - 1].dateRangeLabel.includes("진행중"))

const changes = buildRecentMarketStateChanges(
  historyRows,
  cycleFlow,
  panicData,
  null,
  { refDate: new Date("2026-06-22T12:00:00") },
)
assert.ok(Array.isArray(changes.items))

const briefing = buildAiMarketBriefing({ panicData, cycleFlow, dualLiquidity: null })
assert.ok(briefing.visible)
assert.ok(briefing.lines.length >= 3 && briefing.lines.length <= 5)

const conclusion = buildTodayMarketConclusion(panicData, historyRows, null, cycleFlow)
assert.ok(conclusion.visible)
assert.ok(conclusion.lines.length >= 1 && conclusion.lines.length <= 3)
assert.ok(conclusion.actions.length >= 1 && conclusion.actions.length <= 3)
assert.ok(conclusion.signalEmoji)

console.log("yds-desk-trust-features.test.mjs OK")
