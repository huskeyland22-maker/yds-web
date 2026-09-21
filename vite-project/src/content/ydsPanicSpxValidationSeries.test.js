import { describe, expect, it } from "vitest"
import {
  formatPanicSpxValidationSummary,
  resolveBottomWindowDomain,
} from "./ydsPanicSpxValidationSeries.js"

const sample = {
  generatedAt: "2026-09-21T00:00:00Z",
  sourceNote: "market-source",
  span: ["2023-01-03", "2026-09-18"],
  missingPanicDates: ["2026-03-12", "2026-09-18"],
  summary: {
    n: 9,
    hit50: 8,
    hit60: 4,
    hit70: 3,
    avg_panic_peak: 64.2,
    avg_peak_lag_td: -0.8,
  },
  bottoms: [],
  rows: [
    { date: "2025-03-01", spx: 1, panic: 40 },
    { date: "2025-03-04", spx: 1, panic: 50 },
    { date: "2025-03-13", spx: 1, panic: 55 },
    { date: "2025-03-20", spx: 1, panic: 45 },
  ],
}

describe("ydsPanicSpxValidationSeries", () => {
  it("formats summary without overclaim wording", () => {
    const view = formatPanicSpxValidationSummary(sample)
    expect(view?.headline).toBe("주요 저점 9건 기준")
    expect(view?.lines[0]).toBe("Panic ≥50: 8/9")
    expect(view?.note).toContain("희소한 추가 진입")
    expect(view?.note).not.toMatch(/검증 완료|확정/)
  })

  it("resolves D-20..D+5 domain around a bottom", () => {
    const domain = resolveBottomWindowDomain(sample, "2025-03-13", 2, 1)
    expect(domain).toEqual(["2025-03-01", "2025-03-20"])
  })

  it("returns null for unknown bottom", () => {
    expect(resolveBottomWindowDomain(sample, "2099-01-01")).toBeNull()
  })
})
