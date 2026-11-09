import { describe, expect, it } from "vitest"
import { isProUnlocked, MEMBERSHIP_STATUS } from "./ydsMembership.js"
import { buildPanicCenterVisibility } from "./ydsMarketAnalysisProGate.js"

describe("market-analysis panic PRO gate", () => {
  it("locks history/drivers/dca unless membership is PRO", () => {
    for (const status of [
      MEMBERSHIP_STATUS.LOGGED_OUT,
      MEMBERSHIP_STATUS.LOADING,
      MEMBERSHIP_STATUS.FREE,
      MEMBERSHIP_STATUS.ERROR,
    ]) {
      const isPro = isProUnlocked(status)
      const v = buildPanicCenterVisibility(isPro)
      expect(v.freeHero).toBe(true)
      expect(v.freeFearScale).toBe(true)
      expect(v.proHistoryChart).toBe(false)
      expect(v.proDriversDetail).toBe(false)
      expect(v.proDcaGuidance).toBe(false)
    }
  })

  it("opens PRO sections only when isPro is true", () => {
    const v = buildPanicCenterVisibility(isProUnlocked(MEMBERSHIP_STATUS.PRO))
    expect(v.proHistoryChart).toBe(true)
    expect(v.proDriversDetail).toBe(true)
    expect(v.proDcaGuidance).toBe(true)
  })

  it("never treats a bare true-ish non-boolean as unlock", () => {
    // @ts-expect-error intentional misuse
    expect(buildPanicCenterVisibility("pro").proHistoryChart).toBe(false)
    // @ts-expect-error intentional misuse
    expect(buildPanicCenterVisibility(1).proHistoryChart).toBe(false)
  })

  it("trade-record DCA guidance shares the same proDcaGuidance flag as hero", () => {
    expect(buildPanicCenterVisibility(false).proDcaGuidance).toBe(false)
    expect(buildPanicCenterVisibility(true).proDcaGuidance).toBe(true)
  })
})
