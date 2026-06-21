import assert from "node:assert/strict"
import {
  PORTFOLIO_CANONICAL_KEYS,
  PORTFOLIO_LEGACY_ALIAS_KEYS,
  countPortfolioKeyItems,
} from "../vite-project/src/content/ydsPortfolioKeyRegistry.js"

assert.ok(PORTFOLIO_CANONICAL_KEYS.includes("yds-portfolio-trades-v1"))
assert.ok(!PORTFOLIO_LEGACY_ALIAS_KEYS.includes("yds-portfolio-trades-v1"))

const arr = countPortfolioKeyItems(JSON.stringify([{ name: "a" }, { name: "b" }]))
assert.equal(arr.count, 2)

const wrapped = countPortfolioKeyItems(JSON.stringify({ trades: [{ id: "1" }] }))
assert.equal(wrapped.count, 1)

console.log("yds-portfolio-key-registry.test.mjs OK")
