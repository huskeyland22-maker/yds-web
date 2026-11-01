/**
 * P2-17 — createDailyReport Official panic_score gate (no Legacy getFinalScore)
 */
import { describe, expect, it } from "vitest"
import { createDailyReport } from "../../../api/_lib/dailyReportEngine.js"
import {
  getLegacyPanicScore,
  getOfficialPanicScore,
} from "./tradingScores.js"

const FULL = { vix: 22.22, fearGreed: 27, putCall: 0.71, bofa: 6.6, highYield: 2.82 }
/** Official === 50 (distinct from Legacy fill-50 / empty Legacy) */
const OFFICIAL_50 = { vix: 12, fearGreed: 15, putCall: 1.39, bofa: 5, highYield: 4 }
/** Core incomplete — Legacy still numeric */
const PARTIAL_MISS_VIX = { fearGreed: 45, putCall: 0.9, bofa: 5, highYield: 4 }
const EMPTY = {}

describe("createDailyReport Official gate (P2-17)", () => {
  it("partial core: Official null — does not persist Legacy score or fake panic copy", () => {
    expect(getOfficialPanicScore(PARTIAL_MISS_VIX)).toBeNull()
    const legacy = getLegacyPanicScore(PARTIAL_MISS_VIX)
    expect(Number.isFinite(legacy)).toBe(true)

    const report = createDailyReport(PARTIAL_MISS_VIX, null, "2026-01-15")
    expect(report).not.toBeNull()
    expect(report.panic_score).toBeNull()
    expect(report.panic_score_status).toBe("data_insufficient")
    expect(report.panic_score).not.toBe(legacy)
    expect(String(report.market_view ?? "")).not.toMatch(/패닉\s*\d+|패닉지수\s*\d+/)
  })

  it("ignores cycleRow.panic_score Legacy cache when Official is missing", () => {
    const report = createDailyReport(
      PARTIAL_MISS_VIX,
      { date: "2026-01-15", panic_score: 48, market_state: "neutral", recommendation: "중립" },
      "2026-01-15",
    )
    expect(report).not.toBeNull()
    expect(report.panic_score).toBeNull()
    expect(String(report.market_view ?? "")).not.toMatch(/패닉\s*48/)
    expect(String(report.market_view ?? "")).toMatch(/중립|neutral/i)
  })

  it("empty metrics: still returns null (base report insufficient) without inventing 50", () => {
    expect(getOfficialPanicScore(EMPTY)).toBeNull()
    expect(getLegacyPanicScore(EMPTY)).toBe(50)
    expect(createDailyReport(EMPTY, null, "2026-01-15")).toBeNull()
  })

  it("complete core: Official score and matching market_view", () => {
    const official = getOfficialPanicScore(FULL)
    expect(official).toBe(42)
    const report = createDailyReport(FULL, null, "2026-01-15")
    expect(report).not.toBeNull()
    expect(report.panic_score).toBe(official)
    expect(report.panic_score_status).toBe("ok")
    expect(report.market_view).toContain(String(official))
    expect(report.summary).toBeTruthy()
  })

  it("Official score 50 is kept as real score (not treated as missing)", () => {
    expect(getOfficialPanicScore(OFFICIAL_50)).toBe(50)
    expect(getLegacyPanicScore(OFFICIAL_50)).not.toBe(50)

    const report = createDailyReport(OFFICIAL_50, null, "2026-01-15")
    expect(report).not.toBeNull()
    expect(report.panic_score).toBe(50)
    expect(report.market_view).toMatch(/패닉지수\s*50|패닉\s*50/)
  })

  it("panic_score and market_view stay consistent when cycle has stale score", () => {
    const official = getOfficialPanicScore(FULL)
    const report = createDailyReport(
      FULL,
      { date: "2026-01-15", panic_score: 99, market_state: "fear_dominant" },
      "2026-01-15",
    )
    expect(report.panic_score).toBe(official)
    expect(report.market_view).toContain(String(official))
    expect(report.market_view).not.toContain("99")
  })
})
