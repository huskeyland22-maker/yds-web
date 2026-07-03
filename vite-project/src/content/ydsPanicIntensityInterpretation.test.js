import { describe, expect, it } from "vitest"
import {
  buildPanicIntensityInterpretation,
  formatPanicIntensityStageDisplay,
  resolvePanicSentimentStageIndex,
} from "./ydsPanicIntensityInterpretation.js"

describe("ydsPanicIntensityInterpretation GO #84", () => {
  it("maps scores to unified fear-intensity stages", () => {
    expect(formatPanicIntensityStageDisplay(15)).toBe("🔵 공포 부족")
    expect(formatPanicIntensityStageDisplay(35)).toBe("🟢 약한 공포")
    expect(formatPanicIntensityStageDisplay(49)).toBe("🟡 중립")
    expect(formatPanicIntensityStageDisplay(72)).toBe("🟠 높은 공포")
    expect(formatPanicIntensityStageDisplay(91)).toBe("🔴 극심한 공포")
  })

  it("does not use single-word 공포 label", () => {
    for (const score of [15, 35, 49, 72, 91]) {
      const label = buildPanicIntensityInterpretation(score)?.label ?? ""
      expect(label).not.toBe("공포")
    }
  })

  it("uses inclusive stage boundaries", () => {
    expect(resolvePanicSentimentStageIndex(20)).toBe(0)
    expect(resolvePanicSentimentStageIndex(21)).toBe(1)
    expect(resolvePanicSentimentStageIndex(40)).toBe(1)
    expect(resolvePanicSentimentStageIndex(41)).toBe(2)
  })

  it("includes stage-specific interpretation lines", () => {
    const interp = buildPanicIntensityInterpretation(49)
    expect(interp?.descriptionLines[0]).toBe("공포와 낙관이 균형을 이루는 상태입니다.")
  })
})
