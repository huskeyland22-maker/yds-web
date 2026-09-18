import { describe, expect, it } from "vitest"
import { resolvePanicBottomDcaSignal } from "./panicBottomDcaSignal.js"

describe("resolvePanicBottomDcaSignal", () => {
  it("returns null for invalid score", () => {
    expect(resolvePanicBottomDcaSignal(null)).toBeNull()
    expect(resolvePanicBottomDcaSignal(undefined)).toBeNull()
    expect(resolvePanicBottomDcaSignal(Number.NaN)).toBeNull()
  })

  it("wait below 50", () => {
    expect(resolvePanicBottomDcaSignal(49)).toMatchObject({
      stage: 0,
      id: "wait",
      addPct: 0,
      cumulativePct: 0,
    })
    expect(resolvePanicBottomDcaSignal(0)?.id).toBe("wait")
  })

  it("1st buy at 50–59 → 40%", () => {
    expect(resolvePanicBottomDcaSignal(50)).toMatchObject({
      stage: 1,
      id: "buy1",
      addPct: 40,
      cumulativePct: 40,
    })
    expect(resolvePanicBottomDcaSignal(56)).toMatchObject({ stage: 1, cumulativePct: 40 })
    expect(resolvePanicBottomDcaSignal(59)).toMatchObject({ stage: 1, cumulativePct: 40 })
  })

  it("2nd buy at 60–69 → +27% / 67%", () => {
    expect(resolvePanicBottomDcaSignal(60)).toMatchObject({
      stage: 2,
      id: "buy2",
      addPct: 27,
      cumulativePct: 67,
    })
    expect(resolvePanicBottomDcaSignal(64)).toMatchObject({ stage: 2, cumulativePct: 67 })
    expect(resolvePanicBottomDcaSignal(69)).toMatchObject({ stage: 2, cumulativePct: 67 })
  })

  it("3rd buy at 70+ → +33% / 100%", () => {
    expect(resolvePanicBottomDcaSignal(70)).toMatchObject({
      stage: 3,
      id: "buy3",
      addPct: 33,
      cumulativePct: 100,
    })
    expect(resolvePanicBottomDcaSignal(74)).toMatchObject({ stage: 3, cumulativePct: 100 })
    expect(resolvePanicBottomDcaSignal(100)).toMatchObject({ stage: 3, cumulativePct: 100 })
  })
})
