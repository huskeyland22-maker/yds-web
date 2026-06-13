import { describe, expect, it } from "vitest"
import { computePhase3ScoreBreakdown } from "./ydsStockPickPhase3Breakdown.js"
import { computeTimingScore } from "./ydsStockPickTimingScore.js"
import { computeTechnicalScore } from "./ydsStockTechnicalScore.js"
import { buildSectorStrengthMap, getSectorTopStocks } from "./ydsStockPickSectorStrength.js"
import { buildStockPickOpinion } from "./ydsStockPickOpinion.js"

describe("computePhase3ScoreBreakdown", () => {
  it("sums quality + timing to total max 100", () => {
    const snapshot = {
      close: 110,
      ma20: 100,
      ma60: 95,
      ma120: 90,
      high52w: 112,
      recentHigh: 112,
      volumeToday: 1500,
      volumeAvg20: 1000,
    }
    const timingScore = computeTimingScore(snapshot, { rsi14: 55 }, { drawdownPct: 2 })
    const result = computePhase3ScoreBreakdown({
      rating: 5,
      manualMarketFit: 20,
      scores: {
        trendScore: 40,
        volumeScore: 20,
        positionScore: 20,
        marketFitScore: 20,
      },
      timingScore,
    })
    expect(result.quality).toBe(75)
    expect(result.total).toBe(result.quality + result.timing)
    expect(result.total).toBeLessThanOrEqual(100)
    expect(result.rows).toHaveLength(6)
  })

  it("matches example-style partial scores", () => {
    const result = computePhase3ScoreBreakdown({
      rating: 4,
      manualMarketFit: 16,
      scores: {
        trendScore: 32,
        volumeScore: 16,
        positionScore: 16,
        marketFitScore: 14,
      },
    })
    expect(result.total).toBeGreaterThan(0)
    expect(result.total).toBeLessThanOrEqual(100)
    expect(
      result.performance + result.industry + result.sector + result.marketEnv + result.technical + result.volume,
    ).toBe(result.total)
  })
})

describe("computeTechnicalScore", () => {
  it("awards points for MA alignment and volume", () => {
    const result = computeTechnicalScore(
      {
        close: 110,
        ma20: 100,
        ma60: 95,
        ma120: 90,
        high52w: 112,
        recentHigh: 112,
        volumeToday: 1500,
        volumeAvg20: 1000,
      },
      { rsi14: 55 },
    )
    expect(result.score).toBeGreaterThan(5)
    expect(result.checks.find((c) => c.id === "ma20")?.pass).toBe(true)
    expect(result.checks.find((c) => c.id === "rsi")?.pass).toBe(true)
  })
})

describe("sector strength", () => {
  const stocks = [
    { ticker: "A", sector: "semi", scoreBreakdown: { total: 84 }, scores: { totalScore: 84 } },
    { ticker: "B", sector: "semi", scoreBreakdown: { total: 79 }, scores: { totalScore: 79 } },
    { ticker: "C", sector: "semi", scoreBreakdown: { total: 71 }, scores: { totalScore: 71 } },
    { ticker: "D", sector: "ai", scoreBreakdown: { total: 90 }, scores: { totalScore: 90 } },
  ]

  it("computes TOP3 average for sector", () => {
    const map = buildSectorStrengthMap(stocks)
    expect(map.semi.strength).toBe(Math.round((84 + 79 + 71) / 3))
  })

  it("returns sector top5 ordered by score", () => {
    const top = getSectorTopStocks(stocks, "semi", 5)
    expect(top.map((s) => s.ticker)).toEqual(["A", "B", "C"])
  })
})

describe("buildStockPickOpinion", () => {
  it("generates rule-based bullets without OpenAI", () => {
    const stock = {
      name: "SK하이닉스",
      ticker: "000660",
      sectorLabel: "반도체",
      investThemes: ["HBM"],
      scoreBreakdown: { performance: 28, sector: 18, total: 84, quality: 60, timing: 24 },
      v4Score: { qualityGrade: "A", timingGrade: "A", recommendStatusId: "aggressiveBuy", total: 84 },
      stockStatus: { id: "trend" },
      technicalScore: { score: 8, checks: [] },
      scores: { totalScore: 84 },
    }
    const opinion = buildStockPickOpinion(stock, { strength: 82, label: "반도체" })
    expect(opinion.bullets.length).toBeGreaterThan(0)
    expect(opinion.action).toBeTruthy()
    expect(opinion.fullText).toContain("SK하이닉스")
  })
})
