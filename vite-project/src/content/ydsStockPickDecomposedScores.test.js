import { describe, expect, it } from "vitest"
import { computeDecomposedStockScores } from "./ydsStockPickDecomposedScores.js"

describe("computeDecomposedStockScores", () => {
  it("returns 0~100 sub-scores and weighted total", () => {
    const result = computeDecomposedStockScores({
      ticker: "NVDA",
      rating: 5,
      marketFitScore: 19,
      scores: {
        trendScore: 36,
        volumeScore: 16,
        positionScore: 18,
        marketFitScore: 18,
      },
    })

    for (const row of result.rows) {
      expect(row.value).toBeGreaterThanOrEqual(0)
      expect(row.value).toBeLessThanOrEqual(100)
    }

    const expected = Math.round(
      result.performance * 0.2 +
        result.technology * 0.2 +
        result.momentum * 0.2 +
        result.sector * 0.2 +
        result.marketEnv * 0.2,
    )
    expect(result.total).toBe(expected)
  })
})
