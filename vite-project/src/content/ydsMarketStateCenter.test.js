import { describe, expect, it } from "vitest"
import {
  getMarketStatePickLimit,
  getPanicBuyIntensityPct,
  MARKET_STATE_STRATEGY,
} from "./ydsMarketStateCenter.js"

describe("market state center", () => {
  it("maps position to pick limits", () => {
    expect(getMarketStatePickLimit("overheat")).toBe(5)
    expect(getMarketStatePickLimit("boundary")).toBe(10)
    expect(getMarketStatePickLimit("adjustment")).toBe(20)
    expect(getMarketStatePickLimit("fear")).toBe(50)
    expect(getMarketStatePickLimit("panic")).toBe(Infinity)
  })

  it("maps panic macro to buy intensity", () => {
    expect(getPanicBuyIntensityPct("interest")).toBe(20)
    expect(getPanicBuyIntensityPct("dca")).toBe(50)
    expect(getPanicBuyIntensityPct("overheated")).toBe(0)
  })

  it("adjustment zone has expected actions", () => {
    expect(MARKET_STATE_STRATEGY.adjustment.actions).toContain("추격 금지")
    expect(MARKET_STATE_STRATEGY.adjustment.strategy).toBe("관심 종목 발굴")
  })
})
