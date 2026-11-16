import { describe, expect, it } from "vitest"
import { isProUnlocked, MEMBERSHIP_STATUS } from "./ydsMembership.js"
import {
  allowLocalPanicHistoryFallbackOnApiError,
  allowLocalPanicHistoryMergeAfterHubFetch,
  buildPanicCenterVisibility,
  PANIC_LAB_PRO_LOCK_COPY,
  resolvePanicHistoryRowsForProFeature,
} from "./ydsMarketAnalysisProGate.js"

describe("market-analysis panic detailAccess gate", () => {
  it("locks history/drivers/dca unless detailAccess is true", () => {
    for (const status of [
      MEMBERSHIP_STATUS.LOGGED_OUT,
      MEMBERSHIP_STATUS.LOADING,
      MEMBERSHIP_STATUS.FREE,
      MEMBERSHIP_STATUS.ERROR,
    ]) {
      // Billing isPro stays false for non-PRO; gate must use detailAccess, not isPro alone.
      expect(isProUnlocked(status)).toBe(false)
      const v = buildPanicCenterVisibility(false)
      expect(v.freeHero).toBe(true)
      expect(v.freeFearScale).toBe(true)
      expect(v.proHistoryChart).toBe(false)
      expect(v.proDriversDetail).toBe(false)
      expect(v.proDcaGuidance).toBe(false)
    }
  })

  it("opens detail sections when detailAccess is true (ledger PRO)", () => {
    expect(isProUnlocked(MEMBERSHIP_STATUS.PRO)).toBe(true)
    const v = buildPanicCenterVisibility(true)
    expect(v.proHistoryChart).toBe(true)
    expect(v.proDriversDetail).toBe(true)
    expect(v.proDcaGuidance).toBe(true)
  })

  it("opens detail sections for operator: plan free / isPro false / detailAccess true", () => {
    expect(isProUnlocked(MEMBERSHIP_STATUS.FREE)).toBe(false)
    const v = buildPanicCenterVisibility(true)
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

  it("Panic Lab reuses proHistoryChart (locked without detailAccess)", () => {
    expect(buildPanicCenterVisibility(false).proHistoryChart).toBe(false)
    expect(buildPanicCenterVisibility(true).proHistoryChart).toBe(true)
    expect(PANIC_LAB_PRO_LOCK_COPY.title).toBeTruthy()
    expect(PANIC_LAB_PRO_LOCK_COPY.body).toMatch(/패닉 연구실|Panic Lab/)
  })

  it("FREE cannot feed local/store history into detail Lab/history consumers", () => {
    const localRows = [{ date: "2026-01-01", vix: 20 }, { date: "2026-01-02", vix: 22 }]
    expect(resolvePanicHistoryRowsForProFeature(localRows, false)).toEqual([])
    expect(resolvePanicHistoryRowsForProFeature(localRows, true)).toEqual(localRows)
    expect(resolvePanicHistoryRowsForProFeature(null, true)).toEqual([])
  })

  it("blocks localStorage merge into store when hub returns pro_required", () => {
    expect(allowLocalPanicHistoryMergeAfterHubFetch("pro_required")).toBe(false)
    expect(allowLocalPanicHistoryMergeAfterHubFetch(null)).toBe(true)
    expect(allowLocalPanicHistoryMergeAfterHubFetch("api_empty")).toBe(true)
  })

  it("api_error LS→store fallback is detailAccess-only (fail-closed for FREE/loading/unknown)", () => {
    expect(allowLocalPanicHistoryFallbackOnApiError(true)).toBe(true)
    expect(allowLocalPanicHistoryFallbackOnApiError(false)).toBe(false)
    expect(allowLocalPanicHistoryFallbackOnApiError(undefined)).toBe(false)
    expect(allowLocalPanicHistoryFallbackOnApiError(null)).toBe(false)
    // @ts-expect-error intentional misuse
    expect(allowLocalPanicHistoryFallbackOnApiError("pro")).toBe(false)
    const localRows = [{ date: "2026-01-01", vix: 20 }]
    expect(resolvePanicHistoryRowsForProFeature(localRows, false)).toEqual([])
    expect(resolvePanicHistoryRowsForProFeature(localRows, true)).toEqual(localRows)
  })
})
