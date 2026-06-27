import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { buildPanicPricePositionReport } from "../vite-project/src/content/ydsPanicPricePosition.js"
import {
  buildPanicCompositeVerdictReport,
  resolvePsychologyLabel,
} from "../vite-project/src/content/ydsPanicCompositeVerdict.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const spyJson = JSON.parse(readFileSync(join(root, "vite-project/public/data/spy-daily.json"), "utf8"))
const prices = spyJson.prices

const dates = Object.keys(prices).sort()
const asOf = dates[dates.length - 1]

function slicePrices(endDate, count) {
  const idx = dates.indexOf(endDate)
  const start = Math.max(0, idx - count)
  const slice = dates.slice(start, idx + 1)
  /** @type {Record<string, number>} */
  const out = {}
  for (const d of slice) out[d] = prices[d]
  return out
}

/** @param {number} totalDays @param {(i: number, total: number) => number} priceAt */
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

const lowBase = slicePrices(asOf, 80)
const lowPriceReport = buildPanicPricePositionReport({ spyPrices: lowBase, asOfDate: asOf })
assert.ok(lowPriceReport)

const panicDataFear = {
  vix: 28,
  fearGreed: 22,
  bofa: 2.8,
  putCall: 1.05,
  highYield: 6.2,
}

const panicDataGreed = {
  vix: 13,
  fearGreed: 78,
  bofa: 7.5,
  putCall: 0.62,
  highYield: 3.1,
}

const trueFearPrices = { ...lowBase }
const lastDate = Object.keys(trueFearPrices).sort().pop()
const prevDates = Object.keys(trueFearPrices).sort().slice(-25)
for (const d of prevDates) {
  trueFearPrices[d] = trueFearPrices[lastDate] * 0.88
}
trueFearPrices[lastDate] = trueFearPrices[prevDates[0]] * 0.92

const trueFear = buildPanicCompositeVerdictReport(panicDataFear, {
  spyPrices: trueFearPrices,
  asOfDate: lastDate,
})
assert.equal(trueFear.verdictId, "trueFear")
assert.equal(trueFear.buyStrength, "★★★★★")

/** 급락 후 부분 회복 — 심리는 공포, 가격은 MA20 대비 회복 */
const laggingPrices = buildSeries(80, (i) => {
  if (i < 50) return 110
  if (i < 65) return 110 - ((i - 50) / 14) * 16
  return 94 + ((i - 65) / 14) * 8
})
const laggingDates = Object.keys(laggingPrices).sort()
const laggingAsOf = laggingDates[laggingDates.length - 1]
const laggingPriceReport = buildPanicPricePositionReport({
  spyPrices: laggingPrices,
  asOfDate: laggingAsOf,
})
assert.ok(laggingPriceReport)
assert.ok((laggingPriceReport.ma20GapPct ?? 0) >= 3)

const lagging = buildPanicCompositeVerdictReport(panicDataFear, {
  spyPrices: laggingPrices,
  asOfDate: laggingAsOf,
})
assert.equal(lagging.verdictId, "laggingFear")
assert.equal(lagging.buyStrength, "★★☆☆☆")
assert.ok(lagging.narrative.some((line) => /추격/.test(line)))

const overheatPrices = buildSeries(80, (i) => 100 + (i / 79) * 20)
const overheatDates = Object.keys(overheatPrices).sort()
const overheatAsOf = overheatDates[overheatDates.length - 1]

const overheat = buildPanicCompositeVerdictReport(panicDataGreed, {
  spyPrices: overheatPrices,
  asOfDate: overheatAsOf,
})
assert.equal(overheat.verdictId, "overheat")

assert.equal(resolvePsychologyLabel(82), "인생 타점")

console.log("yds-panic-composite.test.mjs OK")
