import { describe, expect, it } from "vitest"
import { buildCreditCycleOverviewModel } from "./creditCycleOverviewAdapter.js"

describe("creditCycleOverviewAdapter", () => {
  it("builds overview without inventing HY/BBB values", () => {
    const view = buildCreditCycleOverviewModel({
      asOf: "2026-10-01",
      cci: 39,
      coveragePct: 100,
      pitLabel: "NON_PIT",
      statusLabel: "OK",
      regime: { id: "Expansion" },
      feedStatus: "STAGING_API",
      indicators: [
        {
          id: "hy",
          label: "HY Spread",
          licenseRestricted: true,
        },
        {
          id: "sloos",
          label: "SLOOS",
          valueDisplay: "1.7",
          valueDelta: -0.1,
          riskScore: 20,
          statusLabel: "안정",
          quality: "VALID",
        },
        {
          id: "cre",
          label: "CRE",
          valueDisplay: "1.53",
          riskScore: 25,
          quality: "VALID",
        },
      ],
      checklist: [
        { id: "hy", label: "HY Spread 악화", state: "UNAVAILABLE", stateLabel: "미확인" },
        { id: "sloos", label: "SLOOS", state: "CLEAR", stateLabel: "완화" },
      ],
      cciPath: [
        { asOf: "2026-09-01", cci: 40 },
        { asOf: "2026-10-01", cci: 39 },
      ],
    })

    expect(view.ready).toBe(true)
    expect(view.gauge.score).toBe(39)
    expect(view.regime.labelKo).toBe("확장")
    const hy = view.summary.find((s) => s.id === "hy")
    expect(hy.valueText).toBe("비공개")
    expect(hy.licenseRestricted).toBe(true)
    expect(view.tableRows).toHaveLength(6)
    expect(view.chartPoints).toHaveLength(2)
    expect(view.diagramSteps.some((s) => s.active && s.id === "expansion")).toBe(true)
  })

  it("keeps loading state when model missing", () => {
    const view = buildCreditCycleOverviewModel(null)
    expect(view.ready).toBe(false)
    expect(view.loading).toBe(true)
  })
})
