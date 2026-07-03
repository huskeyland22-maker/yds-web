import { describe, expect, it } from "vitest"
import {
  formatRecommendProfitLabel,
  resolveLockedRecommendPrice,
  resolveRecommendProfitPct,
} from "./ydsRecommendProfitResolver.js"

describe("ydsRecommendProfitResolver", () => {
  it("keeps locked recommend price from priceLog when field missing", () => {
    const price = resolveLockedRecommendPrice({
      recommendedAt: "2026-07-01",
      recommendedPrice: null,
      priceLog: { "2026-07-01": 150.25 },
    })
    expect(price).toBe(150.25)
  })

  it("calculates profit from locked recommend and current price", () => {
    const pick = {
      recommendedAt: "2026-07-01",
      recommendedPrice: 100,
      currentPrice: 110,
      returnPct: null,
      priceLog: { "2026-07-01": 100 },
    }
    const stock = { snapshot: { price: 110 } }
    expect(resolveRecommendProfitPct(pick, stock)).toBeCloseTo(10, 5)
  })

  it("returns null profit when recommend price missing", () => {
    expect(
      resolveRecommendProfitPct(null, { snapshot: { price: 120 } }),
    ).toBeNull()
    expect(formatRecommendProfitLabel(null)).toBe("계산 불가")
  })

  it("does not show zero percent when prices unavailable", () => {
    expect(formatRecommendProfitLabel(0)).toBe("0.0%")
    expect(formatRecommendProfitLabel(null)).toBe("계산 불가")
  })
})
