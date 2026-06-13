import { describe, expect, it } from "vitest"
import {
  buildPanicIntensityRecentAudit,
  verifyCnnDirection,
} from "./panicIntensityAudit.js"
import { scoreFearGreed } from "./tradingScores.js"

describe("panicIntensityAudit CNN direction", () => {
  it("CNN 상승 시 정규화 점수는 하락 (공포 감소 → 패닉 기여 감소)", () => {
    const low = verifyCnnDirection(30)
    const high = verifyCnnDirection(70)
    expect(low.directionOk).toBe(true)
    expect(high.directionOk).toBe(true)
    expect(scoreFearGreed(70)).toBeLessThan(scoreFearGreed(30))
    expect(verifyCnnDirection(55).higherCnnRaisesPanic).toBe(false)
  })

  it("최근 2일 감사 구조에 CNN·VIX 기여도 포함", () => {
    const rows = [
      { date: "2026-06-02", vix: 18, fearGreed: 55, bofa: 5.5, putCall: 0.82, highYield: 3.5 },
      { date: "2026-06-03", vix: 16, fearGreed: 62, bofa: 5.6, putCall: 0.8, highYield: 3.4, move: 95, dxy: 104 },
    ]
    const audit = buildPanicIntensityRecentAudit(rows, 2)
    expect(audit.days).toHaveLength(2)
    expect(audit.days[1].metrics.cnn.inPanicIntensity).toBe(true)
    expect(audit.days[1].metrics.move.inPanicIntensity).toBe(false)
    expect(audit.delta?.contributionDeltas).toBeTruthy()
  })
})
