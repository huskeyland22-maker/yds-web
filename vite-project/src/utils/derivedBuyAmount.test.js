import { describe, expect, it } from "vitest"
import { derivedBuyAmountUsdText, restoredShareCount } from "./derivedBuyAmount.js"

describe("derivedBuyAmountUsdText", () => {
  it("computes ETF amount to cents: 216.17 × 5 = 1080.85", () => {
    expect(derivedBuyAmountUsdText("216.17", "5")).toBe("1080.85")
    expect(derivedBuyAmountUsdText(216.17, 5)).toBe("1080.85")
  })

  it("computes 216.17 × 10 = 2161.70", () => {
    expect(derivedBuyAmountUsdText("216.17", "10")).toBe("2161.70")
  })

  it("returns empty instead of NaN for incomplete or invalid input", () => {
    expect(derivedBuyAmountUsdText("", "5")).toBe("")
    expect(derivedBuyAmountUsdText("216.17", "")).toBe("")
    expect(derivedBuyAmountUsdText("abc", "5")).toBe("")
    expect(derivedBuyAmountUsdText("216.17", "x")).toBe("")
    expect(derivedBuyAmountUsdText("-1", "5")).toBe("")
    expect(derivedBuyAmountUsdText("216.17", "0")).toBe("")
    expect(derivedBuyAmountUsdText(null, 5)).toBe("")
  })

  it("recomputes when price or shares change", () => {
    expect(derivedBuyAmountUsdText("100", "5")).toBe("500.00")
    expect(derivedBuyAmountUsdText("100.25", "5")).toBe("501.25")
    expect(derivedBuyAmountUsdText("100.25", "6")).toBe("601.50")
  })
})

describe("restoredShareCount", () => {
  it("prefers stored shares when editing", () => {
    expect(restoredShareCount({ shares: 5, buyPrice: 216.17, buyAmountUsd: 1080 })).toBe(5)
  })

  it("recovers shares from price and amount when shares missing", () => {
    expect(restoredShareCount({ shares: null, buyPrice: 216.17, buyAmountUsd: 1080.85 })).toBe(5)
  })
})
