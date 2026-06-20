import assert from "node:assert/strict"
import { addCalendarDays } from "../vite-project/src/content/ydsValidationEngine.js"

/** @param {Record<string, number>} priceLog @param {string} recommendedAt @param {number} horizonDays @param {string} today */
function resolveHorizonLockPrice(priceLog, recommendedAt, horizonDays, today) {
  const targetDate = addCalendarDays(recommendedAt, horizonDays)
  if (today < targetDate) return { price: null, targetDate, lookupOk: false }

  const exact = priceLog[targetDate]
  if (exact != null && Number.isFinite(exact) && exact > 0) {
    return { price: exact, targetDate, lookupOk: true }
  }

  const onOrAfter = Object.keys(priceLog)
    .filter((d) => d >= targetDate)
    .sort()
  for (const d of onOrAfter) {
    const p = priceLog[d]
    if (p != null && Number.isFinite(p) && p > 0) {
      return { price: p, targetDate, lookupOk: true }
    }
  }

  return { price: null, targetDate, lookupOk: false }
}

const log = {
  "2026-06-01": 250,
  "2026-06-10": 100,
}
const r1 = resolveHorizonLockPrice(log, "2026-06-01", 7, "2026-06-10")
assert.equal(r1.price, 100, "uses priceLog on/after target, not arbitrary fallback")

const r2 = resolveHorizonLockPrice({ "2026-06-01": 250 }, "2026-06-01", 7, "2026-06-10")
assert.equal(r2.price, null, "no currentPrice fallback when log missing target")

console.log("yds-validation-price.test.mjs OK")
