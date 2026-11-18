import { describe, expect, it } from "vitest"
import { buildCycleRowFromPanic, panicDataFromCycleRow } from "./cycleHistoryUtils.js"
import { getPanicScoreV2 } from "./tradingScores.js"

describe("buildCycleRowFromPanic", () => {
  it("accepts core-3 metrics without highYield (save → history merge)", () => {
    const row = buildCycleRowFromPanic({
      vix: 22.22,
      fearGreed: 27,
      putCall: 0.71,
      updatedAt: "2026-09-23T12:00:00.000Z",
    })
    expect(row).not.toBeNull()
    expect(row?.date).toBe("2026-09-23")
    expect(row?.vix).toBe(22.22)
    expect(row?.fearGreed).toBe(27)
    expect(row?.putCall).toBe(0.71)
    expect(row?.highYield).toBeUndefined()
  })

  it("attaches provided panic_v2 and matches getPanicScoreV2", () => {
    const payload = { vix: 22.22, fearGreed: 27, putCall: 0.71 }
    const score = getPanicScoreV2(payload)
    const row = buildCycleRowFromPanic({
      ...payload,
      panic_v2: score,
      updatedAt: "2026-09-23T12:00:00.000Z",
    })
    expect(score).toBe(42)
    expect(row?.panic_v2).toBe(42)
    expect(row?.panicV2Score).toBe(42)
  })

  it("returns null when a core metric is missing", () => {
    expect(
      buildCycleRowFromPanic({
        vix: 22,
        fearGreed: 27,
        updatedAt: "2026-09-23T12:00:00.000Z",
      }),
    ).toBeNull()
  })
})

describe("panicDataFromCycleRow", () => {
  it("keeps null metric payloads null", () => {
    const row = panicDataFromCycleRow({
      date: "2026-11-12",
      vix: { value: null, delta: null },
      fearGreed: null,
      putCall: { value: null },
      bofa: null,
      highYield: { value: null },
    })
    expect(row?.vix).toBeNull()
    expect(row?.fearGreed).toBeNull()
    expect(row?.putCall).toBeNull()
    expect(row?.bofa).toBeNull()
    expect(row?.highYield).toBeNull()
    expect(row?.date).toBe("2026-11-12")
  })
})
