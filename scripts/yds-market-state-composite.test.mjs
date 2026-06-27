import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import {
  buildMarketStatePriceStructureReport,
  isPriceBearishStructure,
  isPricePullbackInUptrend,
} from "../vite-project/src/content/ydsMarketStatePriceStructure.js"
import {
  applyPriceGatesToCycleLabel,
  buildMarketStateCompositeReport,
  computeMarketStateCompositeScore,
} from "../vite-project/src/content/ydsMarketStateCompositeEngine.js"
import { buildMarketCycleFlowReport } from "../vite-project/src/content/ydsMarketCycleFlow.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const qqqJson = JSON.parse(readFileSync(join(root, "vite-project/public/data/qqq-daily.json"), "utf8"))
const qqqPrices = qqqJson.prices

/** @param {number} totalDays @param {(i: number) => number} priceAt */
function buildSeries(totalDays, priceAt) {
  /** @type {Record<string, number>} */
  const out = {}
  const base = new Date("2025-05-01")
  for (let i = 0; i < totalDays; i += 1) {
    const d = new Date(base)
    d.setDate(d.getDate() + i)
    out[d.toISOString().slice(0, 10)] = priceAt(i)
  }
  return out
}

const compositeScore = computeMarketStateCompositeScore(35, 70, 50)
assert.ok(compositeScore < 55, `price should dominate: ${compositeScore}`)

const fearPanicData = { vix: 28, fearGreed: 24, bofa: 3.2, putCall: 1.02, highYield: 5.8 }

const uptrendPullback = buildSeries(80, (i) => {
  if (i < 70) return 400 + i * 0.8
  return 456 - (i - 70) * 1.5
})
const pullDates = Object.keys(uptrendPullback).sort()
const pullAsOf = pullDates[pullDates.length - 1]
const pullReport = buildMarketStatePriceStructureReport({
  qqqPrices: uptrendPullback,
  asOfDate: pullAsOf,
})
assert.ok(pullReport)
assert.ok(isPricePullbackInUptrend(pullReport))

const peakComposite = buildMarketStateCompositeReport({
  panicData: fearPanicData,
  etfContext: { qqqPrices: uptrendPullback, asOfDate: pullAsOf },
})
assert.equal(peakComposite.positionId, "adjustment")

const gated = applyPriceGatesToCycleLabel("조정회복", pullReport)
assert.equal(gated, "조정안정")

const realReport = buildMarketStatePriceStructureReport({
  qqqPrices,
  asOfDate: Object.keys(qqqPrices).sort().pop(),
})
assert.ok(realReport?.structureScore != null)

const historyRows = [
  { date: "2026-06-05", fearGreed: 55, vix: 17, bofa: 5.4 },
  { date: "2026-06-10", fearGreed: 48, vix: 20, bofa: 5.2 },
  { date: "2026-06-15", fearGreed: 42, vix: 22, bofa: 5.0 },
  { date: "2026-06-18", fearGreed: 38, vix: 24, bofa: 4.8 },
  { date: "2026-06-22", fearGreed: 35, vix: 26, bofa: 4.5 },
]
const flow = buildMarketCycleFlowReport(historyRows, 30, {
  qqqPrices,
  asOfDate: "2026-06-22",
})
assert.ok(flow.visible)
if (pullReport && isPricePullbackInUptrend(pullReport)) {
  assert.ok(!/회복/.test(flow.currentCycleLabel) || /안정/.test(flow.currentCycleLabel))
}

console.log("yds-market-state-composite.test.mjs OK", {
  compositeScore,
  positionId: peakComposite.positionId,
  gated,
  flowLabel: flow.currentCycleLabel,
})
