import { describe, expect, it } from "vitest"
import {
  correctStoredMarketDate,
  isMarketClosedDay,
  repairPickMarketFields,
  resolvePickMarketDate,
  resolveRecommendMarketAnchor,
  rollBackToTradingDay,
} from "./ydsRecommendMarketDate.js"
import { repairImmutableLedgerRecord, sealNewRecommendLedgerRecord } from "./ydsRecommendLedger.js"

describe("ydsRecommendMarketDate", () => {
  it("treats 2026-07-03 as US market holiday", () => {
    expect(isMarketClosedDay("2026-07-03", "US")).toBe(true)
    expect(rollBackToTradingDay("2026-07-03", "US")).toBe("2026-07-02")
  })

  it("resolves market anchor from price summary after close", () => {
    const stock = {
      country: "US",
      ticker: "AMD",
      pickMarket: {
        priceSummary: {
          todayBarDate: "2026-07-02",
          regularClose: 517.82,
          previousClose: 510,
          sessionBadgeKey: "regular_close",
          showLive: false,
        },
        chartBars: [{ date: "2026-07-02", close: 517.82 }],
      },
    }
    const anchor = resolveRecommendMarketAnchor(stock, "US")
    expect(anchor.marketDate).toBe("2026-07-02")
    expect(anchor.marketClose).toBe(517.82)
  })

  it("uses previous close during US intraday session", () => {
    const stock = {
      country: "US",
      ticker: "GEV",
      pickMarket: {
        priceSummary: {
          todayBarDate: "2026-07-09",
          regularClose: 1070.99,
          previousClose: 1113.11,
          sessionBadgeKey: "intraday",
          showLive: true,
        },
        chartBars: [
          { date: "2026-07-08", close: 1113.11 },
          { date: "2026-07-09", close: 1070.99 },
        ],
      },
    }
    const anchor = resolveRecommendMarketAnchor(stock, "US")
    expect(anchor.marketDate).toBe("2026-07-08")
    expect(anchor.marketClose).toBe(1113.11)
  })

  it("repairs stored US holiday recommend date to last trading day", () => {
    const sealed = sealNewRecommendLedgerRecord(
      {
        ticker: "AMD",
        name: "AMD",
        country: "US",
        rank: 1,
        isTop3: true,
        recommendedAt: "2026-07-03",
        recommendedPrice: 517.82,
        recommendedScore: 88,
        priceLog: { "2026-07-02": 517.82, "2026-07-03": 517.82 },
        lifecycleId: "active",
        statusId: "interest",
        qualityGrade: "A",
        timingGrade: "B+",
        recordedAt: Date.UTC(2026, 6, 3, 4, 30, 0),
        recommendSnapshot: {
          frozen: true,
          capturedAt: "2026-07-03",
          name: "AMD",
          recommendedPrice: 517.82,
          totalScore: 88,
          qualityGrade: "A",
          timingGrade: "B+",
        },
      },
      null,
      null,
    )
    const repaired = repairImmutableLedgerRecord(sealed, "test")
    expect(resolvePickMarketDate(repaired)).toBe("2026-07-02")
    expect(repaired.recommendedPrice).toBe(517.82)
    expect(repaired.createdAt).toBeTruthy()
  })

  it("correctStoredMarketDate matches repairPickMarketFields", () => {
    const fields = repairPickMarketFields({
      country: "US",
      recommendedAt: "2026-07-03",
      recommendedPrice: 1113.11,
      priceLog: { "2026-07-02": 1113.11 },
      recordedAt: Date.UTC(2026, 6, 3, 5, 0, 0),
    })
    expect(fields.marketDate).toBe(correctStoredMarketDate("2026-07-03", "US"))
    expect(fields.marketDate).toBe("2026-07-02")
  })
})
