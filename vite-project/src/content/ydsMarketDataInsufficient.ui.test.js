/**
 * dataInsufficient UI contracts — holding labels + playbook allocation availability.
 */
import { describe, expect, it } from "vitest"
import { DEFAULT_MARKET_CONTEXT } from "./ydsMarketAdapter.js"
import { buildPlaybookSnapshot } from "./ydsInvestmentPlaybookEngine.js"
import { computeRecommendedAssetAllocation } from "./ydsPortfolioAllocationEngine.js"
import { derivePortfolioHoldingAction } from "./ydsPortfolioHoldingAction.js"
import { buildV5Analysis } from "./ydsPortfolioV5Engine.js"
import { buildPortfolioCenterV1Report } from "./ydsPortfolioCenterEngine.js"
import { buildStockPickViews } from "./ydsStockPickModel.js"
import { getRecommendEngineSortScore } from "./ydsStockRecommendEngine.js"
import { computeMarketFitScore } from "./ydsMarketAdapter.js"

/** Mirrors YdsPortfolioYdsCompareSection allocationUnavailable gate */
function isCompareAllocationUnavailable(recommended, marketContext) {
  return (
    recommended?.available === false ||
    marketContext?.ready === false ||
    marketContext?.scoreStatus === "dataInsufficient"
  )
}

const HOLDING = { id: "t1", name: "Test", returnPct: 5, priceReady: true }

const OK_CTX = {
  ready: true,
  scoreStatus: "ok",
  ydsScore: 42,
  macroId: "neutral",
  isDefensive: true,
  cycleStageId: "normal",
  marketPositionId: "adjustment",
  strategyLabel: "공포 부족",
  panicLabel: "공포 부족",
  contextLine: "",
}

const MISLEADING = ["공포 부족", "과열 구간", "인생 타점", "분할매수", "분할 매수", "추격 금지"]

describe("dataInsufficient UI — holding action", () => {
  it("shows 데이터 부족 / 매매 판단 보류 (not overheat labels)", () => {
    const action = derivePortfolioHoldingAction(HOLDING, DEFAULT_MARKET_CONTEXT)
    expect(action.stockStatus.label).toBe("데이터 부족")
    expect(action.stockAction.label).toBe("매매 판단 보류")
    expect(action.actionReason).toContain("매매 판단 보류")
    for (const bad of MISLEADING) {
      expect(action.stockStatus.label).not.toContain(bad)
      expect(action.stockAction.label).not.toContain(bad)
    }
  })

  it("keeps normal defensive holding copy when score is ok", () => {
    const action = derivePortfolioHoldingAction(HOLDING, OK_CTX)
    expect(action.stockStatus.label).not.toBe("데이터 부족")
    expect(action.actionReason).toContain("추세 유지")
  })
})

describe("dataInsufficient UI — playbook / allocation", () => {
  it("marks allocation unavailable without neutral/panicBuy notes", () => {
    const alloc = computeRecommendedAssetAllocation(DEFAULT_MARKET_CONTEXT)
    expect(alloc.available).toBe(false)
    expect(alloc.note).toBe("데이터 부족 · 배분 산출 불가")
    expect(alloc.note).not.toContain("공포 부족")
    expect(alloc.note).not.toContain("인생 타점")
  })

  it("playbook snapshot hides buy intensity and uses insufficient market label", () => {
    const snap = buildPlaybookSnapshot(null, null)
    expect(snap.currentMarketLabel).toBe("데이터 부족")
    expect(snap.portfolio.available).toBe(false)
    expect(snap.portfolio.note).toBe("데이터 부족 · 배분 산출 불가")
    expect(snap.buyIntensityPct).toBeNull()
    expect(snap.marketPrinciples.every((p) => p.isCurrent === false)).toBe(true)
  })

  it("ok context still yields available allocation card data", () => {
    const snap = buildPlaybookSnapshot(OK_CTX, null)
    expect(snap.portfolio.available).not.toBe(false)
    expect(snap.portfolio.recommendedCashPct).toBe(60)
    expect(snap.portfolio.note).toContain("공포 부족")
    expect(snap.currentMarketLabel).not.toBe("데이터 부족")
  })
})

describe("dataInsufficient UI — portfolio YDS compare gate", () => {
  it("hides normal recommended weights when V5 available is false", () => {
    const analysis = buildV5Analysis([], 0, DEFAULT_MARKET_CONTEXT, new Map(), null)
    expect(analysis.recommended.available).toBe(false)
    expect(analysis.recommended.usPct).toBe(0)
    expect(isCompareAllocationUnavailable(analysis.recommended, DEFAULT_MARKET_CONTEXT)).toBe(
      true,
    )
  })

  it("keeps compare allocation when Official score context is ok", () => {
    const analysis = buildV5Analysis([], 0, OK_CTX, new Map(), null)
    expect(analysis.recommended.available).not.toBe(false)
    expect(analysis.recommended.cashPct).toBe(60)
    expect(isCompareAllocationUnavailable(analysis.recommended, OK_CTX)).toBe(false)
  })
})

describe("dataInsufficient UI — live portfolio center report", () => {
  const emptyHoldings = {
    rows: [],
    cashAmount: 0,
    cashPct: 100,
    totalAssets: 0,
    totalReturnPct: null,
  }

  it("nulls allocationCompare and marks allocationAvailable false", () => {
    const report = buildPortfolioCenterV1Report(
      [],
      0,
      DEFAULT_MARKET_CONTEXT,
      new Map(),
      null,
      emptyHoldings,
    )
    expect(report.market.allocationAvailable).toBe(false)
    expect(report.market.allocationCompare).toBeNull()
    expect(report.market.recommendedCashPct).toBeNull()
    expect(report.market.recommendedStockPct).toBeNull()
    expect(report.market.note).toBe("데이터 부족 · 배분 산출 불가")
    const cashCheck = report.riskChecks.find((c) => c.id === "cash")
    expect(cashCheck?.message).toBe("데이터 부족 · 배분 산출 불가")
    expect(cashCheck?.message).not.toMatch(/권장 0%/)
  })

  it("does not score fit against 0% recommended when allocation unavailable", () => {
    const report = buildPortfolioCenterV1Report(
      [],
      1_000_000,
      DEFAULT_MARKET_CONTEXT,
      new Map(),
      null,
      { ...emptyHoldings, cashAmount: 1_000_000, cashPct: 100, totalAssets: 1_000_000 },
    )
    expect(report.market.allocationAvailable).toBe(false)
    expect(report.market.allocationCompare).toBeNull()
    expect(report.fit.available).toBe(false)
    expect(report.fit.score).toBeNull()
    expect(report.fit.grade).toBeNull()
    expect(report.fit.detail).toBeNull()
    expect(report.fit.label).toBe("데이터 부족 · 적합도 산출 불가")
    expect(report.fit.label).not.toMatch(/보통|양호|부적합/)
  })

  it("keeps allocation compare bars when Official context is ok", () => {
    const report = buildPortfolioCenterV1Report([], 0, OK_CTX, new Map(), null, emptyHoldings)
    expect(report.market.allocationAvailable).toBe(true)
    expect(report.market.allocationCompare).not.toBeNull()
    expect(report.market.recommendedCashPct).toBe(60)
    expect(report.market.recommendedStockPct).toBe(40)
    expect(report.market.allocationCompare.cash.recommendedPct).toBe(60)
    expect(report.market.note).toContain("공포 부족")
  })

  it("keeps numeric fit grade when Official context is ok", () => {
    const report = buildPortfolioCenterV1Report(
      [],
      1_000_000,
      OK_CTX,
      new Map(),
      null,
      { ...emptyHoldings, cashAmount: 1_000_000, cashPct: 100, totalAssets: 1_000_000 },
    )
    expect(report.fit.available).toBe(true)
    expect(typeof report.fit.score).toBe("number")
    expect(report.fit.grade).toMatch(/^[A-F]$/)
    expect(report.fit.detail).not.toBeNull()
    expect(report.fit.detail.components.length).toBeGreaterThan(0)
    expect(report.fit.label).not.toBe("데이터 부족 · 적합도 산출 불가")
  })
})

describe("dataInsufficient — enrichStock blocks manual marketFit", () => {
  const MARKET_FIT_PHRASES = ["현재 시장과 적합", "시장 상태와 적합", "시장 적합도 양호"]

  it("zeros live marketFit and skips market-fit reasons when DEFAULT context", () => {
    const views = buildStockPickViews(DEFAULT_MARKET_CONTEXT)
    const sample = views.find((v) => (v.marketFitScore ?? 0) >= 14) ?? views[0]
    expect(sample.marketFitScore).toBeGreaterThanOrEqual(14)
    expect(sample.scores.marketFitScore).toBe(0)
    expect(sample.marketFitSource).toBe("unavailable")
    expect(sample.scoreBreakdown.debug.inputs.manualMarketFit).toBe(0)
    expect(sample.scoreBreakdown.debug.inputs.liveMarketFit).toBe(0)

    const reasonTexts = [
      ...sample.recommendReasons.map((r) => r.text),
      ...sample.recommendReasonsDetail.map((r) => r.text),
      ...sample.recommendEngine.reasons.map((r) => r.text),
    ]
    for (const phrase of MARKET_FIT_PHRASES) {
      expect(reasonTexts.some((t) => String(t).includes(phrase))).toBe(false)
    }
  })

  it("does not let universe manual marketFit inflate sort vs adapter zero path", () => {
    const insufficient = buildStockPickViews(DEFAULT_MARKET_CONTEXT)
    const withManualBleed = insufficient.map((s) => ({
      ...s,
      scores: { ...s.scores, marketFitScore: s.marketFitScore },
    }))
    // If enrich still fed manual into scores, sort would rise with high universe fits
    const sortBlocked = insufficient.map(getRecommendEngineSortScore)
    const sortIfManualInScores = withManualBleed.map((s) => {
      const mf = s.scores.marketFitScore
      const timing = s.timingScore?.score ?? 0
      const marketFit = Math.min(100, Math.round((mf / 20) * 100 * 0.55 + (timing / 25) * 100 * 0.45))
      return marketFit
    })
    expect(Math.max(...insufficient.map((s) => s.scores.marketFitScore))).toBe(0)
    expect(Math.max(...sortIfManualInScores)).toBeGreaterThan(0)
    expect(sortBlocked.every((n) => Number.isFinite(n))).toBe(true)
  })

  it("keeps adapter marketFit under ok neutral context", () => {
    const views = buildStockPickViews(OK_CTX)
    const sample = views[0]
    expect(sample.marketFitSource).toBe("adapter")
    const expected = computeMarketFitScore(OK_CTX, sample.statusView?.id ?? "trend", {
      trendScore: sample.scores.trendScore,
      volumeScore: sample.scores.volumeScore,
      positionScore: sample.scores.positionScore,
      marketFitScore: 0,
      totalScore: 0,
    })
    expect(sample.scores.marketFitScore).toBe(expected)
    expect(sample.scores.marketFitScore).toBeGreaterThan(0)
    expect(sample.marketFitScore).toBeGreaterThan(0)
  })
})
