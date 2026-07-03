import { describe, expect, it } from "vitest"
import {
  buildPanicIntensityLegendView,
  formatPanicIntensityLegendLabel,
  resolvePanicIntensityLegendIndex,
} from "./ydsPanicIntensityLegend.js"

describe("ydsPanicIntensityLegend", () => {
  it("maps scores to six legend stages", () => {
    expect(formatPanicIntensityLegendLabel(10)).toBe("극단적 탐욕")
    expect(formatPanicIntensityLegendLabel(25)).toBe("탐욕")
    expect(formatPanicIntensityLegendLabel(33)).toBe("공포 부족")
    expect(formatPanicIntensityLegendLabel(49)).toBe("중립")
    expect(formatPanicIntensityLegendLabel(70)).toBe("공포")
    expect(formatPanicIntensityLegendLabel(88)).toBe("극단적 공포")
  })

  it("uses inclusive boundaries", () => {
    expect(resolvePanicIntensityLegendIndex(15)).toBe(0)
    expect(resolvePanicIntensityLegendIndex(16)).toBe(1)
    expect(resolvePanicIntensityLegendIndex(45)).toBe(2)
    expect(resolvePanicIntensityLegendIndex(46)).toBe(3)
    expect(resolvePanicIntensityLegendIndex(75)).toBe(4)
    expect(resolvePanicIntensityLegendIndex(76)).toBe(5)
  })

  it("includes tooltip copy for info panel", () => {
    const view = buildPanicIntensityLegendView(33)
    expect(view?.tooltipText).toBe("건전한 강세장이 이어질 가능성이 높은 구간입니다.")
    expect(view?.tooltipTitle).toBe("공포 부족 (31~45)")
  })
})
