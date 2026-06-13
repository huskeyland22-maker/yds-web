import { describe, expect, it } from "vitest"
import { resolveStockPickThemes } from "./ydsStockPickThemes.js"
import { buildStockPickWhyBrief } from "./ydsStockPickWhyBrief.js"
import { getTop10Stocks } from "./ydsStockPickModel.js"

describe("ydsStockPickThemes", () => {
  it("maps HBM tickers", () => {
    expect(resolveStockPickThemes({ ticker: "000660", sector: "semi" })).toContain("HBM")
    expect(resolveStockPickThemes({ ticker: "MU", sector: "semi" })).toContain("HBM")
  })

  it("falls back to sector theme", () => {
    expect(resolveStockPickThemes({ ticker: "UNKNOWN", sector: "robot" })).toEqual(["로봇"])
  })
})

describe("ydsStockPickWhyBrief", () => {
  it("builds five sections", () => {
    const brief = buildStockPickWhyBrief({
      ticker: "000660",
      name: "SK하이닉스",
      sector: "semi",
      sectorLabel: "반도체",
      comment: "HBM·메모리 슈퍼사이클",
      stockAction: { label: "매수 가능" },
      stockStatus: { label: "추세 유지" },
      scores: { totalScore: 82 },
    })
    expect(brief.industry).toBeTruthy()
    expect(brief.bottleneck).toBeTruthy()
    expect(brief.performance).toBeTruthy()
    expect(brief.technology).toBeTruthy()
    expect(brief.action).toContain("매수 가능")
  })
})

describe("getTop10Stocks", () => {
  it("returns at most 10 live-ranked stocks", () => {
    const stocks = Array.from({ length: 12 }, (_, i) => ({
      ticker: `T${i}`,
      rank: i + 1,
      dataSource: "live",
      scores: { totalScore: 100 - i },
    }))
    expect(getTop10Stocks(stocks)).toHaveLength(10)
  })
})
