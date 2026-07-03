import { describe, expect, it } from "vitest"
import {
  buildTrackRecordScoreAnalysis,
  filterTrackRecordRows,
} from "./ydsAiTrackRecordEngine.js"

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

describe("ydsAiTrackRecordEngine", () => {
  it("filters KR/US and best pick rows", () => {
    const rows = [
      mockRow({ pickId: "a", country: "US", isAiBestPick: true }),
      mockRow({ pickId: "b", country: "KR", isAiBestPick: false }),
    ]
    expect(filterTrackRecordRows(rows, "kr")).toHaveLength(1)
    expect(filterTrackRecordRows(rows, "us")).toHaveLength(1)
    expect(filterTrackRecordRows(rows, "best")).toHaveLength(1)
  })

  it("filters profit and loss rows", () => {
    const rows = [
      mockRow({ returnPct: 5 }),
      mockRow({ pickId: "loss", returnPct: -3 }),
    ]
    expect(filterTrackRecordRows(rows, "profit")).toHaveLength(1)
    expect(filterTrackRecordRows(rows, "loss")).toHaveLength(1)
  })

  it("aggregates win rate by AI score bucket", () => {
    const rows = [
      mockRow({ aiScore: 92, returnPct: 10 }),
      mockRow({ pickId: "b", aiScore: 91, returnPct: -2 }),
      mockRow({ pickId: "c", aiScore: 75, returnPct: 4 }),
    ]
    const stats = buildTrackRecordScoreAnalysis(rows)
    const g90 = stats.find((s) => s.id === "g90")
    expect(g90?.count).toBe(2)
    expect(g90?.winRate).toBe(50)
  })
})
