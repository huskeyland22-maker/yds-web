import { describe, expect, it } from "vitest"
import {
  applyMutablePickUpdate,
  formatRecommendAtIso,
  generateRecommendLedgerId,
  hasAutoCapturePickToday,
  isPickImmutableSealed,
  mapLifecycleToLedgerState,
  migratePickToRecommendLedger,
  repairImmutableLedgerRecord,
  resolveImmutableRecommendedPrice,
  sealNewRecommendLedgerRecord,
} from "./ydsRecommendLedger.js"

const basePick = () => ({
  id: "legacy-amd",
  ticker: "AMD",
  name: "AMD",
  country: "US",
  rank: 1,
  isTop3: true,
  recommendedAt: "2026-07-01",
  recommendedPrice: 150,
  recommendedScore: 88,
  currentPrice: 155,
  returnPct: 3.3,
  lifecycleId: "active",
  statusId: "recommended",
  qualityGrade: "A",
  timingGrade: "B+",
  recommendSnapshot: {
    frozen: true,
    capturedAt: 1,
    name: "AMD",
    totalScore: 88,
    qualityGrade: "A",
    timingGrade: "B+",
  },
})

describe("ydsRecommendLedger", () => {
  it("generates unique ledger ids per event", () => {
    const a = generateRecommendLedgerId("US", "AMD", 1000)
    const b = generateRecommendLedgerId("US", "AMD", 2000)
    expect(a).toMatch(/^rec-1000-US-AMD$/)
    expect(b).not.toBe(a)
  })

  it("formats recommend datetime as YYYY-MM-DD HH:mm:ss", () => {
    const iso = formatRecommendAtIso(Date.UTC(2026, 6, 1, 3, 4, 5))
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })

  it("seals immutable recommend price and metadata", () => {
    const sealed = sealNewRecommendLedgerRecord(basePick(), null, null)
    expect(sealed.immutableSealed).toBe(true)
    expect(sealed.lockedRecommendedPrice).toBe(150)
    expect(sealed.recommendedAtIso).toMatch(/^\d{4}-\d{2}-\d{2} /)
    expect(sealed.recommendReason).toBeTruthy()
    expect(sealed.recommendGrade).toContain("A")
  })

  it("applyMutablePickUpdate preserves locked recommend price", () => {
    const sealed = sealNewRecommendLedgerRecord(basePick(), null, null)
    const updated = applyMutablePickUpdate(sealed, {
      currentPrice: 170,
      returnPct: 13.3,
      maxReturnPct: 15,
      minReturnPct: -2,
    })
    expect(updated.recommendedPrice).toBe(150)
    expect(updated.currentPrice).toBe(170)
    expect(updated.returnPct).toBe(13.3)
    expect(updated.maxReturnPct).toBe(15)
    expect(updated.minReturnPct).toBe(-2)
  })

  it("repairs polluted sealed recommend price from price log", () => {
    const sealed = sealNewRecommendLedgerRecord(basePick(), null, null)
    const polluted = {
      ...sealed,
      recommendedPrice: 190,
      lockedRecommendedPrice: null,
      recommendSnapshot: {
        ...sealed.recommendSnapshot,
        recommendedPrice: 150,
      },
      marketLedger: {
        ...(sealed.marketLedger ?? {}),
        recommendedPrice: 150,
      },
    }
    const repaired = repairImmutableLedgerRecord(polluted, "test")
    expect(resolveImmutableRecommendedPrice(polluted)).toBe(150)
    expect(repaired.recommendedPrice).toBe(150)
    expect(repaired.lockedRecommendedPrice).toBe(150)
  })

  it("migratePickToRecommendLedger is idempotent", () => {
    const once = migratePickToRecommendLedger(basePick())
    const twice = migratePickToRecommendLedger(once)
    expect(twice.id).toBe(once.id)
    expect(twice.immutableSealed).toBe(true)
  })

  it("maps lifecycle to ledger state", () => {
    expect(mapLifecycleToLedgerState("active", "recommended")).toBe("active")
    expect(mapLifecycleToLedgerState("targetHit", "recommended")).toBe("ended")
    expect(mapLifecycleToLedgerState("active", "excluded")).toBe("excluded")
  })

  it("detects sealed picks", () => {
    const sealed = sealNewRecommendLedgerRecord(basePick(), null, null)
    expect(isPickImmutableSealed(sealed)).toBe(true)
    expect(isPickImmutableSealed(basePick())).toBe(false)
  })

  it("allows re-recommend on different days", () => {
    const existing = [
      { country: "US", ticker: "AMD", recommendedAt: "2026-07-01" },
    ]
    expect(hasAutoCapturePickToday(existing, "US", "AMD", "2026-07-01")).toBe(true)
    expect(hasAutoCapturePickToday(existing, "US", "AMD", "2026-07-15")).toBe(false)
  })
})
