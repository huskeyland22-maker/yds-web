import { describe, expect, it } from "vitest"
import {
  buildPanicIntensityLegendView,
  formatPanicIntensityLegendLabel,
  panicIntensityLegendZoneSteps,
  resolvePanicIntensityLegendIndex,
} from "./ydsPanicIntensityLegend.js"
import { PANIC_INDEX_STAGE_BANDS } from "../utils/tradingScores.js"

describe("ydsPanicIntensityLegend — Panic Index 5단계", () => {
  it("maps scores to PANIC_INDEX_STAGE_BANDS labels", () => {
    expect(formatPanicIntensityLegendLabel(10)).toBe("평온")
    expect(formatPanicIntensityLegendLabel(19)).toBe("평온")
    expect(formatPanicIntensityLegendLabel(20)).toBe("경계")
    expect(formatPanicIntensityLegendLabel(35)).toBe("경계")
    expect(formatPanicIntensityLegendLabel(39)).toBe("경계")
    expect(formatPanicIntensityLegendLabel(40)).toBe("공포")
    expect(formatPanicIntensityLegendLabel(70)).toBe("강한 공포")
    expect(formatPanicIntensityLegendLabel(88)).toBe("극심한 패닉")
  })

  it("uses inclusive stage boundaries from PANIC_INDEX_STAGE_BANDS", () => {
    expect(resolvePanicIntensityLegendIndex(19)).toBe(0)
    expect(resolvePanicIntensityLegendIndex(20)).toBe(1)
    expect(resolvePanicIntensityLegendIndex(39)).toBe(1)
    expect(resolvePanicIntensityLegendIndex(40)).toBe(2)
    expect(resolvePanicIntensityLegendIndex(79)).toBe(3)
    expect(resolvePanicIntensityLegendIndex(80)).toBe(4)
  })

  it("does not use greed-scale wording", () => {
    for (const score of [10, 25, 33, 49, 70, 88]) {
      const label = formatPanicIntensityLegendLabel(score)
      expect(label).not.toMatch(/탐욕/)
    }
  })

  it("tooltip uses same stage name and blurb", () => {
    const view = buildPanicIntensityLegendView(35)
    expect(view?.label).toBe("경계")
    expect(view?.rangeLabel).toBe("20–39")
    expect(view?.tooltipTitle).toBe("경계 (20–39)")
    expect(view?.tooltipText).toBe(PANIC_INDEX_STAGE_BANDS[1].blurb)
  })

  it("zone steps cover 0–100 contiguously for chart fills", () => {
    const steps = panicIntensityLegendZoneSteps()
    expect(steps).toHaveLength(5)
    expect(steps[0]).toMatchObject({ min: 0, max: 20, label: "평온" })
    expect(steps[1]).toMatchObject({ min: 20, max: 40, label: "경계" })
    expect(steps[4]).toMatchObject({ min: 80, max: 100, label: "극심한 패닉" })
  })
})
