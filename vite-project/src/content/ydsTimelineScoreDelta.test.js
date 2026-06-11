import { describe, expect, it } from "vitest"
import { resolveTimelineScoreDelta } from "./ydsTimelineScoreDelta.js"

describe("ydsTimelineScoreDelta", () => {
  const rows = [
    { date: "2026-06-09", fearGreed: 65, vix: 15, bofa: 6.5, putCall: 0.7 },
    { date: "2026-06-10", fearGreed: 48, vix: 18, bofa: 6, putCall: 0.75 },
    { date: "2026-06-11", fearGreed: 42, vix: 20, bofa: 5.8, putCall: 0.8 },
  ]

  it("returns market state delta for position events", () => {
    const delta = resolveTimelineScoreDelta(rows, {
      date: "2026-06-11",
      type: "position-adjustment-entry",
    })
    expect(delta?.label).toBe("시장 상태")
    expect(delta?.text).toMatch(/^시장 상태 \d+ → \d+$/)
  })

  it("returns panic delta for panic band events", () => {
    const delta = resolveTimelineScoreDelta(rows, {
      date: "2026-06-10",
      type: "panic-interest-entry",
    })
    expect(delta?.label).toBe("패닉 강도")
    expect(delta?.text).toMatch(/^패닉 강도 \d+ → \d+$/)
  })
})
