import { describe, expect, it } from "vitest"
import { buildTodayMarketMemo } from "./ydsTodayMarketMemo.js"
import { buildAiReportMarketStatus } from "../utils/buildAiReportMarketStatus.js"
import { getOfficialPanicScore, getLegacyPanicScore } from "../utils/tradingScores.js"

const FULL = { vix: 22.22, fearGreed: 27, putCall: 0.71, bofa: 6.6, highYield: 2.82 }
const PARTIAL_MISS_VIX = { fearGreed: 45, putCall: 0.9, bofa: 5, highYield: 4 }
const EMPTY = {}

describe("buildTodayMarketMemo Official gate (P2-14)", () => {
  it("returns null for empty object (no Legacy 50 memo)", () => {
    expect(getOfficialPanicScore(EMPTY)).toBeNull()
    expect(getLegacyPanicScore(EMPTY)).toBe(50)
    expect(buildTodayMarketMemo(EMPTY)).toBeNull()
    const ai = buildAiReportMarketStatus(EMPTY)
    expect(ai.ready).toBe(false)
  })

  it("returns null when core metric missing (no Legacy substitute score)", () => {
    expect(getOfficialPanicScore(PARTIAL_MISS_VIX)).toBeNull()
    expect(getLegacyPanicScore(PARTIAL_MISS_VIX)).toBeGreaterThan(0)
    expect(buildTodayMarketMemo(PARTIAL_MISS_VIX)).toBeNull()
    const ai = buildAiReportMarketStatus(PARTIAL_MISS_VIX)
    expect(ai.ready).toBe(false)
    expect(ai.memoLines.join(" ")).not.toMatch(/패닉 강도는/)
  })

  it("keeps score-based memo when Official is available", () => {
    const official = getOfficialPanicScore(FULL)
    expect(official).not.toBeNull()
    const memo = buildTodayMarketMemo(FULL)
    expect(memo).not.toBeNull()
    expect(memo.lines.some((l) => l.includes(String(official)))).toBe(true)
    const ai = buildAiReportMarketStatus(FULL)
    expect(ai.ready).toBe(true)
  })

  it("returns null for nullish panicData", () => {
    expect(buildTodayMarketMemo(null)).toBeNull()
    expect(buildTodayMarketMemo(undefined)).toBeNull()
  })
})
