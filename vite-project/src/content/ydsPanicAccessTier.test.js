import { describe, expect, it } from "vitest"
import { normalizePanicAccessTier } from "./ydsPanicAccessTier.js"
import { isProUnlocked, MEMBERSHIP_STATUS } from "./ydsMembership.js"

describe("ydsPanicAccessTier", () => {
  it("maps free/full and remaps legacy pro label to full", () => {
    expect(normalizePanicAccessTier("free")).toBe("free")
    expect(normalizePanicAccessTier("full")).toBe("full")
    expect(normalizePanicAccessTier("pro")).toBe("full")
    expect(normalizePanicAccessTier(undefined)).toBe("full")
    expect(normalizePanicAccessTier(null)).toBe("full")
  })

  it("does not grant membership PRO from payload tier labels", () => {
    // Payload markers must never be treated as membership status.
    expect(isProUnlocked(normalizePanicAccessTier("pro"))).toBe(false)
    expect(isProUnlocked(normalizePanicAccessTier("full"))).toBe(false)
    expect(isProUnlocked(MEMBERSHIP_STATUS.PRO)).toBe(true)
  })
})
