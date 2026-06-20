import { describe, expect, it } from "vitest"
import { derivePositionId, resolveStockPosition } from "./ydsStockPositionEngine.js"

describe("ydsStockPositionEngine", () => {
  it("detects overheat from RSI and 52w position", () => {
    const id = derivePositionId({
      close: 100,
      ma20: 95,
      ma60: 90,
      ma120: 85,
      rsi14: 75,
      drawdownPct: 1,
      position52w: 98,
      volRatio: 1.5,
      trendScore: 35,
      relativeStrength: 88,
    })
    expect(id).toBe("overheat")
  })

  it("detects pullback on 60d support with drawdown", () => {
    const id = derivePositionId({
      close: 92,
      ma20: 98,
      ma60: 88,
      ma120: 85,
      rsi14: 55,
      drawdownPct: 8,
      position52w: 75,
      volRatio: 0.9,
      trendScore: 26,
      relativeStrength: 62,
    })
    expect(id).toBe("pullback")
  })

  it("detects downturn below 60d with weak trend", () => {
    const id = derivePositionId({
      close: 80,
      ma20: 85,
      ma60: 90,
      ma120: 92,
      rsi14: 42,
      drawdownPct: 12,
      position52w: 40,
      volRatio: 0.8,
      trendScore: 12,
      relativeStrength: 35,
    })
    expect(id).toBe("downturn")
  })

  it("resolveStockPosition returns label and interpretation", () => {
    const view = resolveStockPosition({
      ticker: "TEST",
      name: "Test",
      snapshot: { close: 100, ma20: 98, ma60: 92, ma120: 88 },
      statusDiag: {
        inputs: { close: 100, ma20: 98, ma60: 92, drawdownPct: 2, position52w: 70, rsi14: 58 },
        statusId: "trend",
        statusLabel: "추세",
        reasons: [],
      },
      scores: { trendScore: 32, volumeScore: 14, positionScore: 10 },
      timingScore: { checks: [], debug: { volRatio: 1.2 }, score: 18, max: 25 },
      pickMeta: null,
    })
    expect(view.label).toBeTruthy()
    expect(view.interpretation).toBeTruthy()
    expect(view.signals.length).toBeGreaterThan(0)
  })
})
