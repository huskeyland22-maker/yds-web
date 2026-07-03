import { describe, expect, it } from "vitest"
import {
  buildAiPerformanceDashboardReport,
  filterDashboardRowsByPeriod,
  isRowInDashboardPeriod,
} from "./ydsAiPerformanceDashboardEngine.js"

/** @type {import("./ydsHubHistoryViewEngine.js").ReturnType<typeof import("./ydsHubHistoryViewEngine.js").buildHubHistoryViewRows>[number]} */
function mockRow(overrides = {}) {
  return {
    pickId: "rec-1",
    ticker: "AMD",
    name: "AMD",
    country: "US",
    recommendedAt: "2026-07-01",
    recommendedAtLabel: "2026.07.01",
    recommendedPriceLabel: "$100",
    currentPriceLabel: "$110",
    returnPct: 10,
    returnLabel: "+10.0%",
    returnTone: "up",
    elapsedLabel: "D+5",
    daysSinceRecommend: 5,
    aiScore: 92,
    aiScoreLabel: "92",
    aiGradeLabel: "A · B+",
    reasonLine: "AI 서버 투자 확대",
    lifecycleId: "active",
    ledgerState: "active",
    isAiBestPick: true,
    sectorLabel: "반도체",
    marketLedger: { marketStateLabel: "조정안정", panicIntensity: 35 },
    ...overrides,
  }
}

describe("ydsAiPerformanceDashboardEngine", () => {
  it("filters custom period inclusively", () => {
    const rows = [
      mockRow({ pickId: "a", recommendedAt: "2026-07-01" }),
      mockRow({ pickId: "b", recommendedAt: "2026-07-20" }),
    ]
    const filtered = filterDashboardRowsByPeriod(rows, "custom", "2026-07-10", "2026-07-31")
    expect(filtered).toHaveLength(1)
    expect(filtered[0].pickId).toBe("b")
  })

  it("accepts year filter for same year rows", () => {
    expect(isRowInDashboardPeriod(mockRow({ recommendedAt: "2026-01-03" }), "year")).toBe(true)
  })

  it("returns empty dashboard when no rows", () => {
    const original = globalThis.localStorage
    globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} }
    const report = buildAiPerformanceDashboardReport([])
    expect(report.visible).toBe(false)
    globalThis.localStorage = original
  })
})
