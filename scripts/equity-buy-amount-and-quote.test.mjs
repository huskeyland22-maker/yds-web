/**
 * node --test scripts/equity-buy-amount-and-quote.test.mjs
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import {
  attachHoldingQuote,
  collectDbbBuyProgress,
  equityViewProgressEntry,
  holdingQuoteAsOf,
} from "../vite-project/src/content/ydsDbbBuyProgress.js"
import { upsertTradeRecord } from "../vite-project/src/content/ydsTradeRecords.js"
import { derivedBuyAmountUsdText, restoredShareCount } from "../vite-project/src/utils/derivedBuyAmount.js"

const root = dirname(fileURLToPath(import.meta.url))

function installLocalStorage() {
  const store = new Map()
  globalThis.localStorage = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null
    },
    setItem(key, value) {
      store.set(key, String(value))
    },
    removeItem(key) {
      store.delete(key)
    },
  }
}

describe("derived buy amount", () => {
  it("multiplies price by shares and stays blank when either input is not positive", () => {
    assert.equal(derivedBuyAmountUsdText(200000, 5), "1000000.00")
    assert.equal(derivedBuyAmountUsdText("81.25", "4"), "325.00")
    assert.equal(derivedBuyAmountUsdText("10.005", "2"), "20.01")
    assert.equal(derivedBuyAmountUsdText("", 5), "")
    assert.equal(derivedBuyAmountUsdText(200, ""), "")
    assert.equal(derivedBuyAmountUsdText(0, 5), "")
    assert.equal(derivedBuyAmountUsdText(200, 0), "")
    assert.equal(derivedBuyAmountUsdText(-1, 5), "")
    assert.equal(derivedBuyAmountUsdText(200, -2), "")
  })

  it("restores stored shares, and recovers quantity from price and amount when shares were not stored", () => {
    assert.equal(restoredShareCount({ buyPrice: 81.25, shares: 4, buyAmountUsd: 325 }), 4)
    assert.equal(restoredShareCount({ buyPrice: 200, shares: null, buyAmountUsd: 1000 }), 5)
    assert.equal(restoredShareCount({ buyPrice: 200, buyAmountUsd: 1000 }), 5)
    assert.equal(derivedBuyAmountUsdText(200, restoredShareCount({ buyPrice: 200, buyAmountUsd: 1000 })), "1000.00")
    assert.equal(restoredShareCount({ buyPrice: 0, buyAmountUsd: 1000 }), null)
  })
})

describe("holding quote on an unscored card", () => {
  it("adds price and return without replacing a scored card", () => {
    installLocalStorage()
    upsertTradeRecord({
      system: "dbb",
      symbol: "NEE",
      buyDate: "2026-10-01",
      buyPrice: 80,
      buyAmountUsd: 400,
      shares: 5,
      weightPct: 50,
    })
    upsertTradeRecord({
      system: "dbb",
      symbol: "AAPL",
      buyDate: "2026-10-01",
      buyPrice: 200,
      buyAmountUsd: 1000,
      shares: 5,
      weightPct: 50,
    })
    const unscored = collectDbbBuyProgress([
      equityViewProgressEntry({ symbol: "NEE", name: "NextEra Energy" }, { ok: false, symbol: "NEE" }),
    ])[0]
    assert.equal(unscored.statusView, null)
    const quoted = attachHoldingQuote(unscored, {
      price: 100,
      updatedAt: "2026-10-12T20:00:00.000Z",
    })
    assert.equal(quoted.statusView, null)
    assert.equal(quoted.quotePrice, 100)
    assert.equal(quoted.quoteAsOf, "2026-10-12")
    assert.equal(quoted.avgBuyPrice, 80)
    assert.equal(quoted.quoteReturnPct, 25)
    assert.equal(attachHoldingQuote(unscored, { price: 0 }).quotePrice, undefined)
    assert.equal(attachHoldingQuote(unscored, null).quotePrice, undefined)

    const scored = collectDbbBuyProgress([
      equityViewProgressEntry(
        { symbol: "AAPL", name: "Apple" },
        { ok: true, symbol: "AAPL", score: 0, price: 210, asOf: "2026-10-09", state: { label: "WAIT" } },
      ),
    ])[0]
    const untouched = attachHoldingQuote(scored, { price: 999, updatedAt: "2026-10-12T20:00:00.000Z" })
    assert.equal(untouched, scored)
    assert.equal(untouched.statusView.currentPrice, 210)
    assert.equal(untouched.statusView.signalLabel, "0/4")
    assert.equal(untouched.quotePrice, undefined)
    assert.equal(holdingQuoteAsOf(""), null)
    assert.equal(holdingQuoteAsOf("not-a-date"), null)
  })
})

describe("equity page wiring", () => {
  it("derives the equity amount and quotes only the held names", () => {
    const page = readFileSync(join(root, "../vite-project/src/pages/EquityDailyBottomBuyPage.jsx"), "utf8")
    const etf = readFileSync(join(root, "../vite-project/src/pages/DailyBottomBuyPage.jsx"), "utf8")
    assert.match(page, /deriveAmount/)
    assert.match(page, /fetchPortfolioQuotes/)
    assert.match(page, /attachHoldingQuote/)
    assert.match(page, /EQUITY_HOLDING_DISPLAY/)
    assert.doesNotMatch(etf, /deriveAmount/)
    assert.doesNotMatch(etf, /attachHoldingQuote/)
  })
})
