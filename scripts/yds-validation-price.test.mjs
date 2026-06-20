import assert from "node:assert/strict"
import { addCalendarDays } from "../vite-project/src/content/ydsValidationEngine.js"
import { isValidationDummyPrice } from "../vite-project/src/content/ydsValidationPriceSanitize.js"

/** @param {Record<string, number>} priceLog @param {string} recommendedAt @param {number} horizonDays @param {string} today @param {number | null} recommendPrice @param {'US'|'KR'} country */
function resolveHorizonLockPrice(priceLog, recommendedAt, horizonDays, today, recommendPrice, country) {
  const targetDate = addCalendarDays(recommendedAt, horizonDays)
  if (today < targetDate) return { price: null, targetDate, lookupOk: false, source: "pending" }

  const onOrAfter = Object.keys(priceLog)
    .filter((d) => d >= targetDate)
    .sort()
  for (const d of onOrAfter) {
    const p = priceLog[d]
    if (p != null && Number.isFinite(p) && p > 0 && !isValidationDummyPrice(p, recommendPrice, country)) {
      return { price: p, targetDate, lookupOk: true, source: "priceLog-on-or-after" }
    }
  }

  return { price: null, targetDate, lookupOk: false, source: "none" }
}

const r2 = resolveHorizonLockPrice(
  { "2026-06-01": 250, "2026-06-10": 100 },
  "2026-06-01",
  7,
  "2026-06-10",
  250,
  "US",
)
assert.equal(r2.price, null, "skips dummy 100 in priceLog")

console.log("yds-validation-price.test.mjs OK")
