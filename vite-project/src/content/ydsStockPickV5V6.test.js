import { describe, expect, it } from "vitest"
import {
  buildNoChaseReasons,
  resolvePricePosition,
  marketEnvToGrade,
} from "./ydsStockPickV5Insights.js"
import { buildSectorRankMap } from "./ydsStockPickSectorRanks.js"
import { getRegimeDisplayLimit } from "./ydsStockPickMarketRegime.js"
import { resolveFinalAction } from "./ydsStockPickFinalAction.js"
import { qualityToDisplayGrade } from "./ydsStockPickV4Scoring.js"

describe("V5 no-chase reasons", () => {
  it("lists RSI and extension warnings", () => {
    const stock = {
      v4Score: { recommendStatusId: "noChase" },
      timingScore: { checks: [{ id: "rsi", pass: false }] },
      statusDiag: { inputs: { rsi14: 78, close: 120, ma120: 100 } },
      snapshot: { close: 120, ma120: 100 },
    }
    const reasons = buildNoChaseReasons(stock)
    expect(reasons.some((r) => r.includes("RSI"))).toBe(true)
  })
})

describe("V5 price position", () => {
  it("detects overheat zone", () => {
    const stock = {
      stockStatus: { id: "overheat" },
      statusDiag: { inputs: { rsi14: 75, close: 100, ma20: 95, ma60: 90 } },
      snapshot: {},
    }
    expect(resolvePricePosition(stock).label).toBe("과열구간")
  })
})

describe("V5 sector ranks", () => {
  it("assigns sector rank display", () => {
    const stocks = [
      { ticker: "A", sector: "semi", scoreBreakdown: { total: 90 }, v4Score: { total: 90 } },
      { ticker: "B", sector: "semi", scoreBreakdown: { total: 80 }, v4Score: { total: 80 } },
    ]
    const map = buildSectorRankMap(stocks)
    expect(map.get("A")?.display).toBe("반도체 1위")
    expect(map.get("B")?.display).toBe("반도체 2위")
  })
})

describe("V6 market regime", () => {
  it("limits display by market position (state-first)", () => {
    expect(getRegimeDisplayLimit("overheat")).toBe(5)
    expect(getRegimeDisplayLimit("boundary")).toBe(10)
    expect(getRegimeDisplayLimit("adjustment")).toBe(20)
    expect(getRegimeDisplayLimit("fear")).toBe(50)
    expect(getRegimeDisplayLimit("panic")).toBe(Infinity)
  })

  it("limits display by macro state (legacy)", () => {
    expect(getRegimeDisplayLimit("overheated", "macro")).toBe(5)
    expect(getRegimeDisplayLimit("dca", "macro")).toBe(50)
    expect(getRegimeDisplayLimit("panicBuy", "macro")).toBe(Infinity)
  })
})

describe("V6 final action", () => {
  it("maps noChase status", () => {
    const stock = {
      dataSource: "live",
      v4Score: { recommendStatusId: "noChase", top5Eligible: true },
    }
    expect(resolveFinalAction(stock).label).toBe("추격 금지")
  })
})

describe("A+ quality grade", () => {
  it("awards A+ at 70+", () => {
    expect(qualityToDisplayGrade(71)).toBe("A+")
    expect(qualityToDisplayGrade(63)).toBe("A")
  })

  it("grades market fit", () => {
    expect(marketEnvToGrade(13, 15)).toBe("A")
  })
})
