import { describe, expect, it } from "vitest"
import { computePhase3ScoreBreakdown } from "./ydsStockPickPhase3Breakdown.js"
import { computeTimingScore } from "./ydsStockPickTimingScore.js"
import {
  computeFinalRankScore,
  computeV4Score,
  isTop5Eligible,
  qualityToGrade,
  timingToGrade,
  V4_RECOMMEND_MATRIX,
} from "./ydsStockPickV4Scoring.js"
import { buildStockPickOpinion } from "./ydsStockPickOpinion.js"

describe("V4 quality/timing grades", () => {
  it("maps example scores to A and C grades", () => {
    expect(qualityToGrade(63)).toBe("A")
    expect(timingToGrade(17)).toBe("C")
  })

  it("quality A + timing C → scaleIn", () => {
    const v4 = computeV4Score(63, 17)
    expect(v4.qualityGrade).toBe("A")
    expect(v4.timingGrade).toBe("C")
    expect(v4.recommendStatusId).toBe(V4_RECOMMEND_MATRIX.A.C)
    expect(v4.total).toBe(80)
  })

  it("quality A + timing F → noChase", () => {
    const v4 = computeV4Score(63, 4)
    expect(v4.recommendStatusId).toBe("noChase")
    expect(v4.top5Eligible).toBe(false)
  })
})

describe("V4 TOP5 final rank score", () => {
  it("applies timing penalty when timing ≤ 10", () => {
    const highQualityLowTiming = computeFinalRankScore(70, 8)
    const balanced = computeFinalRankScore(55, 20)
    expect(highQualityLowTiming).toBeLessThan(computeFinalRankScore(70, 20))
    expect(balanced).toBeGreaterThan(highQualityLowTiming)
  })

  it("excludes timing ≤ 5 from TOP5", () => {
    expect(isTop5Eligible(5)).toBe(false)
    expect(isTop5Eligible(6)).toBe(true)
  })
})

describe("computeTimingScore", () => {
  it("scores pullback and penalizes RSI overheat", () => {
    const result = computeTimingScore(
      {
        close: 100,
        ma20: 98,
        ma60: 95,
        ma120: 90,
        high52w: 110,
        recentHigh: 105,
        volumeToday: 1200,
        volumeAvg20: 1000,
      },
      { rsi14: 75 },
      { drawdownPct: 8 },
    )
    expect(result.score).toBeLessThan(20)
    expect(result.checks.find((c) => c.id === "pullback")?.pass).toBe(true)
    expect(result.checks.find((c) => c.id === "rsi")?.pass).toBe(false)
  })
})

describe("phase3 with V4 timing", () => {
  it("total equals quality + timing module score", () => {
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
    const timing = computeTimingScore(snapshot, { rsi14: 55 }, { drawdownPct: 3 })
    const breakdown = computePhase3ScoreBreakdown({
      rating: 5,
      manualMarketFit: 20,
      scores: { trendScore: 40, volumeScore: 20, positionScore: 20, marketFitScore: 20 },
      timingScore: timing,
    })
    expect(breakdown.total).toBe(breakdown.quality + breakdown.timing)
    expect(breakdown.timing).toBe(timing.score)
  })
})

describe("buildStockPickOpinion V4 practical", () => {
  it("includes holder and non-holder actions", () => {
    const stock = {
      name: "마이크로소프트",
      ticker: "MSFT",
      sectorLabel: "AI",
      investThemes: ["AI·클라우드"],
      scoreBreakdown: { performance: 28, sector: 18, quality: 63, timing: 17, total: 80 },
      v4Score: computeV4Score(63, 17),
      stockStatus: { id: "interest" },
      scores: { totalScore: 80 },
    }
    const opinion = buildStockPickOpinion(stock)
    expect(opinion.qualityLine).toContain("기업품질")
    expect(opinion.holderAction).toContain("보유자")
    expect(opinion.nonHolderAction).toContain("미보유자")
  })
})
