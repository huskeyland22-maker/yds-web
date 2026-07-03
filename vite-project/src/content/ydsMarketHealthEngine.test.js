import { describe, expect, it } from "vitest"
import { buildMarketHealthReport } from "./ydsMarketHealthEngine.js"

describe("buildMarketHealthReport", () => {
  it("returns eight checklist items with grades", () => {
    const report = buildMarketHealthReport({
      panicData: {
        vix: 16,
        fearGreed: 55,
        bofa: 6.2,
        putCall: 0.92,
        highYield: 3.8,
      },
      historyRows: [
        { date: "2026-06-01", fearGreed: 50, vix: 18, bofa: 5.8 },
        { date: "2026-06-10", fearGreed: 55, vix: 16, bofa: 6.2 },
      ],
      dualLiquidity: {
        visible: true,
        market: { band: { id: "favorable" } },
        policy: { band: { id: "favorable" } },
        policyScore: 72,
      },
      cycleFlow: { currentCycleLabel: "조정안정" },
    })

    expect(report.visible).toBe(true)
    expect(report.items).toHaveLength(8)
    expect(report.items.map((i) => i.label)).toEqual([
      "추세",
      "모멘텀",
      "변동성",
      "투자심리",
      "유동성",
      "거래량",
      "시장폭",
      "정책환경",
    ])
    expect(report.items.every((i) => i.gradeEmoji && i.gradeLabel)).toBe(true)
    expect(report.items.find((i) => i.id === "policy")?.gradeLabel).toBe("우호")
    expect(report.summary.length).toBeGreaterThan(10)
  })

  it("flags elevated volatility as risk", () => {
    const report = buildMarketHealthReport({
      panicData: { vix: 32, fearGreed: 40, bofa: 4.5, putCall: 1.25 },
    })
    const volatility = report.items.find((i) => i.id === "volatility")
    expect(volatility?.gradeId).toBe("risk")
    expect(volatility?.gradeLabel).toBe("위험")
  })
})
