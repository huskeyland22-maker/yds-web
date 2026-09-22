import { describe, expect, it } from "vitest"
import {
  dayKeyToUtcMs,
  formatHistoryTimeAxisTick,
  pickEvenAxisTickValues,
  pickEvenTimeAxisTicks,
  resolveHistoryDefaultBrushIndex,
  shiftDayKeyMonths,
  utcMsToDayKey,
} from "./chartDateFormat.js"

describe("pickEvenAxisTickValues", () => {
  it("returns empty for empty input", () => {
    expect(pickEvenAxisTickValues([])).toEqual([])
    expect(pickEvenAxisTickValues(null)).toEqual([])
  })

  it("returns all values when length <= target", () => {
    const vals = ["a", "b", "c"]
    expect(pickEvenAxisTickValues(vals, 6)).toEqual(["a", "b", "c"])
  })

  it("keeps first and last and about targetCount ticks", () => {
    const vals = Array.from({ length: 100 }, (_, i) => `d${i}`)
    const ticks = pickEvenAxisTickValues(vals, 6)
    expect(ticks[0]).toBe("d0")
    expect(ticks[ticks.length - 1]).toBe("d99")
    expect(ticks.length).toBeGreaterThanOrEqual(5)
    expect(ticks.length).toBeLessThanOrEqual(6)
  })
})

describe("dayKeyToUtcMs / utcMsToDayKey", () => {
  it("round-trips UTC day keys", () => {
    const ms = dayKeyToUtcMs("2024-04-11")
    expect(ms).toBe(Date.UTC(2024, 3, 11))
    expect(utcMsToDayKey(ms)).toBe("2024-04-11")
  })
})

describe("pickEvenTimeAxisTicks", () => {
  it("returns empty for invalid range", () => {
    expect(pickEvenTimeAxisTicks(Number.NaN, 1)).toEqual([])
    expect(pickEvenTimeAxisTicks(10, 5)).toEqual([])
  })

  it("keeps chronological order and endpoints", () => {
    const start = dayKeyToUtcMs("2024-04-11")
    const end = dayKeyToUtcMs("2024-11-14")
    const ticks = pickEvenTimeAxisTicks(start, end, 6)
    expect(ticks.length).toBe(6)
    expect(ticks[0]).toBe(start)
    expect(ticks[ticks.length - 1]).toBe(end)
    for (let i = 1; i < ticks.length; i += 1) {
      expect(ticks[i]).toBeGreaterThan(ticks[i - 1])
    }
    const gaps = []
    for (let i = 1; i < ticks.length; i += 1) gaps.push(ticks[i] - ticks[i - 1])
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length
    for (const g of gaps) {
      expect(Math.abs(g - avg) / avg).toBeLessThan(0.02)
    }
  })
})

describe("formatHistoryTimeAxisTick", () => {
  it("uses MM/DD for ~17 month spans", () => {
    const ms = dayKeyToUtcMs("2024-05-27")
    expect(formatHistoryTimeAxisTick(ms, 520 * 86_400_000)).toBe("05/27")
  })

  it("includes year for multi-year spans so past→present is readable", () => {
    const ms = dayKeyToUtcMs("2023-01-03")
    expect(formatHistoryTimeAxisTick(ms, 900 * 86_400_000)).toBe("23/01/03")
  })
})

describe("shiftDayKeyMonths / resolveHistoryDefaultBrushIndex", () => {
  it("shifts months across year boundary", () => {
    expect(shiftDayKeyMonths("2026-09-18", -17)).toBe("2025-04-18")
  })

  it("defaults brush to last ~17 months ending at series end", () => {
    const rows = []
    const start = Date.UTC(2023, 0, 3)
    for (let i = 0; i < 1400; i += 1) {
      const t = start + i * 86_400_000
      const d = new Date(t)
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
      rows.push({ date: key })
    }
    const endDate = rows[rows.length - 1].date
    const expectedStart = shiftDayKeyMonths(endDate, -17)
    const brush = resolveHistoryDefaultBrushIndex(rows, 17)
    expect(brush).not.toBeNull()
    expect(brush.endIndex).toBe(rows.length - 1)
    expect(rows[brush.endIndex].date).toBe(endDate)
    expect(rows[brush.startIndex].date >= expectedStart).toBe(true)
    expect(brush.startIndex).toBeGreaterThan(0)
    // visible window roughly 17 months, not full series
    expect(brush.endIndex - brush.startIndex).toBeLessThan(rows.length * 0.55)
  })
})
