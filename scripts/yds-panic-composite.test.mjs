import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import {
  buildPanicCompositeVerdictReport,
  resolvePanicStateLabel,
  resolvePriceStructureLabel,
} from "../vite-project/src/content/ydsPanicCompositeVerdict.js"
import { buildMarketStatePriceStructureReport } from "../vite-project/src/content/ydsMarketStatePriceStructure.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const spyJson = JSON.parse(readFileSync(join(root, "vite-project/public/data/spy-daily.json"), "utf8"))
const prices = spyJson.prices
const dates = Object.keys(prices).sort()
const asOf = dates[dates.length - 1]

function buildSeries(totalDays, priceAt) {
  /** @type {Record<string, number>} */
  const out = {}
  const base = new Date("2023-01-03")
  for (let i = 0; i < totalDays; i += 1) {
    const d = new Date(base)
    d.setDate(d.getDate() + i)
    out[d.toISOString().slice(0, 10)] = priceAt(i, totalDays)
  }
  return out
}

assert.equal(resolvePanicStateLabel(46), "중립")
assert.equal(resolvePanicStateLabel(82), "극단 공포")

const neutralPanic = { vix: 18, fearGreed: 52, bofa: 5.2, putCall: 0.85, highYield: 4.1 }
const decliningPrices = buildSeries(80, (i) => 450 - i * 0.6)
const decliningAsOf = Object.keys(decliningPrices).sort().pop()

const declining = buildPanicCompositeVerdictReport(neutralPanic, {
  spyPrices: decliningPrices,
  asOfDate: decliningAsOf,
})
assert.ok(declining.psychScore != null)
assert.notEqual(declining.verdictLabel, "회복 초기")
assert.equal(declining.verdictId, "adjustmentProgress")

const fearPanic = { vix: 28, fearGreed: 22, bofa: 2.8, putCall: 1.05, highYield: 6.2 }
const supportPrices = buildSeries(80, (i) => {
  if (i < 70) return 400 + i * 0.5
  return 435 + (i - 70) * 0.8
})
const supportAsOf = Object.keys(supportPrices).sort().pop()
const support = buildPanicCompositeVerdictReport(fearPanic, {
  spyPrices: supportPrices,
  asOfDate: supportAsOf,
})
assert.ok(support.stateLabel === "공포" || support.psychScore >= 55)

const uptrendPrices = buildSeries(80, (i) => 400 + i * 0.9)
const uptrendAsOf = Object.keys(uptrendPrices).sort().pop()
const uptrend = buildPanicCompositeVerdictReport(neutralPanic, {
  spyPrices: uptrendPrices,
  asOfDate: uptrendAsOf,
})
assert.equal(uptrend.verdictId, "uptrendContinue")

const laggingPrices = buildSeries(80, (i) => {
  if (i < 50) return 110
  if (i < 65) return 110 - ((i - 50) / 14) * 16
  return 94 + ((i - 65) / 14) * 8
})
const laggingAsOf = Object.keys(laggingPrices).sort().pop()
const lagging = buildPanicCompositeVerdictReport(fearPanic, {
  spyPrices: laggingPrices,
  asOfDate: laggingAsOf,
})
assert.equal(lagging.verdictId, "laggingFear")

const priceReport = buildMarketStatePriceStructureReport({ spyPrices: prices, asOfDate: asOf })
assert.ok(resolvePriceStructureLabel(priceReport))

console.log("yds-panic-composite.test.mjs OK")
