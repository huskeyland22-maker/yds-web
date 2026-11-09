import { describe, expect, it } from "vitest"
import { buildDailyBottomBuyVisibility } from "./ydsDailyBottomBuyProGate.js"
import { isProUnlocked, MEMBERSHIP_STATUS } from "./ydsMembership.js"

describe("daily-bottom-buy ETF PRO gate", () => {
  it("locks detail blocks unless membership is PRO", () => {
    for (const status of [
      MEMBERSHIP_STATUS.LOGGED_OUT,
      MEMBERSHIP_STATUS.LOADING,
      MEMBERSHIP_STATUS.FREE,
      MEMBERSHIP_STATUS.ERROR,
    ]) {
      const v = buildDailyBottomBuyVisibility(isProUnlocked(status))
      expect(v.freeOpportunitySummary).toBe(true)
      expect(v.proOpportunityMetrics).toBe(false)
      expect(v.proConditions).toBe(false)
      expect(v.proScoreDetail).toBe(false)
      expect(v.proSplitActions).toBe(false)
    }
  })

  it("opens detail blocks for PRO", () => {
    const v = buildDailyBottomBuyVisibility(isProUnlocked(MEMBERSHIP_STATUS.PRO))
    expect(v.proOpportunityMetrics).toBe(true)
    expect(v.proConditions).toBe(true)
    expect(v.proScoreDetail).toBe(true)
    expect(v.proSplitActions).toBe(true)
  })
})
