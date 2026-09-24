import { describe, expect, it } from "vitest"
import {
  additionalDrawdownToBottom,
  buildPanicEntryTimingTable,
  firstPanicReachInWindow,
  formatPanicSpxValidationSummary,
  formatPanicTimingMd,
  formatPanicTimingPct,
  mergeLiveHistoryIntoPanicSpxSeries,
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
  bottoms: [
    { d0: "2024-04-19", spx: 4967, dd_pct: -5.5 },
    { d0: "2025-03-13", spx: 5521, dd_pct: -10.1 },
  ],
  rows: [
    { date: "2024-04-01", spx: 5200, panic: 35 },
    { date: "2024-04-19", spx: 4967, panic: 41 },
    { date: "2025-02-20", spx: 6000, panic: 40 },
    { date: "2025-03-04", spx: 5778, panic: 50 },
    { date: "2025-03-10", spx: 5600, panic: 55 },
    { date: "2025-03-13", spx: 5521, panic: 55 },
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
    const domain = resolveBottomWindowDomain(
      {
        ...sample,
        rows: [
          { date: "2025-03-01", spx: 1, panic: 40 },
          { date: "2025-03-04", spx: 1, panic: 50 },
          { date: "2025-03-13", spx: 1, panic: 55 },
          { date: "2025-03-20", spx: 1, panic: 45 },
        ],
      },
      "2025-03-13",
      2,
      1,
    )
    expect(domain).toEqual(["2025-03-01", "2025-03-20"])
  })

  it("returns null for unknown bottom", () => {
    expect(resolveBottomWindowDomain(sample, "2099-01-01")).toBeNull()
  })

  it("formats timing labels", () => {
    expect(formatPanicTimingMd("2025-04-08")).toBe("04-08")
    expect(formatPanicTimingPct(-12.34)).toBe("-12.3%")
    expect(formatPanicTimingPct(null)).toBe("미도달")
  })

  it("finds first reach and additional drawdown", () => {
    const win = [
      { date: "2025-03-01", spx: 6000, panic: 40 },
      { date: "2025-03-04", spx: 5778, panic: 50 },
      { date: "2025-03-13", spx: 5521, panic: 55 },
    ]
    expect(firstPanicReachInWindow(win, 50)?.date).toBe("2025-03-04")
    expect(additionalDrawdownToBottom(5778, 5521)).toBe(-4.4)
  })

  it("builds entry timing table with 미도달", () => {
    const table = buildPanicEntryTimingTable(sample)
    expect(table?.rows).toHaveLength(2)
    const march = table?.rows.find((r) => r.d0 === "2025-03-13")
    expect(march?.t50Label).toBe("03-04")
    expect(march?.t50ToBottomLabel).toMatch(/^-/)
    expect(march?.t60Label).toBe("미도달")
    const april = table?.rows.find((r) => r.d0 === "2024-04-19")
    expect(april?.t50Label).toBe("미도달")
    expect(table?.aggregates.reach50).toBe("1/2")
    expect(table?.disclaimer).toContain("미래 수익을 보장하지 않습니다")
  })

  it("merges live history into validation series (upsert by date)", () => {
    const merged = mergeLiveHistoryIntoPanicSpxSeries(sample, [
      { date: "2025-03-13", panic_v2: 61 },
      { date: "2026-09-23", vix: 22.22, fearGreed: 27, putCall: 0.71 },
    ])
    expect(merged?.rows.find((r) => r.date === "2025-03-13")?.panic).toBe(61)
    const appended = merged?.rows.find((r) => r.date === "2026-09-23")
    expect(appended?.panic).toBe(42)
    expect(appended?.spx).toBe(5521)
    expect(merged?.span?.[1]).toBe("2026-09-23")
  })

  it("re-merging same date does not duplicate rows", () => {
    const once = mergeLiveHistoryIntoPanicSpxSeries(sample, [
      { date: "2025-03-13", panic_v2: 70 },
    ])
    const twice = mergeLiveHistoryIntoPanicSpxSeries(once, [
      { date: "2025-03-13", panic_v2: 72 },
    ])
    const count = twice?.rows.filter((r) => r.date === "2025-03-13").length
    expect(count).toBe(1)
    expect(twice?.rows.find((r) => r.date === "2025-03-13")?.panic).toBe(72)
  })
})
