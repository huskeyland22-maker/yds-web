import assert from "node:assert/strict"
import {
  isValidationDummyPrice,
  sanitizeValidationPriceLog,
} from "../vite-project/src/content/ydsValidationPriceSanitize.js"

assert.equal(isValidationDummyPrice(100, 875, "US"), true)
assert.equal(isValidationDummyPrice(100, 98, "US"), false)
assert.equal(isValidationDummyPrice(100, 55000, "KR"), true)

const log = sanitizeValidationPriceLog(
  { "2026-06-01": 250, "2026-06-10": 100 },
  250,
  "US",
)
assert.equal(log["2026-06-10"], undefined)
assert.equal(log["2026-06-01"], 250)

console.log("yds-validation-price-sanitize.test.mjs OK")
